import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPlayerEngine, type PlayerEngine, type PlayerSnapshot } from './engine';

export function usePlayer(): { player: PlayerEngine; snapshot: PlayerSnapshot } {
  const [player] = useState(createPlayerEngine);
  const snapshot = useSyncExternalStore(player.subscribe, player.getSnapshot);

  useEffect(() => {
    player.start();
    return player.stop;
  }, [player]);

  return { player, snapshot };
}
