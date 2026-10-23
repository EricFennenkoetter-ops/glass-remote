import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GlassButton } from './GlassButton';
import { Icon } from './Icon';

type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const DISMISS_DISTANCE_PX = 110;
const DISMISS_VELOCITY = 0.6; // px per ms
const EXIT_FALLBACK_MS = 700;

/** Bottom sheet with spring in/out, drag-to-dismiss on the header, Escape and backdrop tap. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastTime: number; velocity: number } | null>(null);

  // Mount → next frame add .is-open (so the enter transition runs); close → wait for transition, unmount.
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

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted) return null;

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

  const dragHandlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if ((event.target as HTMLElement).closest('button')) return;
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
      if (dy > DISMISS_DISTANCE_PX || state.velocity > DISMISS_VELOCITY) onClose();
    },
    onPointerCancel() {
      drag.current = null;
      setOffset(null);
    },
  };

  return createPortal(
    <div className={`sheet-root${visible ? ' is-open' : ''}`}>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="sheet glass glass--thick"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onTransitionEnd={(event) => {
          if (!open && event.target === event.currentTarget) setMounted(false);
        }}
      >
        <header className="sheet__header" {...dragHandlers}>
          <div className="sheet__grabber" aria-hidden="true" />
          <h2 className="sheet__title">{title}</h2>
          <GlassButton variant="inner" size="s" className="sheet__close" aria-label="Schließen" onClick={onClose}>
            <Icon name="close" size={18} />
          </GlassButton>
        </header>
        <div className="sheet__content">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
