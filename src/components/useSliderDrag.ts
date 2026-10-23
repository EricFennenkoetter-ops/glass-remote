import { useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { clamp } from '../lib/format';

type SliderDragOptions = {
  disabled?: boolean;
  /** Current value 0..1, used as start point for keyboard steps. */
  getFraction: () => number;
  onScrub: (fraction: number) => void;
  onCommit: (fraction: number) => void;
  onCancel?: () => void;
  keyboardStep?: number;
};

/** Pointer + keyboard handling for a horizontal slider track. Tapping anywhere on the track jumps there. */
export function useSliderDrag(trackRef: RefObject<HTMLElement | null>, options: SliderDragOptions) {
  const [dragging, setDragging] = useState(false);
  const lastFraction = useRef(0);
  const { disabled, getFraction, onScrub, onCommit, onCancel, keyboardStep = 0.05 } = options;

  const fractionAt = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1);
  };

  const handlers = {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
      lastFraction.current = fractionAt(event.clientX);
      onScrub(lastFraction.current);
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!dragging) return;
      lastFraction.current = fractionAt(event.clientX);
      onScrub(lastFraction.current);
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (!dragging) return;
      setDragging(false);
      onCommit(fractionAt(event.clientX));
    },
    onPointerCancel() {
      if (!dragging) return;
      setDragging(false);
      onCancel?.();
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (disabled) return;
      const deltas: Record<string, number> = {
        ArrowRight: keyboardStep,
        ArrowUp: keyboardStep,
        ArrowLeft: -keyboardStep,
        ArrowDown: -keyboardStep,
        PageUp: keyboardStep * 2,
        PageDown: -keyboardStep * 2,
      };
      let next: number | undefined;
      if (event.key in deltas) next = clamp(getFraction() + (deltas[event.key] ?? 0), 0, 1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = 1;
      if (next === undefined) return;
      event.preventDefault();
      onCommit(next);
    },
  };

  return { dragging, handlers };
}
