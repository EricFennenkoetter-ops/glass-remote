import { API_BASE } from '../config';
import { getAccessToken, refreshAccessToken } from '../auth/session';

export type ApiErrorKind =
  | 'premium-required'
  | 'user-not-registered'
  | 'no-active-device'
  | 'restricted'
  | 'rate-limited'
  | 'quota-exceeded'
  | 'unauthorized'
  | 'network'
  | 'server'
  | 'unknown';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status: number,
    /** Only for rate-limited / quota-exceeded */
    readonly retryAfterMs = 0,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: 'GET' | 'PUT' | 'POST' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
};

/**
 * Calls the Spotify Web API. Returns parsed JSON, or null for 204 / empty bodies.
 * Retries once with a fresh token on 401; maps all other failures to ApiError.
 */
export async function spotify<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  let response = await send(path, options, await getAccessToken());
  if (response.status === 401) {
    response = await send(path, options, await refreshAccessToken());
  }
  if (response.status === 204 || response.status === 202) return null;
  if (!response.ok) throw await toApiError(response);

  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // Some player commands answer 200 with a non-JSON body (e.g. a snapshot id).
    return null;
  }
}

async function send(path: string, { method = 'GET', query, body }: RequestOptions, token: string): Promise<Response> {
  const url = new URL(API_BASE + path);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  try {
    return await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Keine Verbindung zu Spotify.', 'network', 0);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const { message, reason } = await readErrorBody(response);
  const status = response.status;

  if (status === 429) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After'));
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds * 1000 : 5000;
    return reason === 'QUOTA_EXCEEDED'
      ? new ApiError('Das API-Kontingent deiner Spotify-App ist aufgebraucht.', 'quota-exceeded', status, Math.max(retryAfterMs, 30_000))
      : new ApiError('Zu viele Anfragen – kurze Pause.', 'rate-limited', status, retryAfterMs);
  }
  if (status === 401) {
    return new ApiError('Nicht autorisiert.', 'unauthorized', status);
  }
  if (status === 403) {
    if (reason === 'PREMIUM_REQUIRED' || /premium/i.test(message)) {
      return new ApiError('Für die Steuerung brauchst du Spotify Premium.', 'premium-required', status);
    }
    if (/not registered|developer dashboard|user may not be registered/i.test(message)) {
      return new ApiError(
        'Dein Spotify-Konto ist für diese App nicht freigeschaltet. Trage deine E-Mail im Developer Dashboard unter „User Management“ ein.',
        'user-not-registered',
        status,
      );
    }
    return new ApiError('Diese Aktion ist gerade nicht erlaubt.', 'restricted', status);
  }
  if (status === 404 && (reason === 'NO_ACTIVE_DEVICE' || /no active device/i.test(message))) {
    return new ApiError('Kein aktives Gerät gefunden.', 'no-active-device', status);
  }
  if (status >= 500) {
    return new ApiError('Spotify antwortet gerade nicht.', 'server', status);
  }
  return new ApiError(message || `Fehler ${status}`, 'unknown', status);
}

async function readErrorBody(response: Response): Promise<{ message: string; reason: string }> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const error = 'error' in body ? body.error : body;
      if (typeof error === 'object' && error !== null) {
        return {
          message: 'message' in error ? String(error.message) : '',
          reason: 'reason' in error ? String(error.reason) : '',
        };
      }
      if (typeof error === 'string') return { message: error, reason: 'reason' in body ? String(body.reason) : '' };
    }
  } catch {
    // Plain text / empty body
  }
  return { message: '', reason: '' };
}
