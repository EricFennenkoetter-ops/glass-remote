import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  AuthError,
  completeLoginFromCallback,
  hasAuthCallback,
  isLoggedIn,
  logout,
  subscribeSession,
} from './auth/session';
import { REDIRECT_URI, SPOTIFY_CLIENT_ID } from './config';
import { Background } from './components/Background';
import { GlassButton } from './components/GlassButton';
import { Toasts } from './components/Toasts';
import { describeItem } from './lib/item';
import { usePlayer } from './player/usePlayer';
import { DevicesSheet } from './screens/DevicesSheet';
import { Idle } from './screens/Idle';
import { Login } from './screens/Login';
import { MessageScreen } from './screens/MessageScreen';
import { NowPlaying } from './screens/NowPlaying';
import { QueueSheet } from './screens/QueueSheet';
import { SearchSheet } from './screens/SearchSheet';

// Module level so React StrictMode's double effect can't exchange the one-time code twice.
let callbackExchange: Promise<void> | null = null;

export function App() {
  const loggedIn = useSyncExternalStore(subscribeSession, isLoggedIn);
  const [completingLogin, setCompletingLogin] = useState(hasAuthCallback);
  const [authError, setAuthError] = useState<AuthError | null>(null);

  useEffect(() => {
    if (!completingLogin) return;
    callbackExchange ??= completeLoginFromCallback();
    callbackExchange
      .catch((error: unknown) => {
        setAuthError(error instanceof AuthError ? error : new AuthError('Anmeldung fehlgeschlagen.', 'exchange-failed'));
      })
      .finally(() => setCompletingLogin(false));
  }, [completingLogin]);

  let content;
  if (!SPOTIFY_CLIENT_ID) {
    content = (
      <>
        <Background imageUrl={null} paletteSourceUrl={null} />
        <MessageScreen title="Client ID fehlt">
          <p>
            Lege eine <code>.env</code> mit <code>VITE_SPOTIFY_CLIENT_ID</code> an (siehe <code>.env.example</code>) und
            starte den Build neu.
          </p>
          <p>
            Redirect-URI dieser Seite: <code>{REDIRECT_URI}</code>
          </p>
        </MessageScreen>
      </>
    );
  } else if (completingLogin) {
    content = (
      <>
        <Background imageUrl={null} paletteSourceUrl={null} />
        <main className="screen center-screen">
          <span className="spinner spinner--large" aria-label="Anmeldung wird abgeschlossen" />
        </main>
      </>
    );
  } else if (!loggedIn) {
    content = (
      <>
        <Background imageUrl={null} paletteSourceUrl={null} />
        <Login error={authError} />
      </>
    );
  } else {
    content = <Remote />;
  }

  return (
    <>
      {content}
      <Toasts />
    </>
  );
}

function Remote() {
  const { player, snapshot } = usePlayer();
  const [sheet, setSheet] = useState<'queue' | 'devices' | 'search' | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const openDevices = useCallback(() => setSheet('devices'), []);
  const openQueue = useCallback(() => setSheet('queue'), []);
  const openSearch = useCallback(() => setSheet('search'), []);

  const item = snapshot.playback?.item ?? null;
  const info = useMemo(() => (item ? describeItem(item) : null), [item]);

  let screen;
  if (snapshot.fatal) {
    screen = (
      <MessageScreen
        title="Kein Zugriff"
        actions={
          <GlassButton variant="primary" size="pill" onClick={logout}>
            Abmelden
          </GlassButton>
        }
      >
        <p>{snapshot.fatal.message}</p>
      </MessageScreen>
    );
  } else if (snapshot.status === 'loading') {
    screen = (
      <main className="screen center-screen">
        <span className="spinner spinner--large" aria-label="Lädt" />
      </main>
    );
  } else if (snapshot.status === 'idle') {
    screen = <Idle onOpenDevices={openDevices} onOpenSearch={openSearch} />;
  } else {
    screen = (
      <NowPlaying
        snapshot={snapshot}
        info={info}
        player={player}
        onOpenQueue={openQueue}
        onOpenDevices={openDevices}
        onOpenSearch={openSearch}
      />
    );
  }

  return (
    <>
      <Background imageUrl={info?.imageSmall ?? null} paletteSourceUrl={info?.imageMedium ?? null} />
      {screen}
      <QueueSheet open={sheet === 'queue'} onClose={closeSheet} currentKey={info?.key ?? null} />
      <DevicesSheet open={sheet === 'devices'} onClose={closeSheet} onTransfer={player.transferTo} />
      <SearchSheet open={sheet === 'search'} onClose={closeSheet} player={player} />
    </>
  );
}
