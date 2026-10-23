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
import { MiniPlayer } from './components/MiniPlayer';
import { TabBar, type TabId } from './components/TabBar';
import { DevicesSheet } from './screens/DevicesSheet';
import { Login } from './screens/Login';
import { MessageScreen } from './screens/MessageScreen';
import { PlayerOverlay } from './screens/PlayerOverlay';
import { QueueSheet } from './screens/QueueSheet';
import { HomeTab } from './screens/tabs/HomeTab';
import { LibraryTab } from './screens/tabs/LibraryTab';
import { SearchTab } from './screens/tabs/SearchTab';

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
  const [tab, setTab] = useState<TabId>('home');
  const [sheet, setSheet] = useState<'queue' | 'devices' | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const closeSheet = useCallback(() => {
    setSheet(null);
    player.cancelDeviceChoice();
  }, [player]);
  const openDevices = useCallback(() => setSheet('devices'), []);
  const openQueue = useCallback(() => setSheet('queue'), []);
  const closePlayer = useCallback(() => setPlayerOpen(false), []);

  const item = snapshot.playback?.item ?? null;
  const info = useMemo(() => (item ? describeItem(item) : null), [item]);

  // Something should start but nothing is active and several devices are available → let the user pick.
  useEffect(() => {
    if (snapshot.needsDeviceChoice) setSheet('devices');
  }, [snapshot.needsDeviceChoice]);

  if (snapshot.fatal) {
    return (
      <>
        <Background imageUrl={null} paletteSourceUrl={null} />
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
      </>
    );
  }

  return (
    <>
      <Background imageUrl={info?.imageSmall ?? null} paletteSourceUrl={info?.imageMedium ?? null} />
      <div className="tabs-dim" aria-hidden="true" />
      <main className={`tab-screen${snapshot.status === 'loading' ? '' : ' has-mini-player'}`} key={tab}>
        {tab === 'home' && <HomeTab player={player} snapshot={snapshot} onOpenDevices={openDevices} />}
        {tab === 'search' && <SearchTab player={player} snapshot={snapshot} />}
        {tab === 'library' && <LibraryTab player={player} snapshot={snapshot} />}
      </main>
      <div className="bottom-chrome">
        <MiniPlayer
          snapshot={snapshot}
          info={info}
          player={player}
          onOpen={() => setPlayerOpen(true)}
          onOpenDevices={openDevices}
        />
        <TabBar active={tab} onChange={setTab} />
      </div>
      <PlayerOverlay
        open={playerOpen && snapshot.status === 'active'}
        onClose={closePlayer}
        snapshot={snapshot}
        info={info}
        player={player}
        onOpenQueue={openQueue}
        onOpenDevices={openDevices}
      />
      <QueueSheet open={sheet === 'queue'} onClose={closeSheet} currentKey={info?.key ?? null} />
      <DevicesSheet
        open={sheet === 'devices'}
        choosingForPlayback={snapshot.needsDeviceChoice}
        onClose={closeSheet}
        onSelect={player.useDevice}
      />
    </>
  );
}
