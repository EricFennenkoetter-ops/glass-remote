import { useState } from 'react';
import { MediaList } from '../../components/MediaList';
import type { MediaItem } from '../../lib/media';
import type { PlayerEngine, PlayerSnapshot } from '../../player/engine';
import { usePersonalData } from '../../player/usePersonalData';
import { useStartItem } from '../../player/useStartItem';
import { ReconnectCard } from './TabParts';

type LibraryTabProps = { player: PlayerEngine; snapshot: PlayerSnapshot; onOpenDetail: (item: MediaItem) => void };

const FILTERS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'artists', label: 'Künstler' },
  { id: 'recent', label: 'Zuletzt gehört' },
] as const;

type Filter = (typeof FILTERS)[number]['id'];

export function LibraryTab({ player, snapshot, onOpenDetail }: LibraryTabProps) {
  const personal = usePersonalData();
  const { startingKey, activate } = useStartItem(player, onOpenDetail);
  const [filter, setFilter] = useState<Filter>('playlists');

  return (
    <>
      <header className="tab-header">
        <h1 className="tab-header__title">Bibliothek</h1>
      </header>

      <div className="chips" role="tablist" aria-label="Filter">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`chip${filter === id ? ' is-active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {personal.status === 'missing-scopes' && <ReconnectCard />}
      {personal.status === 'loading' && <p className="sheet__message">Lade deine Bibliothek …</p>}
      {personal.status === 'error' && <p className="sheet__message sheet__message--error">{personal.message}</p>}
      {personal.status === 'ready' && (
        <MediaList
          items={
            filter === 'playlists'
              ? personal.data.playlists
              : filter === 'artists'
                ? personal.data.topArtists
                : personal.data.recentTracks
          }
          startingKey={startingKey}
          playingContextUri={snapshot.playback?.context?.uri ?? null}
          playingItemUri={snapshot.playback?.item?.uri ?? null}
          onStart={activate}
          onQueue={(uri) => void player.addToQueue(uri)}
        />
      )}
    </>
  );
}
