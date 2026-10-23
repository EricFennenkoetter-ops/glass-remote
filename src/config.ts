const DEMO_MODE = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

export const SPOTIFY_CLIENT_ID: string =
  import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || (DEMO_MODE ? 'demo-client' : '');

/** Must match a redirect URI in the Spotify dashboard exactly. Falls back to the app's own URL. */
export const REDIRECT_URI: string =
  import.meta.env.VITE_REDIRECT_URI?.trim() || new URL('./', window.location.href).href;

export const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-recently-played',
  'user-top-read',
] as const;

/** Needed for the personal home/library; sessions from older app versions don't have them yet. */
export const PERSONAL_SCOPES = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-read-recently-played',
  'user-top-read',
] as const;

export const ACCOUNTS_BASE = 'https://accounts.spotify.com';
export const API_BASE = 'https://api.spotify.com/v1';

/** Poll interval while something plays, and the slower one while paused/idle. */
export const POLL_INTERVAL_PLAYING_MS = 1500;
export const POLL_INTERVAL_IDLE_MS = 4000;
