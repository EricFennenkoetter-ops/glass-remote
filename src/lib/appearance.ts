import { useSyncExternalStore } from 'react';

// Per-device look & feel. Stored in localStorage on purpose: it's a personal preference,
// not data that has to sync anywhere.

export const ACCENTS = {
  auto: { label: 'Vom Cover', colour: null },
  green: { label: 'Grün', colour: '#3be477' },
  violet: { label: 'Lila', colour: '#b9a7ff' },
  blue: { label: 'Blau', colour: '#7cc4ff' },
  orange: { label: 'Orange', colour: '#ffb15c' },
  pink: { label: 'Rosa', colour: '#ff8fc7' },
} as const;

export const BACKGROUNDS = {
  cover: 'Cover',
  colors: 'Nur Farben',
  plain: 'Schlicht',
} as const;

export const GLASS_LEVELS = {
  clear: 'Klar',
  regular: 'Normal',
  thick: 'Kräftig',
} as const;

export const APP_ICONS = {
  chrome: 'Chrom',
  signal: 'Signal',
  mint: 'Mint',
  orb: 'Orb',
  violet: 'Lila',
} as const;

export type Appearance = {
  accent: keyof typeof ACCENTS;
  background: keyof typeof BACKGROUNDS;
  glass: keyof typeof GLASS_LEVELS;
  /** Drifting colour blobs in the background. */
  motion: boolean;
  icon: keyof typeof APP_ICONS;
};

const STORAGE_KEY = 'glass-remote.appearance';

export const DEFAULT_APPEARANCE: Appearance = {
  accent: 'auto',
  background: 'cover',
  glass: 'regular',
  motion: true,
  icon: 'chrome',
};

const listeners = new Set<() => void>();
let appearance: Appearance = readAppearance();

function readAppearance(): Appearance {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_APPEARANCE;
    const stored = parsed as Record<string, unknown>;
    const pick = <T extends object>(options: T, value: unknown, fallback: keyof T): keyof T =>
      typeof value === 'string' && value in options ? (value as keyof T) : fallback;
    return {
      accent: pick(ACCENTS, stored.accent, DEFAULT_APPEARANCE.accent),
      background: pick(BACKGROUNDS, stored.background, DEFAULT_APPEARANCE.background),
      glass: pick(GLASS_LEVELS, stored.glass, DEFAULT_APPEARANCE.glass),
      motion: typeof stored.motion === 'boolean' ? stored.motion : DEFAULT_APPEARANCE.motion,
      icon: pick(APP_ICONS, stored.icon, DEFAULT_APPEARANCE.icon),
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Writes the settings onto <html> (data attributes + accent override) and the touch icon. */
export function applyAppearance(value: Appearance = appearance): void {
  const root = document.documentElement;
  root.dataset.glass = value.glass;
  root.dataset.background = value.background;
  root.dataset.motion = value.motion ? 'on' : 'off';
  const accent = ACCENTS[value.accent].colour;
  if (accent) root.style.setProperty('--accent-override', accent);
  else root.style.removeProperty('--accent-override');
  // iOS reads the touch icon when the page is added to the home screen.
  document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.setAttribute('href', `./icons/${value.icon}-180.png`);
}

export function updateAppearance(patch: Partial<Appearance>): void {
  appearance = { ...appearance, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Settings then only last for this session.
  }
  applyAppearance();
  listeners.forEach((listener) => listener());
}

export function useAppearance(): Appearance {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => appearance,
  );
}
