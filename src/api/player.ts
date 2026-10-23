import { spotify } from './client';
import type {
  DevicesResponse,
  Paging,
  PlaybackState,
  QueueResponse,
  RecentlyPlayedResponse,
  RepeatState,
  SearchResponse,
  SimplifiedPlaylist,
  Artist,
  FullAlbum,
  FullPlaylist,
  PlaylistEntry,
  SimplifiedAlbum,
  Track,
} from './types';

// https://developer.spotify.com/documentation/web-api/reference/#category-player

/** null = 204: nothing active. */
export const getPlaybackState = () =>
  spotify<PlaybackState>('/me/player', { query: { additional_types: 'track,episode' } });

export const play = (deviceId?: string) => spotify('/me/player/play', { method: 'PUT', query: { device_id: deviceId } });

export const pause = () => spotify('/me/player/pause', { method: 'PUT' });

export const skipToNext = () => spotify('/me/player/next', { method: 'POST' });

export const skipToPrevious = () => spotify('/me/player/previous', { method: 'POST' });

export const seek = (positionMs: number) =>
  spotify('/me/player/seek', { method: 'PUT', query: { position_ms: Math.max(0, Math.round(positionMs)) } });

export const setShuffle = (state: boolean) => spotify('/me/player/shuffle', { method: 'PUT', query: { state } });

export const setRepeat = (state: RepeatState) => spotify('/me/player/repeat', { method: 'PUT', query: { state } });

export const setVolume = (percent: number) =>
  spotify('/me/player/volume', {
    method: 'PUT',
    query: { volume_percent: Math.min(100, Math.max(0, Math.round(percent))) },
  });

export const getQueue = () => spotify<QueueResponse>('/me/player/queue');

export const getDevices = async () => (await spotify<DevicesResponse>('/me/player/devices'))?.devices ?? [];

export const transferPlayback = (deviceId: string, startPlaying: boolean) =>
  spotify('/me/player', { method: 'PUT', body: { device_ids: [deviceId], play: startPlaying } });

/** Either a context (album, artist, playlist) optionally starting at a track, or a plain list of tracks. */
export type PlayRequest = { contextUri: string; offsetUri?: string } | { uris: string[] };

export const startPlayback = (request: PlayRequest, deviceId?: string) =>
  spotify('/me/player/play', {
    method: 'PUT',
    query: { device_id: deviceId },
    body:
      'uris' in request
        ? { uris: request.uris }
        : { context_uri: request.contextUri, ...(request.offsetUri ? { offset: { uri: request.offsetUri } } : {}) },
  });

export const addToQueue = (uri: string) => spotify('/me/player/queue', { method: 'POST', query: { uri } });

// https://developer.spotify.com/documentation/web-api/reference/search
// Development Mode allows at most 10 results per type.
export const search = (query: string) =>
  spotify<SearchResponse>('/search', { query: { q: query, type: 'track,artist,album,playlist', limit: 10 } });

export const getMyPlaylists = async () =>
  (await spotify<Paging<SimplifiedPlaylist>>('/me/playlists', { query: { limit: 50 } }))?.items ?? [];

export const getRecentlyPlayed = async () =>
  (await spotify<RecentlyPlayedResponse>('/me/player/recently-played', { query: { limit: 50 } }))?.items ?? [];

export const getTopArtists = async () =>
  (await spotify<Paging<Artist>>('/me/top/artists', { query: { limit: 10, time_range: 'short_term' } }))?.items ?? [];

export const getTopTracks = async () =>
  (await spotify<Paging<Track>>('/me/top/tracks', { query: { limit: 10, time_range: 'short_term' } }))?.items ?? [];

// ---------- detail pages ----------

const MAX_DETAIL_PAGES = 4;

/** Follows `next` links (absolute URLs) up to a few pages. */
async function collectPages<T>(first: Paging<T> | null): Promise<T[]> {
  const items = [...(first?.items ?? [])].filter((item): item is T => item !== null);
  let next = first?.next ?? null;
  for (let page = 1; next && page < MAX_DETAIL_PAGES; page++) {
    const response: Paging<T> | null = await spotify<Paging<T>>(next.replace(/^https:\/\/api\.spotify\.com\/v1/, ''));
    items.push(...(response?.items ?? []).filter((item): item is T => item !== null));
    next = response?.next ?? null;
  }
  return items;
}

export const getPlaylist = (id: string) =>
  spotify<FullPlaylist>(`/playlists/${encodeURIComponent(id)}`);

/** Only works for playlists the user owns or collaborates on (403 otherwise). */
export const getPlaylistTracks = async (id: string): Promise<Track[]> => {
  const entries = await collectPages(
    await spotify<Paging<PlaylistEntry>>(`/playlists/${encodeURIComponent(id)}/items`, {
      query: { limit: 50, additional_types: 'track' },
    }),
  );
  return entries
    .map((entry) => entry.item ?? entry.track ?? null)
    .filter((item): item is Track => item?.type === 'track');
};

export const getAlbum = async (id: string) => {
  const album = await spotify<FullAlbum>(`/albums/${encodeURIComponent(id)}`);
  if (!album) return null;
  return { album, tracks: await collectPages(album.tracks) };
};

export const getArtist = (id: string) => spotify<Artist>(`/artists/${encodeURIComponent(id)}`);

export const getArtistAlbums = async (id: string) =>
  (
    await spotify<Paging<SimplifiedAlbum>>(`/artists/${encodeURIComponent(id)}/albums`, {
      query: { include_groups: 'album,single', limit: 10 },
    })
  )?.items.filter((album): album is SimplifiedAlbum => album !== null) ?? [];
