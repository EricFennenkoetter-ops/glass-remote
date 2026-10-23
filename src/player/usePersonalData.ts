import { useEffect, useState } from 'react';
import { getMyPlaylists, getRecentlyPlayed, getTopArtists, getTopTracks } from '../api/player';
import type { SimplifiedPlaylist, Track } from '../api/types';
import { hasScopes } from '../auth/session';
import { PERSONAL_SCOPES } from '../config';
import { albumItem, artistItem, errorMessage, isPresent, playlistItem, trackItem, type MediaItem } from '../lib/media';

export type PersonalData = {
  /** Up to 6 recently used albums/playlists for the shortcut grid. */
  shortcuts: MediaItem[];
  recentContexts: MediaItem[];
  recentTracks: MediaItem[];
  topArtists: MediaItem[];
  topTracks: MediaItem[];
  playlists: MediaItem[];
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

export function usePersonalData(): PersonalState {
  const allowed = hasScopes(PERSONAL_SCOPES);
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
  }, [allowed]);

  return state;
}

async function loadPersonalData(): Promise<PersonalData> {
  const [playlistsRaw, recent, artists, tracks] = await Promise.all([
    getMyPlaylists(),
    getRecentlyPlayed(),
    getTopArtists(),
    getTopTracks(),
  ]);
  const playlists = playlistsRaw.filter(isPresent);
  const playlistByUri = new Map(playlists.map((playlist) => [playlist.uri, playlist]));

  const recentContexts = dedupe(
    recent.map(({ track, context }) => contextItem(track, context?.uri ?? null, playlistByUri)).filter(isPresent),
  );
  const shortcuts = dedupe([...recentContexts, ...playlists.map(playlistItem)]).slice(0, SHORTCUT_COUNT);

  return {
    shortcuts,
    recentContexts: recentContexts.slice(0, 12),
    recentTracks: dedupe(recent.map(({ track }) => trackItem(track))).slice(0, 15),
    topArtists: artists.filter(isPresent).map(artistItem),
    topTracks: tracks.filter(isPresent).map(trackItem),
    playlists: playlists.map(playlistItem),
  };
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
