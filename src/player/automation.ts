import { useEffect } from 'react';
import {
  createPlaylist,
  getMe,
  getMyPlaylists,
  getPlaybackState,
  getRecentlyPlayed,
  getTopTracks,
  replacePlaylistItems,
  updatePlaylist,
} from '../api/player';
import { hasScopes } from '../auth/session';
import { PERSONAL_SCOPES } from '../config';
import { getAppearance, TOP_RANGES } from '../lib/appearance';
import { idFromUri, isPresent } from '../lib/media';
import { showToast } from '../lib/toast';
import type { PlayerEngine } from './engine';
import { invalidatePersonalData } from './usePersonalData';

// ---------- "Meine Top-Songs": a playlist that always holds the current top tracks ----------

const TOP_PLAYLIST_NAME = 'Meine Top-Songs';
const TOP_PLAYLIST_KEY = 'glass-remote.top-playlist';
/** Spotify recalculates top tracks roughly daily; more often is wasted quota. */
const TOP_SYNC_INTERVAL_MS = 6 * 3600_000;
const TOP_TRACK_COUNT = 50;

type TopPlaylistState = { id: string; syncedAt: number; range: string };

function readTopState(): TopPlaylistState | null {
  try {
    return JSON.parse(localStorage.getItem(TOP_PLAYLIST_KEY) ?? 'null') as TopPlaylistState | null;
  } catch {
    return null;
  }
}

function writeTopState(state: TopPlaylistState) {
  try {
    localStorage.setItem(TOP_PLAYLIST_KEY, JSON.stringify(state));
  } catch {
    // Not critical: the playlist is found again by name next time.
  }
}

let syncInFlight: Promise<number> | null = null;

/**
 * Creates (once) and refills the "Meine Top-Songs" playlist. Skips if synced recently, unless
 * forced. Resolves with the number of songs written (0 when skipped).
 */
export function syncTopPlaylist({ force = false } = {}): Promise<number> {
  syncInFlight ??= runTopSync(force).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runTopSync(force: boolean): Promise<number> {
  const { topRange } = getAppearance();
  const previous = readTopState();
  const fresh = previous && previous.range === topRange && Date.now() - previous.syncedAt < TOP_SYNC_INTERVAL_MS;
  if (fresh && !force) return 0;

  const tracks = (await getTopTracks(topRange, TOP_TRACK_COUNT)).filter(isPresent);
  if (tracks.length === 0) return 0;

  const id = (await findTopPlaylist(previous?.id)) ?? (await createTopPlaylist());
  const details = {
    name: TOP_PLAYLIST_NAME,
    description: `Deine meistgehörten Songs der letzten ${TOP_RANGES[topRange]} – automatisch aktualisiert von Glass Remote (${new Date().toLocaleDateString('de-DE')}).`,
    public: false,
  };
  await replacePlaylistItems(id, tracks.map((track) => track.uri));
  await updatePlaylist(id, details);
  writeTopState({ id, syncedAt: Date.now(), range: topRange });
  invalidatePersonalData();
  return tracks.length;
}

/** The playlist from last time – or one with the same name that the user owns (e.g. after clearing data). */
async function findTopPlaylist(knownId: string | undefined): Promise<string | null> {
  const [me, playlists] = await Promise.all([getMe(), getMyPlaylists()]);
  const own = playlists.filter((playlist) => playlist && playlist.owner.id === me?.id);
  const match =
    own.find((playlist) => playlist && knownId && idFromUri(playlist.uri) === knownId) ??
    own.find((playlist) => playlist?.name === TOP_PLAYLIST_NAME);
  return match ? idFromUri(match.uri) : null;
}

async function createTopPlaylist(): Promise<string> {
  const created = await createPlaylist({ name: TOP_PLAYLIST_NAME, description: '', public: false });
  if (!created) throw new Error('Spotify hat keine Playlist zurückgegeben.');
  return idFromUri(created.uri);
}

// ---------- Autoplay: keep the music going when a playlist/album ends ----------

/** Gives Spotify's own autoplay (setting in the Spotify app) the chance to take over first. */
const AUTOPLAY_GRACE_MS = 3500;
const AUTOPLAY_TRACK_COUNT = 50;

/**
 * Spotify removed its recommendations API for apps like this one, so "similar music" isn't
 * available. We continue with a shuffled mix of the user's top and recently played songs instead.
 */
async function continueWithFavourites(player: PlayerEngine, lastUri: string) {
  await new Promise((resolve) => window.setTimeout(resolve, AUTOPLAY_GRACE_MS));
  const state = await getPlaybackState().catch(() => null);
  if (state?.is_playing) return;

  const [top, recent] = await Promise.all([
    getTopTracks('short_term', 50).catch(() => null),
    getRecentlyPlayed().catch(() => null),
  ]);
  const topUris = (top ?? []).filter(isPresent).map((track) => track.uri);
  const recentUris = (recent ?? []).map(({ track }) => track.uri);
  const uris = [...new Set([...topUris, ...recentUris])].filter((uri) => uri !== lastUri);
  if (uris.length === 0) return;
  shuffle(uris);
  showToast('Autoplay: weiter mit deinen Lieblingssongs', 'info');
  await player.playItem({ uris: uris.slice(0, AUTOPLAY_TRACK_COUNT) });
}

function shuffle<T>(items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
}

// ---------- wiring ----------

/** Starts the top-playlist sync on app start and installs the autoplay handler. */
export function useAutomation(player: PlayerEngine) {
  useEffect(() => {
    if (!hasScopes(PERSONAL_SCOPES) || !getAppearance().topPlaylist) return;
    syncTopPlaylist().catch((error: unknown) => console.warn('Top-Songs-Playlist:', error));
  }, []);

  useEffect(() => {
    player.setPlaybackEndedHandler((lastUri) => {
      if (getAppearance().autoplay) void continueWithFavourites(player, lastUri);
    });
    return () => player.setPlaybackEndedHandler(null);
  }, [player]);
}
