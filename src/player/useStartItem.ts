import { useState } from 'react';
import { isPlayable, type MediaItem } from '../lib/media';
import type { PlayerEngine } from './engine';

/**
 * Tap handling for media items: tracks/episodes/chapters start playing, collections open their page.
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
    if (!isPlayable(item) && onOpenDetail) onOpenDetail(item);
    else void start(item);
  };

  return { startingKey, start, activate };
}
