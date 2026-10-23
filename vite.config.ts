import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Files from /public that belong to the app shell. */
const PUBLIC_SHELL_FILES = [
  'manifest.webmanifest',
  'apple-touch-icon.png',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/chrome-180.png',
  'icons/signal-180.png',
  'icons/mint-180.png',
  'icons/orb-180.png',
  'icons/violet-180.png',
];

/**
 * Emits sw.js with the hashed build output injected as precache list,
 * plus a build id so every deploy gets a fresh cache.
 */
function serviceWorker(): Plugin {
  return {
    name: 'app-shell-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((file) => !file.endsWith('.map'));
      const precache = ['./', ...[...built, ...PUBLIC_SHELL_FILES].map((file) => `./${file}`)];
      const source = readFileSync(new URL('./sw/sw.js', import.meta.url), 'utf8')
        .replace('__BUILD_ID__', Date.now().toString(36))
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relative base: works on a domain root (Vercel) and on a sub path (GitHub Pages).
  base: './',
  plugins: [react(), serviceWorker()],
  server: {
    // Spotify no longer accepts "localhost" as redirect URI – only the loopback IP.
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
