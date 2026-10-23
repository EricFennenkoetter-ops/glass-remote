import { useEffect, useState } from 'react';
import { extractPalette, FALLBACK_PALETTE, type Palette } from '../lib/palette';
import { useCrossfade } from './useCrossfade';

type BackgroundProps = {
  /** Small cover (≈64 px) – upscaled and blurred, so a tiny file is enough. */
  imageUrl: string | null;
  /** Medium cover (≈300 px) used for colour extraction. */
  paletteSourceUrl: string | null;
};

type Scene = { image: string | null; palette: Palette };

/**
 * The backdrop that shows through all glass: blurred cover, three slowly drifting colour blobs
 * and a contrast scrim whose strength follows the cover's brightness.
 */
export function Background({ imageUrl, paletteSourceUrl }: BackgroundProps) {
  const [scene, setScene] = useState<{ key: string; scene: Scene }>({
    key: 'fallback',
    scene: { image: null, palette: FALLBACK_PALETTE },
  });

  useEffect(() => {
    let cancelled = false;
    const key = imageUrl ?? 'fallback';
    const resolve = paletteSourceUrl ? extractPalette(paletteSourceUrl) : Promise.resolve(FALLBACK_PALETTE);
    void resolve.then((palette) => {
      if (!cancelled) setScene({ key, scene: { image: imageUrl, palette } });
    });
    return () => {
      cancelled = true;
    };
  }, [imageUrl, paletteSourceUrl]);

  useEffect(() => {
    const { palette } = scene.scene;
    const root = document.documentElement.style;
    root.setProperty('--palette-accent', palette.accent);
    // Brighter covers → darker scrim, so white labels keep ≥ 4.5:1 on the glass.
    root.setProperty('--scrim-strength', Math.min(0.62, 0.3 + palette.luminance * 0.6).toFixed(3));
  }, [scene]);

  const { layers, markReady } = useCrossfade(scene.scene, scene.key);

  return (
    <div className="backdrop" aria-hidden="true">
      {layers.map((layer) => (
        <div key={layer.id} className={`backdrop__layer${layer.ready ? ' is-ready' : ''}`}>
          {layer.value.image ? (
            <img
              className="backdrop__cover"
              src={layer.value.image}
              alt=""
              onLoad={() => markReady(layer.id)}
              onError={() => markReady(layer.id)}
            />
          ) : (
            <BackdropReady onReady={() => markReady(layer.id)} />
          )}
          <div className="backdrop__blob backdrop__blob--1" style={{ background: blob(layer.value.palette.primary) }} />
          <div className="backdrop__blob backdrop__blob--2" style={{ background: blob(layer.value.palette.secondary) }} />
          <div className="backdrop__blob backdrop__blob--3" style={{ background: blob(layer.value.palette.tertiary) }} />
        </div>
      ))}
      <div className="backdrop__scrim" />
    </div>
  );
}

/** Soft-edged blob via gradient instead of a blur filter – much cheaper to animate. */
const blob = (colour: string) => `radial-gradient(closest-side, ${colour}, transparent)`;

function BackdropReady({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    const frame = requestAnimationFrame(onReady);
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}
