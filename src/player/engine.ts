import { ApiError } from '../api/client';
import * as api from '../api/player';
import type { PlaybackState, RepeatState } from '../api/types';
import { AuthError } from '../auth/session';
import { POLL_INTERVAL_IDLE_MS, POLL_INTERVAL_PLAYING_MS } from '../config';
import { showToast } from '../lib/toast';

/** How long an optimistic value wins over contradicting poll results. */
const OPTIMISTIC_WINDOW_MS = 3000;
/** Poll results within this distance of the optimistic seek position count as confirmation. */
const SEEK_TOLERANCE_MS = 2500;
const VOLUME_SEND_INTERVAL_MS = 300;
const NETWORK_RETRY_MS = 5000;

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
  };
  const listeners = new Set<() => void>();

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

  /** The device to start on when nothing is active: a smartphone if possible, else any controllable one. */
  async function findDeviceId(): Promise<string | undefined> {
    const usable = (await api.getDevices()).filter((device) => device.id && !device.is_restricted);
    const device = usable.find((d) => d.is_active) ?? usable.find((d) => d.type === 'Smartphone') ?? usable[0];
    return device?.id ?? undefined;
  }

  async function startOnSomeDevice(request: api.PlayRequest, fallback?: api.PlayRequest) {
    const deviceId = snapshot.status === 'idle' ? await findDeviceId() : undefined;
    try {
      await api.startPlayback(request, deviceId);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.kind === 'no-active-device' && !deviceId) {
        const retryDeviceId = await findDeviceId();
        if (!retryDeviceId) throw error;
        await api.startPlayback(request, retryDeviceId);
      } else if (fallback && error.kind === 'unknown' && (error.status === 400 || error.status === 404)) {
        // e.g. a relinked track that isn't part of the album context → play it on its own.
        await api.startPlayback(fallback, deviceId);
      } else {
        throw error;
      }
    }
  }

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

    togglePlay() {
      const willPlay = !snapshot.playback?.is_playing;
      const now = performance.now();
      const anchor = { ms: currentProgress(now), at: now };
      setOverride('isPlaying', willPlay);
      publish({ anchor });
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
    /** Starts something new (search result, playlist …); resolves true when Spotify accepted it. */
    playItem(request: api.PlayRequest, fallback?: api.PlayRequest): Promise<boolean> {
      setOverride('isPlaying', true);
      setOverride('seek', 0);
      publish({ anchor: { ms: 0, at: performance.now() } });
      return command(() => startOnSomeDevice(request, fallback), 400);
    },
    async addToQueue(uri: string) {
      if (await command(() => api.addToQueue(uri), 1500)) showToast('Zur Warteschlange hinzugefügt', 'info');
    },
    async transferTo(deviceId: string) {
      // From the idle state there is nothing to resume, so start playing on the target.
      const startPlaying = snapshot.status === 'idle' || Boolean(snapshot.playback?.is_playing);
      await command(() => api.transferPlayback(deviceId, startPlaying), 900);
    },
  };
}

export type PlayerEngine = ReturnType<typeof createPlayerEngine>;
