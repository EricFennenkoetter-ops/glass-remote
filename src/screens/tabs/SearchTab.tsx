import { useEffect, useRef, useState } from 'react';
import { search } from '../../api/player';
import { Icon } from '../../components/Icon';
import { MediaList } from '../../components/MediaList';
import { albumItem, artistItem, errorMessage, playlistItem, present, trackItem, type MediaItem } from '../../lib/media';
import type { PlayerEngine, PlayerSnapshot } from '../../player/engine';
import { usePersonalData } from '../../player/usePersonalData';
import { useStartItem } from '../../player/useStartItem';
import { TabSection } from './TabParts';

type SearchTabProps = { player: PlayerEngine; snapshot: PlayerSnapshot; onOpenDetail: (item: MediaItem) => void };

type Section = { title: string; items: MediaItem[] };

type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; sections: Section[] }
  | { status: 'error'; message: string };

const SEARCH_DEBOUNCE_MS = 300;

// Kept across tab switches, like Spotify does.
let lastQuery = '';

export function SearchTab({ player, snapshot, onOpenDetail }: SearchTabProps) {
  const [query, setQuery] = useState(lastQuery);
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const { startingKey, activate } = useStartItem(player, onOpenDetail);
  const playingItemUri = snapshot.playback?.item?.uri ?? null;
  const personal = usePersonalData();
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const playingContextUri = snapshot.playback?.context?.uri ?? null;
  const onQueue = (uri: string) => void player.addToQueue(uri);

  useEffect(() => {
    lastQuery = query;
  }, [query]);

  useEffect(() => {
    if (!trimmed) {
      setResults({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setResults((current) => (current.status === 'ready' ? current : { status: 'loading' }));
    const timeout = window.setTimeout(() => {
      search(trimmed)
        .then((response) => {
          if (cancelled) return;
          setResults({
            status: 'ready',
            sections: [
              { title: 'Titel', items: present(response?.tracks).map(trackItem) },
              { title: 'Künstler', items: present(response?.artists).map(artistItem) },
              { title: 'Alben', items: present(response?.albums).map(albumItem) },
              { title: 'Playlists', items: present(response?.playlists).map(playlistItem) },
            ].filter((section) => section.items.length > 0),
          });
        })
        .catch((error: unknown) => {
          if (!cancelled) setResults({ status: 'error', message: errorMessage(error, 'Suche gerade nicht möglich.') });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [trimmed]);

  return (
    <>
      <header className="tab-header">
        <h1 className="tab-header__title">Suchen</h1>
      </header>

      <form
        className="search-field"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          inputRef.current?.blur(); // hides the iOS keyboard so the results are visible
        }}
      >
        <Icon name="search" size={18} className="search-field__icon" />
        <input
          ref={inputRef}
          type="search"
          enterKeyHint="search"
          placeholder="Was willst du hören?"
          aria-label="Spotify durchsuchen"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {results.status === 'loading' && <span className="spinner search-field__spinner" aria-label="Sucht …" />}
        {query && results.status !== 'loading' && (
          <button
            type="button"
            className="search-field__clear"
            aria-label="Suche leeren"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </form>

      {!trimmed && personal.status === 'ready' && personal.data.recentTracks.length > 0 && (
        <TabSection title="Zuletzt gehört">
          <MediaList
            items={personal.data.recentTracks}
            startingKey={startingKey}
            playingItemUri={playingItemUri}
            onStart={activate}
            onQueue={onQueue}
          />
        </TabSection>
      )}
      {results.status === 'error' && <p className="sheet__message sheet__message--error">{results.message}</p>}
      {results.status === 'ready' && results.sections.length === 0 && (
        <p className="sheet__message">Nichts gefunden für „{trimmed}“.</p>
      )}
      {results.status === 'ready' &&
        results.sections.map((section) => (
          <TabSection key={section.title} title={section.title}>
            <MediaList
              items={section.items}
              startingKey={startingKey}
              playingContextUri={playingContextUri}
              playingItemUri={playingItemUri}
              onStart={activate}
              onQueue={onQueue}
            />
          </TabSection>
        ))}
    </>
  );
}
