import { ApiError } from '../api/client';
import { getRecentlyPlayed, getSavedTracks, getTopArtists, getTopTracks, searchTracks } from '../api/player';
import type { Track } from '../api/types';
import { AuthError } from '../auth/session';
import { isPresent } from '../lib/media';
import { showToast } from '../lib/toast';
import type { PlayerEngine } from './engine';
import { cachedLikedTracks } from './usePersonalData';

// A tiny "DJ": one tap builds a set from what the user loves and a bit of what they might love.
//
// Spotify removed audio features (BPM, key, energy) and recommendations for apps like this one,
// so "fits well" can't be computed from the audio. Instead the set is built from taste signals:
//   • favourites   – top songs of the last 4 weeks and 6 months
//   • rediscovery  – liked songs that haven't been played recently
//   • new for you  – other songs by the user's current top artists
// and ordered so the same artist never plays twice in a row and the mix keeps changing flavour.

const SET_LENGTH = 40;
/** Artists to look for new songs of (one search request each). */
const DISCOVERY_ARTISTS = 5;
/** Fewer than this isn't a set. */
const MIN_SET_LENGTH = 3;

export type DjSet = {
  uris: string[];
  /** One line about what's in the set – shown to the user like a DJ announcement. */
  note: string;
};

export class DjError extends Error {}

/** Builds a set, announces it and starts playing. Resolves true when playback was started. */
export async function startDj(player: PlayerEngine, options: { exclude?: string[]; announce?: boolean } = {}): Promise<boolean> {
  try {
    const set = await buildDjSet(options);
    if (options.announce !== false) showToast(set.note, 'info');
    return await player.playItem({ uris: set.uris });
  } catch (error) {
    if (error instanceof AuthError) return false;
    showToast(error instanceof DjError || error instanceof ApiError ? error.message : 'Der DJ hat sich verspielt.');
    return false;
  }
}

type Pools = { favourites: Track[]; rediscovery: Track[]; fresh: Track[]; freshArtists: string[] };

export async function buildDjSet(options: { exclude?: string[] } = {}): Promise<DjSet> {
  const pools = await collectPools(new Set(options.exclude ?? []));
  const tracks = arrange(pools);
  if (tracks.length < MIN_SET_LENGTH) {
    throw new DjError('Dafür kenne ich deinen Geschmack noch nicht gut genug. Hör erst ein paar Songs, dann legt der DJ los.');
  }
  return { uris: tracks.map((track) => track.uri), note: describe(pools, tracks.length) };
}

async function collectPools(exclude: Set<string>): Promise<Pools> {
  // A failing source just means a smaller pool – the set can still be built from the others.
  const [topShortRaw, topMediumRaw, recentRaw, artistsRaw] = await Promise.all([
    getTopTracks('short_term', 50).catch(() => null),
    getTopTracks('medium_term', 50).catch(() => null),
    getRecentlyPlayed().catch(() => null),
    getTopArtists().catch(() => null),
  ]);
  const topShort = topShortRaw ?? [];
  const topMedium = topMediumRaw ?? [];
  const recent = recentRaw ?? [];
  const artists = artistsRaw ?? [];
  const liked = cachedLikedTracks() ?? (await getSavedTracks().catch(() => null)) ?? [];

  const recentUris = new Set(recent.map(({ track }) => track.uri));
  const known = new Set<string>(exclude);
  const take = (tracks: (Track | null)[], limit: number, skip: (track: Track) => boolean = () => false) => {
    const taken: Track[] = [];
    for (const track of tracks.filter(isPresent)) {
      if (taken.length >= limit || known.has(track.uri) || skip(track)) continue;
      known.add(track.uri);
      taken.push(track);
    }
    return taken;
  };

  // Short-term favourites first, then the long-term ones.
  const favourites = take([...topShort, ...topMedium], 24);
  // Liked songs not played lately, in random order so every DJ set feels different.
  const rediscovery = take(shuffled(liked), 10, (track) => recentUris.has(track.uri));

  const topArtists = artists.filter(isPresent).slice(0, DISCOVERY_ARTISTS);
  const found = await Promise.all(
    topArtists.map((artist) => searchTracks(`artist:"${artist.name}"`, 10).catch(() => null)),
  );
  // Songs that aren't already part of the set, and that the user hasn't just heard.
  const fresh = take(
    shuffled(found.flatMap((tracks) => tracks ?? [])),
    14,
    (track) => recentUris.has(track.uri) || !topArtists.some((artist) => track.artists.some((a) => a.name === artist.name)),
  );
  const freshArtists = [...new Set(fresh.map((track) => track.artists[0]?.name).filter(isPresent))];

  return { favourites, rediscovery, fresh, freshArtists };
}

/** Interleaves the pools (mostly favourites, a spark of new, now and then an old friend). */
function arrange({ favourites, rediscovery, fresh }: Pools): Track[] {
  const pattern = ['fav', 'fav', 'new', 'fav', 'old', 'fav', 'new', 'fav', 'fav', 'old'] as const;
  const queues = { fav: [...favourites], old: [...rediscovery], new: [...fresh] };
  const result: Track[] = [];
  for (let step = 0; result.length < SET_LENGTH; step++) {
    const wanted = pattern[step % pattern.length]!;
    // If a pool is empty, take from whichever still has songs.
    const kind = queues[wanted].length > 0 ? wanted : (['fav', 'new', 'old'] as const).find((key) => queues[key].length > 0);
    if (!kind) break;
    result.push(queues[kind].shift()!);
  }
  return separateArtists(result);
}

/** Moves songs so the same main artist never plays back to back (as far as the set allows). */
function separateArtists(tracks: Track[]): Track[] {
  const rest = [...tracks];
  const ordered: Track[] = [];
  while (rest.length > 0) {
    const previous = ordered.at(-1)?.artists[0]?.name;
    const index = rest.findIndex((track) => track.artists[0]?.name !== previous);
    ordered.push(...rest.splice(index === -1 ? 0 : index, 1));
  }
  return ordered;
}

function describe(pools: Pools, total: number): string {
  const parts = [`${total} Songs`, 'deine Favoriten'];
  if (pools.rediscovery.length > 0) parts.push('ein paar vergessene Lieblinge');
  if (pools.freshArtists.length > 0) parts.push(`Neues von ${pools.freshArtists.slice(0, 2).join(' und ')}`);
  return `DJ legt los: ${parts.join(', ')}`;
}

function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
