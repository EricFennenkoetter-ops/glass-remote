import { ApiError } from '../api/client';
import type { PlayRequest } from '../api/player';
import type { AlbumSummary, Artist, Audiobook, Chapter, Episode, Paging, ResumePoint, Show, SimplifiedPlaylist, Track } from '../api/types';
import type { IconName } from '../components/Icon';
import { formatTime } from './format';
import { pickImage } from './item';

/** Anything the user can tap: something playable, or a collection that opens its detail page. */
export type MediaItem = {
  kind: 'track' | 'episode' | 'chapter' | 'album' | 'playlist' | 'artist' | 'show' | 'audiobook' | 'liked';
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
  /** Special artwork without an image (Lieblingssongs). */
  artStyle?: 'liked';
  /** Shown instead of the artwork, e.g. the track number on album pages. */
  leading?: string;
  meta?: string;
  play: PlayRequest;
  /** Used if `play` is rejected (e.g. track not in its album context). */
  fallback?: PlayRequest;
  queueUri?: string;
  /** Playlists: Spotify user id of the owner (to know whether it can be edited). */
  ownerId?: string;
  /** "Album anzeigen" / "Künstler anzeigen" in the … menu. */
  links?: { album?: MediaItem; artist?: MediaItem };
};

/** The real Spotify uri behind an item (tracks/episodes: the item, collections: the context). */
export const spotifyUri = (item: MediaItem) => (isPlayable(item) ? item.key : item.contextUri);

/** https://open.spotify.com/… link for sharing, or null for local-only items (Lieblingssongs). */
export function shareUrl(item: MediaItem): string | null {
  const [scheme, type, id] = spotifyUri(item).split(':');
  return scheme === 'spotify' && type && id ? `https://open.spotify.com/${type}/${id}` : null;
}

function trackLinks(track: Pick<Track, 'artists'> & { album?: Track['album'] }): MediaItem['links'] {
  const artist = track.artists.find((a) => a.uri);
  return {
    album: track.album?.uri ? albumItem(track.album) : undefined,
    artist: artist?.uri ? artistItem({ type: 'artist', uri: artist.uri, name: artist.name, images: [] }) : undefined,
  };
}

export function trackItem(track: Track): MediaItem {
  return {
    kind: 'track',
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
    links: trackLinks(track),
  };
}

export function artistItem(artist: Artist): MediaItem {
  return {
    kind: 'artist',
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
    kind: 'album',
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
    kind: 'playlist',
    key: playlist.uri,
    contextUri: playlist.uri,
    title: playlist.name,
    subtitle: [playlist.owner.display_name, count !== undefined ? `${count} Titel` : null].filter(Boolean).join(' · '),
    image: pickImage(playlist.images ?? [], 60),
    imageLarge: pickImage(playlist.images ?? [], 280),
    placeholderIcon: 'queue',
    play: { contextUri: playlist.uri },
    ownerId: playlist.owner.id,
  };
}

/** A track on a detail page: plays inside that page's context so "next" continues there. */
export function contextTrackItem(
  track: Omit<Track, 'album'> & { album?: Track['album'] },
  contextUri: string,
  leading?: string,
): MediaItem {
  return {
    kind: 'track',
    key: track.uri,
    contextUri,
    title: track.name,
    subtitle: track.artists.map((artist) => artist.name).join(', '),
    image: track.album ? pickImage(track.album.images, 60) : null,
    imageLarge: null,
    placeholderIcon: 'music',
    leading,
    meta: formatTime(track.duration_ms),
    play: { contextUri, offsetUri: track.uri },
    fallback: { uris: [track.uri] },
    queueUri: track.uri,
    links: trackLinks(track),
  };
}

/** Tracks, episodes and chapters play on tap; everything else opens its detail page. */
export const isPlayable = (item: MediaItem) => item.kind === 'track' || item.kind === 'episode' || item.kind === 'chapter';

export const LIKED_SONGS_URI = 'glassremote:liked';

export function likedSongsItem(count: number | null): MediaItem {
  return {
    kind: 'liked',
    key: LIKED_SONGS_URI,
    contextUri: LIKED_SONGS_URI,
    title: 'Lieblingssongs',
    subtitle: count === null ? 'Playlist' : `Playlist · ${count} Titel`,
    image: null,
    imageLarge: null,
    placeholderIcon: 'heartFilled',
    artStyle: 'liked',
    // The detail page plays the loaded songs (Spotify has no context uri for them).
    play: { uris: [] },
  };
}

export function showItem(show: Show): MediaItem {
  return {
    kind: 'show',
    key: show.uri,
    contextUri: show.uri,
    title: show.name,
    subtitle: `Podcast · ${show.publisher}`,
    image: pickImage(show.images, 60),
    imageLarge: pickImage(show.images, 280),
    placeholderIcon: 'podcast',
    play: { contextUri: show.uri },
  };
}

export function audiobookItem(audiobook: Audiobook): MediaItem {
  return {
    kind: 'audiobook',
    key: audiobook.uri,
    contextUri: audiobook.uri,
    title: audiobook.name,
    subtitle: ['Hörbuch', audiobook.authors.map((author) => author.name).join(', ')].filter(Boolean).join(' · '),
    image: pickImage(audiobook.images, 60),
    imageLarge: pickImage(audiobook.images, 280),
    placeholderIcon: 'book',
    play: { contextUri: audiobook.uri },
  };
}

const dateFormat = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });

function formatReleaseDate(date: string | undefined): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : dateFormat.format(parsed);
}

/** "45 Min." / "Noch 12 Min." / "Gehört" */
function listeningState(durationMs: number, resume: ResumePoint | undefined): string {
  if (resume?.fully_played) return 'Gehört';
  const remaining = durationMs - (resume?.resume_position_ms ?? 0);
  const minutes = Math.max(1, Math.round(remaining / 60_000));
  return resume?.resume_position_ms ? `Noch ${minutes} Min.` : `${minutes} Min.`;
}

/**
 * A podcast episode. Inside a show page it plays in the show context (so it continues with the
 * next episode); from search it plays on its own because simplified episodes carry no show.
 */
export function episodeItem(episode: Episode, showUri?: string): MediaItem {
  const images = episode.images.length ? episode.images : (episode.show?.images ?? []);
  return {
    kind: 'episode',
    key: episode.uri,
    contextUri: showUri ?? episode.uri,
    title: episode.name,
    subtitle: [formatReleaseDate(episode.release_date), listeningState(episode.duration_ms, episode.resume_point)]
      .filter(Boolean)
      .join(' · '),
    image: pickImage(images, 60),
    imageLarge: pickImage(images, 280),
    placeholderIcon: 'podcast',
    play: showUri ? { contextUri: showUri, offsetUri: episode.uri } : { uris: [episode.uri] },
    fallback: { uris: [episode.uri] },
    queueUri: episode.uri,
  };
}

export function chapterItem(chapter: Chapter, audiobookUri: string, index: number): MediaItem {
  return {
    kind: 'chapter',
    key: chapter.uri,
    contextUri: audiobookUri,
    title: chapter.name,
    subtitle: listeningState(chapter.duration_ms, chapter.resume_point),
    image: null,
    imageLarge: null,
    placeholderIcon: 'book',
    leading: String(chapter.chapter_number ?? index + 1),
    play: { contextUri: audiobookUri, offsetUri: chapter.uri },
  };
}

/** "spotify:playlist:abc" → "abc" */
export const idFromUri = (uri: string) => uri.split(':').pop() ?? '';

export function present<T>(paging: Paging<T> | undefined): T[] {
  return (paging?.items ?? []).filter(isPresent);
}

export function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function errorMessage(error: unknown, fallback = 'Das hat gerade nicht geklappt.'): string {
  return error instanceof ApiError ? error.message : fallback;
}
