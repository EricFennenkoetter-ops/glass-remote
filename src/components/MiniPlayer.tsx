import { useEffect, useRef } from 'react';
import type { ItemInfo } from '../lib/item';
import { progressAt, type PlayerEngine, type PlayerSnapshot } from '../player/engine';
import { deviceIcon, Icon } from './Icon';

type MiniPlayerProps = {
  snapshot: PlayerSnapshot;
  info: ItemInfo | null;
  player: PlayerEngine;
  onOpen: () => void;
  onOpenDevices: () => void;
};

/** Floating glass bar above the tab bar – tap opens the full player (like Spotify). */
export function MiniPlayer({ snapshot, info, player, onOpen, onOpenDevices }: MiniPlayerProps) {
  if (snapshot.status === 'loading') return null;

  if (snapshot.status === 'idle') {
    return (
      <div className="mini-player glass">
        <button type="button" className="mini-player__main" onClick={onOpenDevices}>
          <div className="mini-player__art">
            <Icon name="devices" size={20} />
          </div>
          <div className="mini-player__text">
            <span className="mini-player__title">Gerade läuft nichts</span>
            <span className="mini-player__subtitle">Tippe etwas an oder wähle ein Gerät</span>
          </div>
        </button>
      </div>
    );
  }

  const playback = snapshot.playback;
  const isPlaying = playback?.is_playing ?? false;
  const disallows = playback?.actions?.disallows ?? {};
  const isAd = playback?.currently_playing_type === 'ad';
  const device = playback?.device;

  return (
    <div className="mini-player glass">
      <button type="button" className="mini-player__main" onClick={onOpen} aria-label="Player öffnen">
        <div className="mini-player__art">
          {info?.imageSmall && !isAd ? <img src={info.imageSmall} alt="" /> : <Icon name="music" size={20} />}
        </div>
        <div className="mini-player__text">
          <span className="mini-player__title">{isAd ? 'Werbung' : (info?.title ?? 'Unbekannter Titel')}</span>
          <span className="mini-player__subtitle">
            {device && <Icon name={deviceIcon(device.type)} size={12} className="mini-player__device-icon" />}
            {device ? device.name : info?.subtitle}
            {device && info?.subtitle ? ` · ${info.subtitle}` : ''}
          </span>
        </div>
      </button>
      <button type="button" className="mini-player__button" aria-label="Geräte" onClick={onOpenDevices}>
        <Icon name="devices" size={22} />
      </button>
      <button
        type="button"
        className="mini-player__button"
        aria-label={isPlaying ? 'Pause' : 'Wiedergabe'}
        disabled={isAd || disallows[isPlaying ? 'pausing' : 'resuming'] === true}
        onClick={player.togglePlay}
      >
        <span className={`play-icon play-icon--small${isPlaying ? ' is-playing' : ''}`}>
          <Icon name="play" size={24} className="play-icon__play" />
          <Icon name="pause" size={24} className="play-icon__pause" />
        </span>
      </button>
      <MiniProgress snapshot={snapshot} />
    </div>
  );
}

/** Thin progress line; animated with rAF + transform only. */
function MiniProgress({ snapshot }: { snapshot: PlayerSnapshot }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    let frame = 0;
    const render = () => {
      const current = snapshotRef.current;
      const duration = current.playback?.item?.duration_ms ?? 0;
      const fraction = duration ? progressAt(current, performance.now()) / duration : 0;
      fillRef.current?.style.setProperty('transform', `scaleX(${fraction.toFixed(4)})`);
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="mini-player__progress" aria-hidden="true">
      <div ref={fillRef} className="mini-player__progress-fill" />
    </div>
  );
}
