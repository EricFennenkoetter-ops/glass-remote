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
function pickImage(images: SpotifyImage[], minWidth: number): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((image) => (image.width ?? 0) >= minWidth) ?? sorted[sorted.length - 1])?.url ?? null;
}

export function describeItem(item: PlayableItem): ItemInfo {
  const images = item.type === 'track' ? item.album.images : item.images.length ? item.images : item.show.images;
  return {
    key: item.uri,
    title: item.name,
    subtitle: item.type === 'track' ? item.artists.map((artist) => artist.name).join(', ') : item.show.name,
    durationMs: item.duration_ms,
    imageLarge: pickImage(images, 600),
    imageMedium: pickImage(images, 280),
    imageSmall: pickImage(images, 60),
  };
}
