import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getMyPlaylists,
  getRecentlyPlayed,
  getSavedAlbums,
  getSavedAudiobooks,
  getSavedShows,
  getSavedTracks,
  getTopArtists,
  getTopTracks,
} from '../api/player';
import type { SimplifiedPlaylist, Track } from '../api/types';
import { hasScopes } from '../auth/session';
import { PERSONAL_SCOPES } from '../config';
import {
  albumItem,
  artistItem,
  audiobookItem,
  errorMessage,
  isPresent,
  likedSongsItem,
  playlistItem,
  showItem,
  trackItem,
  type MediaItem,
} from '../lib/media';

export type PersonalData = {
  /** Up to 6 recently used albums/playlists for the shortcut grid (Lieblingssongs first). */
  shortcuts: MediaItem[];
  recentContexts: MediaItem[];
  recentTracks: MediaItem[];
  topArtists: MediaItem[];
  topTracks: MediaItem[];
  /** Lieblingssongs + own/followed playlists. */
  playlists: MediaItem[];
  likedTracks: Track[];
  albums: MediaItem[];
  shows: MediaItem[];
  audiobooks: MediaItem[];
};

export type PersonalState =
  | { status: 'missing-scopes' }
  | { status: 'loading' }
  | { status: 'ready'; data: PersonalData }
  | { status: 'error'; message: string };

const MAX_AGE_MS = 60_000;
const SHORTCUT_COUNT = 6;

// Shared across tabs so switching between them doesn't refetch.
let cache: { data: PersonalData; loadedAt: number } | null = null;
let inFlight: Promise<PersonalData> | null = null;

// Bumped when the library changed (like, new playlist …) → mounted views reload.
let version = 0;
const versionListeners = new Set<() => void>();

export function invalidatePersonalData(): void {
  if (cache) cache.loadedAt = 0;
  version += 1;
  versionListeners.forEach((listener) => listener());
}

/** Changes whenever the library was edited; use as an effect dependency to reload. */
export function useLibraryVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      versionListeners.add(listener);
      return () => versionListeners.delete(listener);
    },
    () => version,
  );
}

export function usePersonalData(): PersonalState {
  const allowed = hasScopes(PERSONAL_SCOPES);
  const libraryVersion = useLibraryVersion();
  const [state, setState] = useState<PersonalState>(() => {
    if (!allowed) return { status: 'missing-scopes' };
    return cache ? { status: 'ready', data: cache.data } : { status: 'loading' };
  });

  useEffect(() => {
    if (!allowed) return;
    if (cache && Date.now() - cache.loadedAt < MAX_AGE_MS) return;
    let cancelled = false;
    inFlight ??= loadPersonalData().finally(() => {
      inFlight = null;
    });
    inFlight
      .then((data) => {
        cache = { data, loadedAt: Date.now() };
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        // Keep showing stale data if there is some.
        if (!cancelled && !cache) setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, libraryVersion]);

  return state;
}

/** Saved tracks of the cache, for the Lieblingssongs page (avoids loading them twice). */
export function cachedLikedTracks(): Track[] | null {
  return cache?.data.likedTracks ?? null;
}

async function loadPersonalData(): Promise<PersonalData> {
  const [playlistsRaw, recent, artists, tracks] = await Promise.all([
    getMyPlaylists(),
    getRecentlyPlayed(),
    getTopArtists(),
    getTopTracks(),
  ]);
  // Library parts are optional: e.g. audiobooks aren't available in every country.
  const [liked, albums, shows, audiobooks] = await Promise.all([
    optional(getSavedTracks()),
    optional(getSavedAlbums()),
    optional(getSavedShows()),
    optional(getSavedAudiobooks()),
  ]);

  const playlists = playlistsRaw.filter(isPresent);
  const playlistByUri = new Map(playlists.map((playlist) => [playlist.uri, playlist]));
  const likedItem = liked.length > 0 ? [likedSongsItem(liked.length)] : [];

  const recentContexts = dedupe(
    recent.map(({ track, context }) => contextItem(track, context?.uri ?? null, playlistByUri)).filter(isPresent),
  );

  return {
    shortcuts: dedupe([...likedItem, ...recentContexts, ...playlists.map(playlistItem)]).slice(0, SHORTCUT_COUNT),
    recentContexts: recentContexts.slice(0, 12),
    recentTracks: dedupe(recent.map(({ track }) => trackItem(track))).slice(0, 15),
    topArtists: artists.filter(isPresent).map(artistItem),
    topTracks: tracks.filter(isPresent).map(trackItem),
    playlists: [...likedItem, ...playlists.map(playlistItem)],
    likedTracks: liked.filter(isPresent),
    albums: albums.filter(isPresent).map(albumItem),
    shows: shows.filter(isPresent).map(showItem),
    audiobooks: audiobooks.filter(isPresent).map(audiobookItem),
  };
}

async function optional<T>(request: Promise<T[]>): Promise<T[]> {
  try {
    return await request;
  } catch (error) {
    console.warn('Optional library data unavailable:', error);
    return [];
  }
}

/** What a recently played track was played from: one of the user's playlists, else its album. */
function contextItem(track: Track, contextUri: string | null, playlists: Map<string, SimplifiedPlaylist>): MediaItem | null {
  const playlist = contextUri ? playlists.get(contextUri) : undefined;
  if (playlist) return playlistItem(playlist);
  return track.album.uri ? albumItem(track.album) : null;
}

function dedupe(items: MediaItem[]): MediaItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}
