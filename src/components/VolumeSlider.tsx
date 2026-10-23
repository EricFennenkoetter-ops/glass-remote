import { useRef, useState, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { useSliderDrag } from './useSliderDrag';

type VolumeSliderProps = {
  percent: number;
  onChange: (percent: number) => void;
};

export function VolumeSlider({ percent, onChange }: VolumeSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? percent;

  const { dragging, handlers } = useSliderDrag(trackRef, {
    getFraction: () => shown / 100,
    onScrub: (fraction) => {
      setScrub(fraction * 100);
      onChange(fraction * 100);
    },
    onCommit: (fraction) => {
      setScrub(null);
      onChange(fraction * 100);
    },
    onCancel: () => setScrub(null),
  });

  return (
    <div
      className={`slider slider--volume${dragging ? ' is-dragging' : ''}`}
      style={{ '--fraction': (shown / 100).toFixed(3) } as CSSProperties}
    >
      <Icon name="volumeLow" size={18} className="slider__icon" />
      <div
        ref={trackRef}
        className="slider__hit"
        role="slider"
        tabIndex={0}
        aria-label="Lautstärke"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${Math.round(shown)} %`}
        {...handlers}
      >
        <div className="slider__track">
          <div className="slider__fill" />
        </div>
      </div>
      <Icon name="volumeHigh" size={18} className="slider__icon" />
    </div>
  );
}
