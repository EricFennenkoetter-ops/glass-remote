import { ACCOUNTS_BASE, REDIRECT_URI, SCOPES, SPOTIFY_CLIENT_ID } from '../config';
import { codeChallenge, randomString } from './pkce';

type Tokens = {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms */
  expiresAt: number;
  /** Space-separated scopes Spotify granted; empty for sessions from older app versions. */
  scope: string;
};

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
};

const TOKENS_KEY = 'glass-remote.tokens';
const VERIFIER_KEY = 'glass-remote.pkce-verifier';
const STATE_KEY = 'glass-remote.pkce-state';
const TRANSFER_PREFIX = 'glassremote1.';
/** Refresh this long before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;

export class AuthError extends Error {
  constructor(
    message: string,
    readonly kind: 'denied' | 'wrong-context' | 'state-mismatch' | 'exchange-failed' | 'session-expired' | 'invalid-transfer',
  ) {
    super(message);
  }
}

// ---------- token store (subscribable, for useSyncExternalStore) ----------

const listeners = new Set<() => void>();
let tokens: Tokens | null = readTokens();

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'accessToken' in parsed &&
      'refreshToken' in parsed &&
      'expiresAt' in parsed &&
      typeof parsed.accessToken === 'string' &&
      typeof parsed.refreshToken === 'string' &&
      typeof parsed.expiresAt === 'number'
    ) {
      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        expiresAt: parsed.expiresAt,
        scope: 'scope' in parsed && typeof parsed.scope === 'string' ? parsed.scope : '',
      };
    }
  } catch {
    // Corrupt or inaccessible storage → treat as logged out.
  }
  return null;
}

function setTokens(next: Tokens | null): void {
  tokens = next;
  try {
    if (next) localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    // Private mode etc. – the session then just lives in memory.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isLoggedIn(): boolean {
  return tokens !== null;
}

/** True if the current session was granted every given scope (new scopes need a fresh login). */
export function hasScopes(required: readonly string[]): boolean {
  const granted = new Set(tokens?.scope.split(' ') ?? []);
  return required.every((scope) => granted.has(scope));
}

export function logout(): void {
  setTokens(null);
}

// ---------- login (authorization code + PKCE) ----------

export async function startLogin(): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(16);
  storeForCallback(VERIFIER_KEY, verifier);
  storeForCallback(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES.join(' '),
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: await codeChallenge(verifier),
    state,
  });
  // Same window on purpose: a popup/new tab would leave the installed app's storage context on iOS.
  window.location.assign(`${ACCOUNTS_BASE}/authorize?${params.toString()}`);
}

/** The verifier must survive the round trip to Spotify; localStorage is shared across tabs of the same context. */
function storeForCallback(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Without storage the callback will report a wrong-context error.
  }
}

function takeStored(key: string): string | null {
  try {
    const value = localStorage.getItem(key);
    localStorage.removeItem(key);
    return value;
  } catch {
    return null;
  }
}

export function hasAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') || params.has('error');
}

/** Exchanges ?code=… for tokens. Always removes the query from the address bar. */
export async function completeLoginFromCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  window.history.replaceState(null, '', window.location.pathname + window.location.hash);

  const error = params.get('error');
  if (error) {
    throw new AuthError(
      error === 'access_denied' ? 'Du hast den Zugriff abgelehnt.' : `Spotify meldet: ${error}`,
      'denied',
    );
  }

  const verifier = takeStored(VERIFIER_KEY);
  const expectedState = takeStored(STATE_KEY);
  if (!verifier || !expectedState) {
    throw new AuthError(
      'Die Anmeldung ist in einem anderen Fenster gelandet als sie gestartet wurde (iOS trennt Safari und Home-Bildschirm-Apps).',
      'wrong-context',
    );
  }
  if (params.get('state') !== expectedState) {
    throw new AuthError('Ungültige Anmeldeantwort. Bitte erneut verbinden.', 'state-mismatch');
  }

  const response = await requestToken({
    grant_type: 'authorization_code',
    code: params.get('code') ?? '',
    redirect_uri: REDIRECT_URI,
    client_id: SPOTIFY_CLIENT_ID,
    code_verifier: verifier,
  });
  if (!response.ok) {
    throw new AuthError(await describeTokenError(response), 'exchange-failed');
  }
  storeTokenResponse(await response.json(), null, '');
}

// ---------- access token + refresh ----------

let refreshInFlight: Promise<string> | null = null;

/** A valid access token, refreshed when it's (about to be) expired. */
export async function getAccessToken(): Promise<string> {
  if (!tokens) throw new AuthError('Nicht angemeldet.', 'session-expired');
  if (Date.now() < tokens.expiresAt - EXPIRY_MARGIN_MS) return tokens.accessToken;
  return refreshAccessToken();
}

/** Refreshes once even if called concurrently (e.g. several 401s at the same time). */
export function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= runRefresh(tokens?.refreshToken, tokens?.scope ?? '').finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function runRefresh(refreshToken: string | undefined, previousScope: string): Promise<string> {
  if (!refreshToken) throw new AuthError('Nicht angemeldet.', 'session-expired');
  const response = await requestToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: SPOTIFY_CLIENT_ID,
  });
  if (!response.ok) {
    // 400 invalid_grant: refresh token revoked/expired → user must log in again.
    if (response.status === 400 || response.status === 401) {
      setTokens(null);
      throw new AuthError('Deine Sitzung ist abgelaufen. Bitte neu verbinden.', 'session-expired');
    }
    throw new Error(await describeTokenError(response));
  }
  return storeTokenResponse(await response.json(), refreshToken, previousScope);
}

function requestToken(body: Record<string, string>): Promise<Response> {
  return fetch(`${ACCOUNTS_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
}

function storeTokenResponse(data: TokenResponse, previousRefreshToken: string | null, previousScope: string): string {
  const refreshToken = data.refresh_token ?? previousRefreshToken;
  if (!refreshToken) throw new AuthError('Spotify hat kein Refresh-Token geliefert.', 'exchange-failed');
  setTokens({
    accessToken: data.access_token,
    refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope ?? previousScope,
  });
  return data.access_token;
}

async function describeTokenError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error_description' in body) {
      return `Anmeldung fehlgeschlagen: ${String(body.error_description)}`;
    }
  } catch {
    // fall through
  }
  return `Anmeldung fehlgeschlagen (HTTP ${response.status}).`;
}

// ---------- fallback: hand a session from Safari over to the installed app ----------

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

export function exportSessionCode(): string | null {
  return tokens ? TRANSFER_PREFIX + btoa(tokens.refreshToken) : null;
}

export async function importSessionCode(code: string): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed.startsWith(TRANSFER_PREFIX)) {
    throw new AuthError('Das ist kein gültiger Übertragungscode.', 'invalid-transfer');
  }
  let refreshToken: string;
  try {
    refreshToken = atob(trimmed.slice(TRANSFER_PREFIX.length));
  } catch {
    throw new AuthError('Das ist kein gültiger Übertragungscode.', 'invalid-transfer');
  }
  await runRefresh(refreshToken, '');
}
