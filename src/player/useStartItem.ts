import { useState } from 'react';
import type { MediaItem } from '../lib/media';
import type { PlayerEngine } from './engine';

/**
 * Tap handling for media items: tracks start playing, albums/playlists/artists open their page.
 * Also tracks which item is loading.
 */
export function useStartItem(player: PlayerEngine, onOpenDetail?: (item: MediaItem) => void) {
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const start = async (item: MediaItem) => {
    setStartingKey(item.key);
    await player.playItem(item.play, item.fallback);
    setStartingKey(null);
  };

  const activate = (item: MediaItem) => {
    if (item.kind !== 'track' && onOpenDetail) onOpenDetail(item);
    else void start(item);
  };

  return { startingKey, start, activate };
}
