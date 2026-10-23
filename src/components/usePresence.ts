import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

const EXIT_FALLBACK_MS = 700;

/**
 * Mount → next frame `visible` (so the CSS enter transition runs); close → `visible` false,
 * unmount once the exit transition had time to finish.
 */
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timeout = window.setTimeout(() => setMounted(false), EXIT_FALLBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [open]);

  return { mounted, visible, unmount: () => setMounted(false) };
}

const DISMISS_DISTANCE_PX = 110;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * Pull-down-to-dismiss for a panel. Writes `--drag-offset` and `.is-dragging` on the panel;
 * spread the returned handlers on the grab area (header).
 */
export function useDragToDismiss(panelRef: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const drag = useRef<{ startY: number; lastY: number; lastTime: number; velocity: number } | null>(null);

  const setOffset = (px: number | null) => {
    const panel = panelRef.current;
    if (!panel) return;
    if (px === null) {
      panel.style.removeProperty('--drag-offset');
      panel.classList.remove('is-dragging');
    } else {
      panel.style.setProperty('--drag-offset', `${px}px`);
      panel.classList.add('is-dragging');
    }
  };

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if ((event.target as HTMLElement).closest('button, input')) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startY: event.clientY, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const state = drag.current;
      if (!state) return;
      const dt = Math.max(1, event.timeStamp - state.lastTime);
      state.velocity = (event.clientY - state.lastY) / dt;
      state.lastY = event.clientY;
      state.lastTime = event.timeStamp;
      const dy = event.clientY - state.startY;
      // Rubber band when pulled upwards.
      setOffset(dy > 0 ? dy : -Math.sqrt(-dy) * 2);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const state = drag.current;
      drag.current = null;
      if (!state) return;
      const dy = event.clientY - state.startY;
      setOffset(null);
      if (dy > DISMISS_DISTANCE_PX || state.velocity > DISMISS_VELOCITY) onDismiss();
    },
    onPointerCancel() {
      drag.current = null;
      setOffset(null);
    },
  };
}
