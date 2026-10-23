import { ApiError } from '../api/client';
import type { PlayRequest } from '../api/player';
import type { AlbumSummary, Artist, Paging, SimplifiedPlaylist, Track } from '../api/types';
import type { IconName } from '../components/Icon';
import { formatTime } from './format';
import { pickImage } from './item';

/** Anything the user can tap to play: a track, album, artist or playlist. */
export type MediaItem = {
  key: string;
  /** The context this item starts (album/playlist/artist uri), used to highlight what's playing. */
  contextUri: string;
  title: string;
  subtitle: string;
  image: string | null;
  /** Bigger image for cards. */
  imageLarge: string | null;
  round?: boolean;
  placeholderIcon: IconName;
  meta?: string;
  play: PlayRequest;
  /** Used if `play` is rejected (e.g. track not in its album context). */
  fallback?: PlayRequest;
  queueUri?: string;
};

export function trackItem(track: Track): MediaItem {
  return {
    key: track.uri,
    contextUri: track.album.uri,
    title: track.name,
    subtitle: `${track.artists.map((artist) => artist.name).join(', ')} · ${track.album.name}`,
    image: pickImage(track.album.images, 60),
    imageLarge: pickImage(track.album.images, 280),
    placeholderIcon: 'music',
    meta: formatTime(track.duration_ms),
    // In the album context, "next" continues with the album instead of stopping after one song.
    play: { contextUri: track.album.uri, offsetUri: track.uri },
    fallback: { uris: [track.uri] },
    queueUri: track.uri,
  };
}

export function artistItem(artist: Artist): MediaItem {
  return {
    key: artist.uri,
    contextUri: artist.uri,
    title: artist.name,
    subtitle: 'Künstler',
    image: pickImage(artist.images, 60),
    imageLarge: pickImage(artist.images, 280),
    round: true,
    placeholderIcon: 'music',
    play: { contextUri: artist.uri },
  };
}

export function albumItem(album: AlbumSummary): MediaItem {
  const kind = album.album_type === 'single' ? 'Single' : 'Album';
  return {
    key: album.uri,
    contextUri: album.uri,
    title: album.name,
    subtitle: [kind, album.release_date?.slice(0, 4), album.artists?.[0]?.name].filter(Boolean).join(' · '),
    image: pickImage(album.images, 60),
    imageLarge: pickImage(album.images, 280),
    placeholderIcon: 'music',
    play: { contextUri: album.uri },
  };
}

export function playlistItem(playlist: SimplifiedPlaylist): MediaItem {
  const count = playlist.items?.total ?? playlist.tracks?.total;
  return {
    key: playlist.uri,
    contextUri: playlist.uri,
    title: playlist.name,
    subtitle: [playlist.owner.display_name, count !== undefined ? `${count} Titel` : null].filter(Boolean).join(' · '),
    image: pickImage(playlist.images ?? [], 60),
    imageLarge: pickImage(playlist.images ?? [], 280),
    placeholderIcon: 'queue',
    play: { contextUri: playlist.uri },
  };
}

export function present<T>(paging: Paging<T> | undefined): T[] {
  return (paging?.items ?? []).filter(isPresent);
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function errorMessage(error: unknown, fallback = 'Das hat gerade nicht geklappt.'): string {
  return error instanceof ApiError ? error.message : fallback;
}
