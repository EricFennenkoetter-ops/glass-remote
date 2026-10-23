import { GlassButton } from '../../components/GlassButton';
import { Icon } from '../../components/Icon';
import { MediaCarousel, ShortcutGrid } from '../../components/MediaCards';
import type { MediaItem } from '../../lib/media';
import type { PlayerEngine, PlayerSnapshot } from '../../player/engine';
import { usePersonalData } from '../../player/usePersonalData';
import { useStartItem } from '../../player/useStartItem';
import { ReconnectCard, SkeletonCarousel, TabSection } from './TabParts';

type HomeTabProps = {
  player: PlayerEngine;
  snapshot: PlayerSnapshot;
  onOpenDevices: () => void;
  onOpenAppearance: () => void;
  onOpenDetail: (item: MediaItem) => void;
};

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function HomeTab({ player, snapshot, onOpenDevices, onOpenAppearance, onOpenDetail }: HomeTabProps) {
  const personal = usePersonalData();
  const { startingKey, activate } = useStartItem(player, onOpenDetail);
  const playingContextUri = snapshot.playback?.context?.uri ?? null;
  const shared = { startingKey, playingContextUri, onStart: activate };

  const carousel = (title: string, items: MediaItem[]) =>
    items.length > 0 && (
      <TabSection title={title}>
        <MediaCarousel items={items} {...shared} />
      </TabSection>
    );

  return (
    <>
      <header className="tab-header">
        <h1 className="tab-header__title">{greeting()}</h1>
        <div className="tab-header__actions">
          <GlassButton variant="floating" size="s" aria-label="Geräte" onClick={onOpenDevices}>
            <Icon name="devices" size={20} />
          </GlassButton>
          <GlassButton variant="floating" size="s" aria-label="Einstellungen" onClick={onOpenAppearance}>
            <Icon name="settings" size={20} />
          </GlassButton>
        </div>
      </header>

      {snapshot.notice && (
        <div className="notice glass glass--text" role="status">
          {snapshot.notice.message}
        </div>
      )}

      {personal.status === 'missing-scopes' && <ReconnectCard />}
      {personal.status === 'error' && <p className="sheet__message sheet__message--error">{personal.message}</p>}
      {personal.status === 'loading' && (
        <>
          <TabSection title="Zuletzt gehört">
            <SkeletonCarousel />
          </TabSection>
          <TabSection title="Deine Top-Künstler">
            <SkeletonCarousel />
          </TabSection>
        </>
      )}
      {personal.status === 'ready' && (
        <>
          {personal.data.shortcuts.length > 0 && <ShortcutGrid items={personal.data.shortcuts} {...shared} />}
          {carousel('Zuletzt gehört', personal.data.recentContexts)}
          {carousel('Deine Top-Künstler', personal.data.topArtists)}
          {carousel('Gerade oft gehört', personal.data.topTracks)}
          {carousel('Deine Podcasts', personal.data.shows)}
          {carousel('Deine Playlists', personal.data.playlists)}
          {carousel('Gespeicherte Alben', personal.data.albums)}
          {carousel('Deine Hörbücher', personal.data.audiobooks)}
        </>
      )}
    </>
  );
}
