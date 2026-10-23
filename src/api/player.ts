import { spotify } from './client';
import type {
  DevicesResponse,
  Paging,
  PlaybackState,
  QueueResponse,
  RepeatState,
  SearchResponse,
  SimplifiedPlaylist,
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
