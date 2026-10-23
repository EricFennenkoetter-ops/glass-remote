import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GlassButton } from './GlassButton';
import { Icon } from './Icon';
import { useDragToDismiss, usePresence } from './usePresence';

type SheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Bottom sheet with spring in/out, drag-to-dismiss on the header, Escape and backdrop tap. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const { mounted, visible, unmount } = usePresence(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragHandlers = useDragToDismiss(panelRef, onClose);

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
          if (!open && event.target === event.currentTarget) unmount();
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
