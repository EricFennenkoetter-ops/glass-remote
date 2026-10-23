import { useCallback, useEffect, useState } from 'react';

export type Layer<T> = { id: number; key: string; value: T; ready: boolean };

const MAX_LAYERS = 3;
let nextLayerId = 1;

/**
 * Keeps the previous value on screen until the next one is ready (`markReady`), then removes
 * the older layers once the CSS fade-in (`--motion-duration-crossfade`) has finished.
 */
export function useCrossfade<T>(value: T | null, key: string | null, fadeMs = 650) {
  const [layers, setLayers] = useState<Layer<T>[]>([]);

  useEffect(() => {
    if (value === null || key === null) return;
    setLayers((current) =>
      current.at(-1)?.key === key
        ? current
        : [...current.slice(1 - MAX_LAYERS), { id: nextLayerId++, key, value, ready: false }],
    );
    // A new layer is only created when the key changes.
  }, [key]);

  const markReady = useCallback(
    (id: number) => {
      setLayers((current) => current.map((layer) => (layer.id === id ? { ...layer, ready: true } : layer)));
      window.setTimeout(() => {
        setLayers((current) => {
          const index = current.findIndex((layer) => layer.id === id);
          return index > 0 ? current.slice(index) : current;
        });
      }, fadeMs);
    },
    [fadeMs],
  );

  return { layers, markReady };
}
