import { useEffect, useRef } from 'react';
import { Background } from '../components/Background';
import { useDragToDismiss, usePresence } from '../components/usePresence';
import type { ItemInfo } from '../lib/item';
import type { PlayerEngine, PlayerSnapshot } from '../player/engine';
import { NowPlaying } from './NowPlaying';

type PlayerOverlayProps = {
  open: boolean;
  onClose: () => void;
  snapshot: PlayerSnapshot;
  info: ItemInfo | null;
  player: PlayerEngine;
  onOpenQueue: () => void;
  onOpenDevices: () => void;
};

/** Full-screen player that slides up from the mini player; pull the header down to close. */
export function PlayerOverlay({ open, onClose, ...nowPlaying }: PlayerOverlayProps) {
  const { mounted, visible, unmount } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandlers = useDragToDismiss(panelRef, onClose);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      ref={panelRef}
      className={`player-overlay${visible ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Player"
      onTransitionEnd={(event) => {
        if (!open && event.target === event.currentTarget) unmount();
      }}
    >
      <Background imageUrl={nowPlaying.info?.imageSmall ?? null} paletteSourceUrl={nowPlaying.info?.imageMedium ?? null} />
      <NowPlaying {...nowPlaying} onClose={onClose} dragHandlers={dragHandlers} />
    </div>
  );
}
