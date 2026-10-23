import { useState } from 'react';
import { MediaList } from '../../components/MediaList';
import type { MediaItem } from '../../lib/media';
import type { PlayerEngine, PlayerSnapshot } from '../../player/engine';
import { usePersonalData, type PersonalData } from '../../player/usePersonalData';
import { useStartItem } from '../../player/useStartItem';
import { ReconnectCard } from './TabParts';

type LibraryTabProps = { player: PlayerEngine; snapshot: PlayerSnapshot; onOpenDetail: (item: MediaItem) => void };

const FILTERS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'albums', label: 'Alben' },
  { id: 'artists', label: 'Künstler' },
  { id: 'shows', label: 'Podcasts' },
  { id: 'audiobooks', label: 'Hörbücher' },
  { id: 'recent', label: 'Zuletzt gehört' },
] as const;

const EMPTY_TEXT: Record<Filter, string> = {
  playlists: 'Noch keine Playlists.',
  albums: 'Noch keine gespeicherten Alben.',
  artists: 'Noch keine Top-Künstler – hör ein bisschen mehr Musik.',
  shows: 'Du folgst noch keinen Podcasts.',
  audiobooks: 'Keine Hörbücher in deiner Bibliothek.',
  recent: 'Noch nichts gehört.',
};

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

      <div className="chips chips--scroll" role="tablist" aria-label="Filter">
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
      {personal.status === 'ready' && itemsFor(personal.data, filter).length === 0 && (
        <p className="sheet__message">{EMPTY_TEXT[filter]}</p>
      )}
      {personal.status === 'ready' && (
        <MediaList
          items={itemsFor(personal.data, filter)}
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

function itemsFor(data: PersonalData, filter: Filter): MediaItem[] {
  switch (filter) {
    case 'playlists':
      return data.playlists;
    case 'albums':
      return data.albums;
    case 'artists':
      return data.topArtists;
    case 'shows':
      return data.shows;
    case 'audiobooks':
      return data.audiobooks;
    case 'recent':
      return data.recentTracks;
  }
}
