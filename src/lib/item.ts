import type { PlayableItem, SpotifyImage } from '../api/types';

export type ItemInfo = {
  key: string;
  title: string;
  subtitle: string;
  durationMs: number;
  /** ~640px, for the cover */
  imageLarge: string | null;
  /** ~300px, for colour extraction and lists */
  imageMedium: string | null;
  /** ~64px, for list rows and the blurred background */
  imageSmall: string | null;
};

/** Spotify returns images sorted widest first; pick the smallest one that is still ≥ minWidth. */
export function pickImage(images: SpotifyImage[], minWidth: number): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((image) => (image.width ?? 0) >= minWidth) ?? sorted[sorted.length - 1])?.url ?? null;
}

export function describeItem(item: PlayableItem): ItemInfo {
  return {
    key: item.uri,
    title: item.name,
    subtitle: subtitleOf(item),
    durationMs: item.duration_ms,
    imageLarge: pickImage(imagesOf(item), 600),
    imageMedium: pickImage(imagesOf(item), 280),
    imageSmall: pickImage(imagesOf(item), 60),
  };
}

function imagesOf(item: PlayableItem): SpotifyImage[] {
  switch (item.type) {
    case 'track':
      return item.album.images;
    case 'episode':
      return item.images.length ? item.images : (item.show?.images ?? []);
    case 'chapter':
      return item.images?.length ? item.images : (item.audiobook?.images ?? []);
  }
}

function subtitleOf(item: PlayableItem): string {
  switch (item.type) {
    case 'track':
      return item.artists.map((artist) => artist.name).join(', ');
    case 'episode':
      return item.show?.name ?? 'Podcast';
    case 'chapter':
      return item.audiobook?.name ?? 'Hörbuch';
  }
}
