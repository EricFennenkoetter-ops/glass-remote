import { useState } from 'react';
import type { MediaItem } from '../lib/media';
import type { PlayerEngine } from './engine';

/** Starts a tapped item and tracks which one is loading. */
export function useStartItem(player: PlayerEngine) {
  const [startingKey, setStartingKey] = useState<string | null>(null);

  const start = async (item: MediaItem) => {
    setStartingKey(item.key);
    await player.playItem(item.play, item.fallback);
    setStartingKey(null);
  };

  return { startingKey, start };
}
