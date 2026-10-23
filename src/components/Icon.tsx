import type { DeviceType } from '../api/types';

const PATHS = {
  play: <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l10.6-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />,
  pause: (
    <>
      <rect x="6" y="4.5" width="4.2" height="15" rx="1.3" />
      <rect x="13.8" y="4.5" width="4.2" height="15" rx="1.3" />
    </>
  ),
  next: (
    <>
      <path d="M3.5 6.3v11.4a.9.9 0 0 0 1.38.76l8.3-5.7a.9.9 0 0 0 0-1.5l-8.3-5.7a.9.9 0 0 0-1.38.74Z" />
      <path d="M11.5 6.3v11.4a.9.9 0 0 0 1.38.76l8.3-5.7a.9.9 0 0 0 0-1.5l-8.3-5.7a.9.9 0 0 0-1.38.74Z" />
    </>
  ),
  previous: (
    <>
      <path d="M20.5 6.3v11.4a.9.9 0 0 1-1.38.76l-8.3-5.7a.9.9 0 0 1 0-1.5l8.3-5.7a.9.9 0 0 1 1.38.74Z" />
      <path d="M12.5 6.3v11.4a.9.9 0 0 1-1.38.76l-8.3-5.7a.9.9 0 0 1 0-1.5l8.3-5.7a.9.9 0 0 1 1.38.74Z" />
    </>
  ),
  shuffle: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 7h3.2c1.6 0 3 .8 3.9 2.1l3.8 5.8c.9 1.3 2.3 2.1 3.9 2.1H21m0 0-2.6-2.6M21 17l-2.6 2.6M3 17h3.2c1.4 0 2.6-.6 3.5-1.6M21 7h-3.2c-1.4 0-2.6.6-3.5 1.6M21 7l-2.6-2.6M21 7l-2.6 2.6"
    />
  ),
  repeat: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17 3.5 19.5 6 17 8.5M4.5 11V9.5A3.5 3.5 0 0 1 8 6h11.5M7 20.5 4.5 18 7 15.5m12.5-2.5v1.5A3.5 3.5 0 0 1 16 18H4.5"
    />
  ),
  queue: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      d="M4 6h12M4 11h12M4 16h7m6-2.5v6m0 0-2.2-2.2M17 19.5l2.2-2.2"
    />
  ),
  home: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
      d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z"
    />
  ),
  library: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      d="M5 4v16M10 4v16m4.5-15.5 4.5 15"
    />
  ),
  chevronRight: (
    <path d="m9.5 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  chevronLeft: (
    <path d="m14.5 6-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.6v-1.9L4.2 8.9l1.7-2.9 2.3.8 1.6-.9.5-2.4Z"
      />
    </>
  ),
  chevronDown: (
    <path d="m6 9.5 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  search: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      d="M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 5 5"
    />
  ),
  addToQueue: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      d="M4 6h11M4 11h11M4 16h7m7-4v8m-4-4h8"
    />
  ),
  devices: (
    <>
      <rect x="3" y="4" width="13" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="15.5" y="9" width="6" height="11" rx="1.6" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth="1.6" />
    </>
  ),
  speaker: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="14.5" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="7" r="1.2" />
    </>
  ),
  smartphone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  computer: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  tv: (
    <>
      <rect x="2.5" y="5" width="19" height="12.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 20.5h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  car: (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      d="M4 15.5V12l1.8-4.6A2 2 0 0 1 7.7 6h8.6a2 2 0 0 1 1.9 1.4L20 12v3.5a1 1 0 0 1-1 1h-1.5v2h-3v-2h-5v2h-3v-2H5a1 1 0 0 1-1-1ZM4.5 12h15"
    />
  ),
  volumeLow: (
    <>
      <path d="M4 9.5h3l4.3-3.6a.8.8 0 0 1 1.3.6v11a.8.8 0 0 1-1.3.6L7 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
      <path d="M16 9.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </>
  ),
  volumeHigh: (
    <>
      <path d="M3 9.5h3l4.3-3.6a.8.8 0 0 1 1.3.6v11a.8.8 0 0 1-1.3.6L6 14.5H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
      <path
        d="M15 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </>
  ),
  close: (
    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  ),
  check: (
    <path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  music: (
    <path d="M9 18.5V6.2a1 1 0 0 1 .8-1l9-1.9a1 1 0 0 1 1.2 1v11.2M9 18.5a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm11-2.9a3 3 0 1 1-3-3 3 3 0 0 1 3 3ZM9 9.5l11-2.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

export function deviceIcon(type: DeviceType): IconName {
  switch (type) {
    case 'Computer':
      return 'computer';
    case 'Smartphone':
    case 'Tablet':
      return 'smartphone';
    case 'TV':
    case 'STB':
    case 'CastVideo':
    case 'GameConsole':
      return 'tv';
    case 'Automobile':
      return 'car';
    default:
      return 'speaker';
  }
}
