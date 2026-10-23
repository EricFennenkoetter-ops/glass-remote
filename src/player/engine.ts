import { ApiError } from '../api/client';
import * as api from '../api/player';
import type { Device, PlaybackState, RepeatState } from '../api/types';
import { AuthError } from '../auth/session';
import { POLL_INTERVAL_IDLE_MS, POLL_INTERVAL_PLAYING_MS } from '../config';
import { showToast } from '../lib/toast';

/** How long an optimistic value wins over contradicting poll results. */
const OPTIMISTIC_WINDOW_MS = 3000;
/** Poll results within this distance of the optimistic seek position count as confirmation. */
const SEEK_TOLERANCE_MS = 2500;
const VOLUME_SEND_INTERVAL_MS = 300;
const NETWORK_RETRY_MS = 5000;
const PREFERRED_DEVICE_KEY = 'glass-remote.preferred-device';
/** Playback that stops within this window before the song's end counts as "the context ended". */
const END_WINDOW_MS = 4000;
/** Older observations are useless (e.g. the app was in the background for a while). */
const END_MAX_AGE_MS = 60_000;

type PreferredDevice = { id: string; name: string };

function readPreferredDevice(): PreferredDevice | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PREFERRED_DEVICE_KEY) ?? 'null');
    if (typeof parsed === 'object' && parsed !== null && 'id' in parsed && 'name' in parsed) {
      return { id: String(parsed.id), name: String(parsed.name) };
    }
  } catch {
    // ignore – no preference
  }
  return null;
}

function writePreferredDevice(device: PreferredDevice): void {
  try {
    localStorage.setItem(PREFERRED_DEVICE_KEY, JSON.stringify(device));
  } catch {
    // Not critical: the user is asked again next time.
  }
}

type Override<T> = { value: T; setAt: number };

type Overrides = {
  isPlaying?: Override<boolean>;
  shuffle?: Override<boolean>;
  repeat?: Override<RepeatState>;
  volume?: Override<number>;
  seek?: Override<number>;
};

/** Progress at a point in time (performance.now()); the UI extrapolates while playing. */
export type ProgressAnchor = { ms: number; at: number };

export type PlayerSnapshot = {
  status: 'loading' | 'active' | 'idle';
  /** Last polled state with optimistic overrides applied. */
  playback: PlaybackState | null;
  anchor: ProgressAnchor;
  /** Blocks the whole app (account not allowed to use this client ID). */
  fatal: ApiError | null;
  /** Persistent hint, e.g. missing Premium or exhausted quota. */
  notice: ApiError | null;
  /** A play request waits for the user to pick a device. */
  needsDeviceChoice: boolean;
};

export function progressAt(snapshot: Pick<PlayerSnapshot, 'anchor' | 'playback'>, now: number): number {
  const { anchor, playback } = snapshot;
  const duration = playback?.item?.duration_ms ?? Number.POSITIVE_INFINITY;
  const elapsed = playback?.is_playing ? now - anchor.at : 0;
  return Math.min(duration, Math.max(0, anchor.ms + elapsed));
}

export function createPlayerEngine() {
  let raw: PlaybackState | null = null;
  let overrides: Overrides = {};
  let snapshot: PlayerSnapshot = {
    status: 'loading',
    playback: null,
    anchor: { ms: 0, at: performance.now() },
    fatal: null,
    notice: null,
    needsDeviceChoice: false,
  };
  const listeners = new Set<() => void>();

  // ---------- end-of-playback detection (for autoplay) ----------
  let lastPlaying: { uri: string; remainingMs: number; at: number } | null = null;
  let pausedByUser = false;
  let endReported = false;
  let onPlaybackEnded: ((lastUri: string) => void) | null = null;

  /**
   * Spotify stops when a playlist/album without repeat runs out. We see that as "was playing,
   * almost at the end of the song – now stopped", which a pause in the middle of a song isn't.
   */
  function detectEnd(state: PlaybackState | null, now: number) {
    if (state?.is_playing) {
      if (state.item) {
        lastPlaying = { uri: state.item.uri, remainingMs: state.item.duration_ms - (state.progress_ms ?? 0), at: now };
      }
      pausedByUser = false;
      endReported = false;
      return;
    }
    if (!lastPlaying || pausedByUser || endReported) return;
    if (now - lastPlaying.at > END_MAX_AGE_MS) return;
    if (state && state.repeat_state !== 'off') return;
    const expectedRemaining = lastPlaying.remainingMs - (now - lastPlaying.at);
    if (expectedRemaining > END_WINDOW_MS) return;
    endReported = true;
    onPlaybackEnded?.(lastPlaying.uri);
  }

  let running = false;
  let timer: number | undefined;
  let polling = false;
  let pollQueued = false;
  let blockedUntil = 0;

  // ---------- snapshot ----------

  function publish(patch: Partial<PlayerSnapshot>) {
    snapshot = { ...snapshot, ...patch, playback: applyOverrides(raw, overrides) };
    listeners.forEach((listener) => listener());
  }

  function applyOverrides(state: PlaybackState | null, o: Overrides): PlaybackState | null {
    if (!state) return null;
    // Pausing/resuming flags belong to the old play state; drop them while the toggle is in flight.
    const disallows = o.isPlaying
      ? { ...state.actions?.disallows, pausing: false, resuming: false }
      : state.actions?.disallows;
    return {
      ...state,
      actions: { ...state.actions, disallows },
      is_playing: o.isPlaying?.value ?? state.is_playing,
      shuffle_state: o.shuffle?.value ?? state.shuffle_state,
      repeat_state: o.repeat?.value ?? state.repeat_state,
      device: { ...state.device, volume_percent: o.volume?.value ?? state.device.volume_percent },
    };
  }

  /** Drops overrides the server has confirmed or that are too old. */
  function reconcile(state: PlaybackState, now: number): Overrides {
    const fresh = <T>(override: Override<T> | undefined, serverValue: T | null) =>
      override && now - override.setAt < OPTIMISTIC_WINDOW_MS && override.value !== serverValue ? override : undefined;

    const next: Overrides = {
      isPlaying: fresh(overrides.isPlaying, state.is_playing),
      shuffle: fresh(overrides.shuffle, state.shuffle_state),
      repeat: fresh(overrides.repeat, state.repeat_state),
      volume: fresh(overrides.volume, state.device.volume_percent),
    };
    const seek = overrides.seek;
    if (seek && now - seek.setAt < OPTIMISTIC_WINDOW_MS) {
      const playing = next.isPlaying?.value ?? state.is_playing;
      const expected = seek.value + (playing ? now - seek.setAt : 0);
      if (Math.abs((state.progress_ms ?? 0) - expected) > SEEK_TOLERANCE_MS) next.seek = seek;
    }
    return next;
  }

  // ---------- polling ----------

  function schedule(delayMs: number) {
    window.clearTimeout(timer);
    if (!running || document.hidden) return;
    const wait = Math.max(delayMs, blockedUntil - Date.now());
    timer = window.setTimeout(poll, wait);
  }

  async function poll() {
    if (polling) {
      pollQueued = true;
      return;
    }
    polling = true;
    let nextDelay = POLL_INTERVAL_IDLE_MS;
    try {
      const state = await api.getPlaybackState();
      const now = performance.now();
      detectEnd(state?.device ? state : null, now);
      if (!state || !state.device) {
        raw = null;
        overrides = {};
        publish({ status: 'idle', fatal: null });
      } else {
        overrides = reconcile(state, now);
        raw = state;
        const anchor = overrides.seek
          ? snapshot.anchor
          : { ms: state.progress_ms ?? 0, at: now };
        publish({ status: 'active', anchor, fatal: null });
        if (state.is_playing) nextDelay = POLL_INTERVAL_PLAYING_MS;
      }
      if (snapshot.notice?.kind === 'quota-exceeded' || snapshot.notice?.kind === 'rate-limited') {
        publish({ notice: null });
      }
    } catch (error) {
      nextDelay = handlePollError(error);
    } finally {
      polling = false;
    }
    if (pollQueued) {
      pollQueued = false;
      schedule(0);
    } else if (nextDelay >= 0) {
      schedule(nextDelay);
    }
  }

  /** Returns the next poll delay, or -1 to stop polling. */
  function handlePollError(error: unknown): number {
    if (error instanceof AuthError) return -1; // session cleared → app shows login
    if (!(error instanceof ApiError)) {
      console.error(error);
      return NETWORK_RETRY_MS;
    }
    switch (error.kind) {
      case 'rate-limited':
      case 'quota-exceeded':
        blockedUntil = Date.now() + error.retryAfterMs;
        publish({ notice: error });
        return error.retryAfterMs;
      case 'user-not-registered':
        publish({ fatal: error });
        return -1;
      case 'network':
        showToast('Keine Verbindung. Ich versuche es weiter …');
        return NETWORK_RETRY_MS;
      default:
        showToast(error.message);
        return NETWORK_RETRY_MS;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) window.clearTimeout(timer);
    else schedule(0);
  }

  // ---------- commands ----------

  function currentProgress(now = performance.now()) {
    return progressAt(snapshot, now);
  }

  /** Runs a player command; resolves false (after undoing optimistic state and telling the user) on failure. */
  async function command(call: () => Promise<unknown>, repollMs = 500): Promise<boolean> {
    if (Date.now() < blockedUntil) {
      showToast('Spotify bremst gerade – gleich nochmal versuchen.');
      overrides = {};
      publish({});
      return false;
    }
    try {
      await call();
      schedule(repollMs);
      return true;
    } catch (error) {
      // Undo optimistic changes; the next poll shows the truth.
      overrides = {};
      publish({});
      if (error instanceof ApiError) {
        if (error.kind === 'rate-limited' || error.kind === 'quota-exceeded') {
          blockedUntil = Date.now() + error.retryAfterMs;
        }
        // Premium is shown as a persistent notice instead of a toast.
        if (error.kind === 'premium-required') publish({ notice: error });
        else showToast(error.kind === 'no-active-device' ? 'Kein Spotify-Gerät gefunden – öffne kurz die Spotify-App.' : error.message);
      } else if (!(error instanceof AuthError)) {
        console.error(error);
        showToast('Das hat nicht geklappt.');
      }
      schedule(0);
      return false;
    }
  }

  /**
   * Where to start when nothing is active: the active device, else the one the user picked last
   * time, else the only one available. null → the user has to choose (none or several available).
   */
  async function chooseDeviceId(): Promise<string | null> {
    const usable = (await api.getDevices()).filter((device) => device.id && !device.is_restricted);
    const preferred = readPreferredDevice();
    const device =
      usable.find((d) => d.is_active) ??
      usable.find((d) => preferred && (d.id === preferred.id || d.name === preferred.name)) ??
      (usable.length === 1 ? usable[0] : undefined);
    return device?.id ?? null;
  }

  async function startWithFallback(request: api.PlayRequest, fallback: api.PlayRequest | undefined, deviceId?: string) {
    try {
      await api.startPlayback(request, deviceId);
    } catch (error) {
      // e.g. a relinked track that isn't part of the album context → play it on its own.
      const rejected = error instanceof ApiError && error.kind === 'unknown' && (error.status === 400 || error.status === 404);
      if (!fallback || !rejected) throw error;
      await api.startPlayback(fallback, deviceId);
    }
  }

  /** A play request waiting for the user to pick a device. */
  let pendingPlay: { request: api.PlayRequest; fallback?: api.PlayRequest } | null = null;

  function setOverride<K extends keyof Overrides>(key: K, value: NonNullable<Overrides[K]>['value']) {
    overrides = { ...overrides, [key]: { value, setAt: performance.now() } };
  }

  let volumeTimer: number | undefined;
  let volumeLastSent = 0;
  let volumeTarget = 0;

  function sendVolume() {
    volumeLastSent = performance.now();
    void command(() => api.setVolume(volumeTarget), 1200);
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,

    start() {
      running = true;
      document.addEventListener('visibilitychange', onVisibilityChange);
      schedule(0);
    },
    stop() {
      running = false;
      window.clearTimeout(timer);
      window.clearTimeout(volumeTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    },
    refresh: () => schedule(0),
    /** Called once when a context ran out (not on a user pause). */
    setPlaybackEndedHandler(handler: ((lastUri: string) => void) | null) {
      onPlaybackEnded = handler;
    },

    togglePlay() {
      const willPlay = !snapshot.playback?.is_playing;
      const now = performance.now();
      const anchor = { ms: currentProgress(now), at: now };
      setOverride('isPlaying', willPlay);
      publish({ anchor });
      if (!willPlay) pausedByUser = true;
      void command(willPlay ? () => api.play() : api.pause);
    },
    next() {
      setOverride('seek', 0);
      publish({ anchor: { ms: 0, at: performance.now() } });
      void command(api.skipToNext, 400);
    },
    previous() {
      setOverride('seek', 0);
      publish({ anchor: { ms: 0, at: performance.now() } });
      void command(api.skipToPrevious, 400);
    },
    seekTo(positionMs: number) {
      setOverride('seek', positionMs);
      publish({ anchor: { ms: positionMs, at: performance.now() } });
      void command(() => api.seek(positionMs), 700);
    },
    toggleShuffle() {
      const next = !snapshot.playback?.shuffle_state;
      setOverride('shuffle', next);
      publish({});
      void command(() => api.setShuffle(next));
    },
    cycleRepeat() {
      const order: RepeatState[] = ['off', 'context', 'track'];
      const current = snapshot.playback?.repeat_state ?? 'off';
      const next = order[(order.indexOf(current) + 1) % order.length] ?? 'off';
      setOverride('repeat', next);
      publish({});
      void command(() => api.setRepeat(next));
    },
    /** Optimistic on every change; sent to Spotify at most every 300 ms plus a trailing call. */
    changeVolume(percent: number) {
      volumeTarget = Math.round(percent);
      setOverride('volume', volumeTarget);
      publish({});
      window.clearTimeout(volumeTimer);
      const sinceLast = performance.now() - volumeLastSent;
      if (sinceLast >= VOLUME_SEND_INTERVAL_MS) sendVolume();
      else volumeTimer = window.setTimeout(sendVolume, VOLUME_SEND_INTERVAL_MS - sinceLast);
    },
    /**
     * Starts something new (search result, playlist …). Resolves true when Spotify accepted it;
     * if no device is active and it's unclear which one to use, sets `needsDeviceChoice` instead.
     */
    async playItem(request: api.PlayRequest, fallback?: api.PlayRequest): Promise<boolean> {
      setOverride('isPlaying', true);
      setOverride('seek', 0);
      publish({ anchor: { ms: 0, at: performance.now() } });

      let needsChoice = false;
      const started = await command(async () => {
        let deviceId: string | undefined;
        if (snapshot.status === 'idle') {
          const chosen = await chooseDeviceId();
          if (!chosen) {
            needsChoice = true;
            return;
          }
          deviceId = chosen;
        }
        try {
          await startWithFallback(request, fallback, deviceId);
        } catch (error) {
          if (!(error instanceof ApiError && error.kind === 'no-active-device' && !deviceId)) throw error;
          const chosen = await chooseDeviceId();
          if (!chosen) {
            needsChoice = true;
            return;
          }
          await startWithFallback(request, fallback, chosen);
        }
      }, 400);

      if (!needsChoice) return started;
      pendingPlay = { request, fallback };
      overrides = {};
      publish({ needsDeviceChoice: true });
      return false;
    },
    cancelDeviceChoice() {
      if (!pendingPlay && !snapshot.needsDeviceChoice) return;
      pendingPlay = null;
      publish({ needsDeviceChoice: false });
    },
    async addToQueue(uri: string) {
      if (await command(() => api.addToQueue(uri), 1500)) showToast('Zur Warteschlange hinzugefügt', 'info');
    },
    /** The user picked a device: start the pending request there, or move playback over. */
    async useDevice(device: Pick<Device, 'id' | 'name'>): Promise<boolean> {
      if (!device.id) return false;
      const deviceId = device.id;
      writePreferredDevice({ id: deviceId, name: device.name });
      const pending = pendingPlay;
      if (pending) {
        pendingPlay = null;
        setOverride('isPlaying', true);
        publish({ needsDeviceChoice: false, anchor: { ms: 0, at: performance.now() } });
        return command(() => startWithFallback(pending.request, pending.fallback, deviceId), 400);
      }
      // From the idle state there is nothing to resume, so start playing on the target.
      const startPlaying = snapshot.status === 'idle' || Boolean(snapshot.playback?.is_playing);
      return command(() => api.transferPlayback(deviceId, startPlaying), 900);
    },
  };
}

export type PlayerEngine = ReturnType<typeof createPlayerEngine>;
