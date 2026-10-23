import type { HTMLAttributes } from 'react';
import type { DisallowKey } from '../api/types';
import { Cover } from '../components/Cover';
import { GlassButton } from '../components/GlassButton';
import { deviceIcon, Icon } from '../components/Icon';
import { ProgressBar } from '../components/ProgressBar';
import { VolumeSlider } from '../components/VolumeSlider';
import type { ItemInfo } from '../lib/item';
import { episodeItem, trackItem } from '../lib/media';
import { setSaved, useSaved } from '../player/library';
import { useMediaActions } from '../player/MediaActions';
import type { PlayerEngine, PlayerSnapshot } from '../player/engine';

type NowPlayingProps = {
  snapshot: PlayerSnapshot;
  info: ItemInfo | null;
  player: PlayerEngine;
  onOpenQueue: () => void;
  onOpenDevices: () => void;
  onClose: () => void;
  /** Pull-down-to-close handlers for the header. */
  dragHandlers: HTMLAttributes<HTMLElement>;
};

const REPEAT_LABELS = {
  off: 'Wiederholen aus',
  context: 'Alle wiederholen',
  track: 'Titel wiederholen',
} as const;

export function NowPlaying({ snapshot, info, player, onOpenQueue, onOpenDevices, onClose, dragHandlers }: NowPlayingProps) {
  const playback = snapshot.playback;
  const isAd = playback?.currently_playing_type === 'ad';
  const disallows = playback?.actions?.disallows ?? {};
  const blocked = (key: DisallowKey) => isAd || disallows[key] === true;
  const isPlaying = playback?.is_playing ?? false;
  const device = playback?.device;
  const repeat = playback?.repeat_state ?? 'off';

  const { openMenu } = useMediaActions();
  const playingItem = playback?.item;
  const currentItem =
    isAd || !playingItem
      ? null
      : playingItem.type === 'track'
        ? trackItem(playingItem)
        : playingItem.type === 'episode'
          ? episodeItem(playingItem)
          : null;
  const isSaved = useSaved(currentItem?.key ?? null);

  const title = isAd ? 'Werbung' : (info?.title ?? 'Unbekannter Titel');
  const subtitle = isAd ? 'Gleich geht’s weiter' : (info?.subtitle ?? '');

  return (
    <main className="screen now-playing">
      <header className="top-bar top-bar--player" {...dragHandlers}>
        <div className="top-bar__grabber" aria-hidden="true" />
        <GlassButton variant="floating" size="s" aria-label="Player schließen" onClick={onClose}>
          <Icon name="chevronDown" size={22} />
        </GlassButton>
        <GlassButton variant="floating" size="pill" className="device-pill" onClick={onOpenDevices}>
          <Icon name={device ? deviceIcon(device.type) : 'devices'} size={18} />
          <span className="device-pill__name">{device?.name ?? 'Gerät wählen'}</span>
        </GlassButton>
        <GlassButton variant="floating" size="s" aria-label="Warteschlange" onClick={onOpenQueue}>
          <Icon name="queue" size={20} />
        </GlassButton>
      </header>

      {snapshot.notice && (
        <div className="notice glass glass--text" role="status">
          {snapshot.notice.message}
        </div>
      )}

      <div className="now-playing__art">
        <Cover url={isAd ? null : (info?.imageLarge ?? null)} alt={info ? `Cover: ${info.title}` : ''} />
      </div>

      <section className="player-panel glass glass--text" aria-label="Steuerung">
        <div className="track-info">
          <div className="track-info__text">
            <h1 className="track-info__title">{title}</h1>
            <p className="track-info__subtitle">{subtitle}</p>
          </div>
          {currentItem && (
            <div className="track-info__actions">
              <GlassButton
                variant="plain"
                size="s"
                active={isSaved === true}
                className="heart-button"
                aria-pressed={isSaved === true}
                aria-label={isSaved ? 'Aus Lieblingssongs entfernen' : 'Zu Lieblingssongs hinzufügen'}
                onClick={() => void setSaved(currentItem.key, !isSaved)}
              >
                <Icon name={isSaved ? 'heartFilled' : 'heart'} size={22} />
              </GlassButton>
              <GlassButton variant="plain" size="s" aria-label="Weitere Optionen" onClick={() => openMenu(currentItem)}>
                <Icon name="more" size={22} />
              </GlassButton>
            </div>
          )}
        </div>

        <ProgressBar snapshot={snapshot} disabled={blocked('seeking')} onSeek={player.seekTo} />

        <div className="transport">
          <GlassButton
            variant="plain"
            size="s"
            active={playback?.shuffle_state}
            aria-pressed={playback?.shuffle_state ?? false}
            aria-label="Zufallswiedergabe"
            disabled={blocked('toggling_shuffle')}
            onClick={player.toggleShuffle}
          >
            <Icon name="shuffle" size={20} />
          </GlassButton>
          <GlassButton
            variant="inner"
            size="m"
            aria-label="Zurück"
            disabled={blocked('skipping_prev')}
            onClick={player.previous}
          >
            <Icon name="previous" size={26} />
          </GlassButton>
          <GlassButton
            variant="primary"
            size="l"
            aria-label={isPlaying ? 'Pause' : 'Wiedergabe'}
            disabled={blocked(isPlaying ? 'pausing' : 'resuming')}
            onClick={player.togglePlay}
          >
            <span className={`play-icon${isPlaying ? ' is-playing' : ''}`}>
              <Icon name="play" size={34} className="play-icon__play" />
              <Icon name="pause" size={34} className="play-icon__pause" />
            </span>
          </GlassButton>
          <GlassButton
            variant="inner"
            size="m"
            aria-label="Weiter"
            disabled={blocked('skipping_next')}
            onClick={player.next}
          >
            <Icon name="next" size={26} />
          </GlassButton>
          <GlassButton
            variant="plain"
            size="s"
            active={repeat !== 'off'}
            aria-label={REPEAT_LABELS[repeat]}
            disabled={blocked(repeat === 'context' ? 'toggling_repeat_track' : 'toggling_repeat_context')}
            onClick={player.cycleRepeat}
          >
            <span className="repeat-icon">
              <Icon name="repeat" size={20} />
              {repeat === 'track' && <span className="repeat-icon__badge">1</span>}
            </span>
          </GlassButton>
        </div>

        {device?.supports_volume && device.volume_percent !== null && (
          <VolumeSlider percent={device.volume_percent} onChange={player.changeVolume} />
        )}
      </section>
    </main>
  );
}
