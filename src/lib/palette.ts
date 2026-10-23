export type Palette = {
  /** Dominant colour, slightly toned so it works as a backdrop. */
  primary: string;
  secondary: string;
  tertiary: string;
  /** Light accent for active controls. */
  accent: string;
  /** 0..1 – average relative luminance of the cover, drives the contrast scrim. */
  luminance: number;
};

export const FALLBACK_PALETTE: Palette = {
  primary: '#6d28d9',
  secondary: '#be185d',
  tertiary: '#0f766e',
  accent: '#c4b5fd',
  luminance: 0.2,
};

const SAMPLE_SIZE = 40;
const cache = new Map<string, Promise<Palette>>();

/** Extracts a palette from an image URL. Resolves with FALLBACK_PALETTE if the image can't be read (CORS etc.). */
export function extractPalette(url: string): Promise<Palette> {
  let promise = cache.get(url);
  if (!promise) {
    promise = loadImage(url)
      .then(paletteFromImage)
      .catch(() => FALLBACK_PALETTE);
    cache.set(url, promise);
  }
  return promise;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

type Bucket = { r: number; g: number; b: number; count: number };

function paletteFromImage(image: HTMLImageElement): Palette {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return FALLBACK_PALETTE;
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  // Throws a SecurityError if the image is CORS-tainted → caller falls back.
  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const buckets = new Map<number, Bucket>();
  let luminanceSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    luminanceSum += relativeLuminance(r, g, b);
    // 4 bits per channel → 4096 buckets
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .map(({ r, g, b, count }) => {
      const hsl = rgbToHsl(r / count, g / count, b / count);
      // Prefer frequent, saturated, mid-light colours; near-black/white make dull blobs.
      const lightnessPenalty = hsl.l < 0.08 || hsl.l > 0.92 ? 0.15 : 1;
      return { hsl, score: count * (0.35 + hsl.s) * lightnessPenalty };
    })
    .sort((a, b) => b.score - a.score);

  const picked: Hsl[] = [];
  for (const { hsl } of candidates) {
    if (picked.every((other) => colourDistance(other, hsl) > 0.18)) picked.push(hsl);
    if (picked.length === 3) break;
  }
  const first = picked[0];
  if (!first) return FALLBACK_PALETTE;
  // Monochrome covers: derive companions by rotating the hue.
  while (picked.length < 3) {
    picked.push({ h: (first.h + 0.08 * picked.length) % 1, s: first.s, l: first.l });
  }

  const [primary, secondary, tertiary] = picked.map((c) => toBackdropColour(c)) as [string, string, string];
  return {
    primary,
    secondary,
    tertiary,
    accent: hslToCss({ h: first.h, s: Math.min(1, first.s * 0.9 + 0.1), l: 0.78 }),
    luminance: luminanceSum / (SAMPLE_SIZE * SAMPLE_SIZE),
  };
}

type Hsl = { h: number; s: number; l: number };

/** Blobs must never get so bright that white text on glass loses contrast. */
function toBackdropColour({ h, s, l }: Hsl): string {
  return hslToCss({ h, s: Math.min(0.85, s * 1.15), l: Math.min(0.5, Math.max(0.28, l)) });
}

function colourDistance(a: Hsl, b: Hsl): number {
  const hue = Math.min(Math.abs(a.h - b.h), 1 - Math.abs(a.h - b.h));
  return hue * (a.s + b.s) + Math.abs(a.l - b.l) * 0.6;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h / 6, s, l };
}

function hslToCss({ h, s, l }: Hsl): string {
  return `hsl(${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
}
