import { useEffect, useRef } from 'react';
import { progressAt, type PlayerSnapshot } from '../player/engine';
import { formatTime } from '../lib/format';
import { useSliderDrag } from './useSliderDrag';

type ProgressBarProps = {
  snapshot: PlayerSnapshot;
  disabled: boolean;
  onSeek: (positionMs: number) => void;
};

/**
 * Progress + seek. Runs its own rAF loop and writes to the DOM directly, so the rest of the
 * screen doesn't re-render 60× per second. The fill only animates `transform`.
 */
export function ProgressBar({ snapshot, disabled, onSeek }: ProgressBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef<HTMLSpanElement>(null);
  const remainingRef = useRef<HTMLSpanElement>(null);
  const snapshotRef = useRef(snapshot);
  const scrubMs = useRef<number | null>(null);
  const durationMs = snapshot.playback?.item?.duration_ms ?? 0;

  snapshotRef.current = snapshot;

  const currentMs = () => scrubMs.current ?? progressAt(snapshotRef.current, performance.now());

  const { dragging, handlers } = useSliderDrag(trackRef, {
    disabled: disabled || durationMs === 0,
    getFraction: () => (durationMs ? currentMs() / durationMs : 0),
    onScrub: (fraction) => {
      scrubMs.current = fraction * durationMs;
    },
    onCommit: (fraction) => {
      scrubMs.current = null;
      onSeek(fraction * durationMs);
    },
    onCancel: () => {
      scrubMs.current = null;
    },
    keyboardStep: durationMs ? 10_000 / durationMs : 0.05,
  });

  useEffect(() => {
    let frame = 0;
    let lastFraction = -1;
    let lastElapsed = '';
    let lastRemaining = '';

    const render = () => {
      const root = rootRef.current;
      const duration = snapshotRef.current.playback?.item?.duration_ms ?? 0;
      if (root) {
        const ms = currentMs();
        const fraction = duration ? ms / duration : 0;
        if (Math.abs(fraction - lastFraction) > 0.0004) {
          root.style.setProperty('--fraction', fraction.toFixed(4));
          lastFraction = fraction;
        }
        const elapsed = formatTime(ms);
        const remaining = `-${formatTime(duration - ms)}`;
        if (elapsed !== lastElapsed && elapsedRef.current) {
          elapsedRef.current.textContent = elapsed;
          trackRef.current?.setAttribute('aria-valuenow', String(Math.round(ms / 1000)));
          trackRef.current?.setAttribute('aria-valuetext', `${elapsed} von ${formatTime(duration)}`);
          lastElapsed = elapsed;
        }
        if (remaining !== lastRemaining && remainingRef.current) {
          remainingRef.current.textContent = remaining;
          lastRemaining = remaining;
        }
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
    // Reads everything through refs, so the loop is set up once.
  }, []);

  return (
    <div ref={rootRef} className={`slider slider--progress${dragging ? ' is-dragging' : ''}`}>
      <div
        ref={trackRef}
        className="slider__hit"
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Wiedergabeposition"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-disabled={disabled || undefined}
        {...handlers}
      >
        <div className="slider__track">
          <div className="slider__fill" />
        </div>
      </div>
      <div className="slider__times">
        <span ref={elapsedRef}>0:00</span>
        <span ref={remainingRef}>-0:00</span>
      </div>
    </div>
  );
}
