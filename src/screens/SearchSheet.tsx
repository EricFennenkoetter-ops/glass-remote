import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import { getMyPlaylists, search, type PlayRequest } from '../api/player';
import type { Artist, Paging, SimplifiedAlbum, SimplifiedPlaylist, Track } from '../api/types';
import { hasScopes, startLogin } from '../auth/session';
import { PLAYLIST_SCOPES } from '../config';
import { GlassButton } from '../components/GlassButton';
import { Icon, type IconName } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { formatTime } from '../lib/format';
import { pickImage } from '../lib/item';
import type { PlayerEngine } from '../player/engine';

type SearchSheetProps = {
  open: boolean;
  onClose: () => void;
  player: PlayerEngine;
};

/** One tappable result row; tracks additionally get an "add to queue" button. */
type ResultRow = {
  key: string;
  title: string;
  subtitle: string;
  image: string | null;
  round?: boolean;
  placeholderIcon: IconName;
  meta?: string;
  play: PlayRequest;
  /** Used if `play` is rejected (e.g. track not in its album context). */
  fallback?: PlayRequest;
  queueUri?: string;
};

type Section = { title: string; rows: ResultRow[] };

type ResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; sections: Section[] }
  | { status: 'error'; message: string };

const SEARCH_DEBOUNCE_MS = 300;

export function SearchSheet({ open, onClose, player }: SearchSheetProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResultsState>({ status: 'idle' });
  const [startingKey, setStartingKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!open) return;
    const timeout = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 350);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open || !trimmed) {
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
              { title: 'Titel', rows: present(response?.tracks).map(trackRow) },
              { title: 'Künstler', rows: present(response?.artists).map(artistRow) },
              { title: 'Alben', rows: present(response?.albums).map(albumRow) },
              { title: 'Playlists', rows: present(response?.playlists).map(playlistRow) },
            ].filter((section) => section.rows.length > 0),
          });
        })
        .catch((error: unknown) => {
          if (!cancelled) setResults({ status: 'error', message: errorMessage(error) });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, trimmed]);

  const start = async (row: ResultRow) => {
    setStartingKey(row.key);
    const started = await player.playItem(row.play, row.fallback);
    setStartingKey(null);
    if (started) onClose();
  };

  const toolbar = (
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
        placeholder="Titel, Künstler, Alben, Playlists"
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
  );

  return (
    <Sheet open={open} title="Suchen" onClose={onClose} toolbar={toolbar} size="full">
      {!trimmed && open && <MyPlaylists onStart={start} startingKey={startingKey} />}
      {results.status === 'error' && <p className="sheet__message sheet__message--error">{results.message}</p>}
      {results.status === 'ready' && results.sections.length === 0 && (
        <p className="sheet__message">Nichts gefunden für „{trimmed}“.</p>
      )}
      {results.status === 'ready' &&
        results.sections.map((section) => (
          <ResultSection
            key={section.title}
            section={section}
            startingKey={startingKey}
            onStart={start}
            onQueue={(uri) => void player.addToQueue(uri)}
          />
        ))}
    </Sheet>
  );
}

function MyPlaylists({ onStart, startingKey }: { onStart: (row: ResultRow) => void; startingKey: string | null }) {
  const allowed = hasScopes(PLAYLIST_SCOPES);
  const [state, setState] = useState<ResultsState>({ status: 'loading' });

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    getMyPlaylists()
      .then((playlists) => {
        if (!cancelled) {
          const rows = playlists.filter(isPresent).map(playlistRow);
          setState({ status: 'ready', sections: [{ title: 'Deine Playlists', rows }] });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ status: 'error', message: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed) {
    return (
      <div className="sheet__empty">
        <Icon name="music" size={36} />
        <p>Deine Playlists anzeigen?</p>
        <p className="sheet__hint">Dafür braucht Glass Remote eine zusätzliche Berechtigung. Einmal neu verbinden genügt.</p>
        <GlassButton variant="primary" size="pill" onClick={() => void startLogin()}>
          Neu mit Spotify verbinden
        </GlassButton>
      </div>
    );
  }
  if (state.status === 'loading') return <p className="sheet__message">Lade deine Playlists …</p>;
  if (state.status === 'error') return <p className="sheet__message sheet__message--error">{state.message}</p>;
  if (state.status !== 'ready') return null;
  const section = state.sections[0];
  if (!section || section.rows.length === 0) {
    return <p className="sheet__message">Such nach einem Titel, Künstler, Album oder einer Playlist.</p>;
  }
  return <ResultSection section={section} startingKey={startingKey} onStart={onStart} />;
}

type ResultSectionProps = {
  section: Section;
  startingKey: string | null;
  onStart: (row: ResultRow) => void;
  onQueue?: (uri: string) => void;
};

function ResultSection({ section, startingKey, onStart, onQueue }: ResultSectionProps) {
  return (
    <>
      <h3 className="list-heading">{section.title}</h3>
      <ul className="list">
        {section.rows.map((row) => (
          <li key={row.key} className="list-row list-row--split">
            <button
              type="button"
              className="list-row__main"
              onClick={() => onStart(row)}
              disabled={startingKey !== null}
              aria-label={`${row.title} abspielen`}
            >
              <div className={`list-row__art${row.round ? ' list-row__art--round' : ''}`}>
                {row.image ? <img src={row.image} alt="" loading="lazy" /> : <Icon name={row.placeholderIcon} size={20} />}
              </div>
              <div className="list-row__text">
                <span className="list-row__title">{row.title}</span>
                <span className="list-row__subtitle">{row.subtitle}</span>
              </div>
              {startingKey === row.key ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                row.meta && <span className="list-row__meta">{row.meta}</span>
              )}
            </button>
            {row.queueUri && onQueue && (
              <button
                type="button"
                className="list-row__action"
                aria-label={`${row.title} zur Warteschlange hinzufügen`}
                onClick={() => onQueue(row.queueUri!)}
              >
                <Icon name="addToQueue" size={20} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------- mapping API objects → rows ----------

function trackRow(track: Track): ResultRow {
  return {
    key: track.uri,
    title: track.name,
    subtitle: `${track.artists.map((artist) => artist.name).join(', ')} · ${track.album.name}`,
    image: pickImage(track.album.images, 60),
    placeholderIcon: 'music',
    meta: formatTime(track.duration_ms),
    // In the album context, "next" continues with the album instead of stopping after one song.
    play: { contextUri: track.album.uri, offsetUri: track.uri },
    fallback: { uris: [track.uri] },
    queueUri: track.uri,
  };
}

function artistRow(artist: Artist): ResultRow {
  return {
    key: artist.uri,
    title: artist.name,
    subtitle: 'Künstler',
    image: pickImage(artist.images, 60),
    round: true,
    placeholderIcon: 'music',
    play: { contextUri: artist.uri },
  };
}

function albumRow(album: SimplifiedAlbum): ResultRow {
  const year = album.release_date.slice(0, 4);
  return {
    key: album.uri,
    title: album.name,
    subtitle: [album.album_type === 'single' ? 'Single' : 'Album', year, album.artists[0]?.name].filter(Boolean).join(' · '),
    image: pickImage(album.images, 60),
    placeholderIcon: 'music',
    play: { contextUri: album.uri },
  };
}

function playlistRow(playlist: SimplifiedPlaylist): ResultRow {
  const count = playlist.items?.total ?? playlist.tracks?.total;
  return {
    key: playlist.uri,
    title: playlist.name,
    subtitle: [playlist.owner.display_name, count !== undefined ? `${count} Titel` : null].filter(Boolean).join(' · '),
    image: pickImage(playlist.images ?? [], 60),
    placeholderIcon: 'queue',
    play: { contextUri: playlist.uri },
  };
}

function present<T>(paging: Paging<T> | undefined): T[] {
  return (paging?.items ?? []).filter(isPresent);
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Suche gerade nicht möglich.';
}
