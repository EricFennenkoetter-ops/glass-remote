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
};

function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 5) return 'Gute Nacht';
  if (hour < 11) return 'Guten Morgen';
  if (hour < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function HomeTab({ player, snapshot, onOpenDevices }: HomeTabProps) {
  const personal = usePersonalData();
  const { startingKey, start } = useStartItem(player);
  const playingContextUri = snapshot.playback?.context?.uri ?? null;
  const shared = { startingKey, playingContextUri, onStart: start };

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
        <GlassButton variant="floating" size="s" aria-label="Geräte" onClick={onOpenDevices}>
          <Icon name="devices" size={20} />
        </GlassButton>
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
          {carousel('Deine Playlists', personal.data.playlists)}
        </>
      )}
    </>
  );
}
