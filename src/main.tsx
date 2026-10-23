import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/base.css';
import './styles/glass.css';
import './styles/app.css';

// iOS ignores user-scalable=no in some contexts; block pinch zoom explicitly.
document.addEventListener('gesturestart', (event) => event.preventDefault());

// Dev-only fake player; must run before the session module reads localStorage.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) {
  const { installDemo } = await import('./dev/demo');
  installDemo();
}

const { App } = await import('./App');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error: unknown) => console.warn('Service worker:', error));
  });
}
