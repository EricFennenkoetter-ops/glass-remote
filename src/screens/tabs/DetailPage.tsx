import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import {
  getAlbum,
  getArtist,
  getArtistAlbums,
  getAudiobook,
  getAudiobookChapters,
  getPlaylist,
  getPlaylistTracks,
  getSavedTracks,
  getShow,
  getShowEpisodes,
  type PlayRequest,
} from '../../api/player';
import { GlassButton } from '../../components/GlassButton';
import { Icon } from '../../components/Icon';
import { MediaCarousel } from '../../components/MediaCards';
import { MediaList } from '../../components/MediaList';
import { pickImage } from '../../lib/item';
import {
  albumItem,
  chapterItem,
  contextTrackItem,
  episodeItem,
  errorMessage,
  idFromUri,
  LIKED_SONGS_URI,
  type MediaItem,
} from '../../lib/media';
import { setSaved, useSaved } from '../../player/library';
import { useMediaActions } from '../../player/MediaActions';
import { cachedLikedTracks, useLibraryVersion } from '../../player/usePersonalData';
import type { PlayerEngine, PlayerSnapshot } from '../../player/engine';
import { useStartItem } from '../../player/useStartItem';
import { TabSection } from './TabParts';

type DetailPageProps = {
  /** The tapped playlist/album/artist – shown immediately while the rest loads. */
  item: MediaItem;
  player: PlayerEngine;
  snapshot: PlayerSnapshot;
  onBack: () => void;
  onOpenDetail: (item: MediaItem) => void;
};

/** Spotify accepts a limited number of uris per play request. */
const MAX_URIS_PER_PLAY = 100;

type DetailContent = {
  image: string | null;
  title: string;
  subtitle: string;
  /** Heading above the list: "12 Titel", "Folgen", "Kapitel". */
  listTitle: string;
  /** Tracks, episodes or chapters. */
  tracks: MediaItem[];
  /** Overrides item.play for ▶︎ (Lieblingssongs have no context uri). */
  playAll?: PlayRequest;
  /** Artist pages: albums & singles. */
  albums: MediaItem[];
  /** Why the track list is empty although the item has tracks (e.g. playlists of other users). */
  tracksUnavailable?: string;
};

type DetailState = { status: 'loading' } | { status: 'ready'; content: DetailContent } | { status: 'error'; message: string };

export function DetailPage({ item, player, snapshot, onBack, onOpenDetail }: DetailPageProps) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const { startingKey, start, activate } = useStartItem(player, onOpenDetail);
  const playback = snapshot.playback;
  const isThisPlaying = playback?.context?.uri === item.contextUri && playback.is_playing;
  const { openMenu, isOwnPlaylist } = useMediaActions();
  const own = isOwnPlaylist(item);
  // Own playlists are always in the library; artists and Lieblingssongs can't be saved via the API.
  const canSave = item.kind !== 'artist' && item.kind !== 'liked' && !own;
  const isSaved = useSaved(canSave ? item.contextUri : null);
  const libraryVersion = useLibraryVersion();

  useEffect(() => {
    let cancelled = false;
    loadDetail(item)
      .then((content) => !cancelled && setState({ status: 'ready', content }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [item, libraryVersion]);

  const content = state.status === 'ready' ? state.content : null;
  const image = content?.image ?? item.imageLarge;

  const playable = content?.playAll ? { ...item, play: content.playAll } : item;
  const canPlayAll = item.kind !== 'liked' || (content?.tracks.length ?? 0) > 0;

  const playAll = () => {
    if (isThisPlaying) player.togglePlay();
    else void start(playable);
  };

  // Start first (there may be no active device yet), then switch shuffle on for the rest.
  const shufflePlay = async () => {
    const wasShuffling = playback?.shuffle_state ?? false;
    await start(playable);
    if (!wasShuffling) player.toggleShuffle();
  };

  return (
    <article className="detail">
      <header className="detail__top">
        <GlassButton variant="floating" size="s" aria-label="Zurück" onClick={onBack}>
          <Icon name="chevronLeft" size={22} />
        </GlassButton>
        <div className="tab-header__actions">
          {canSave && (
            <GlassButton
              variant="floating"
              size="s"
              active={isSaved === true}
              className="heart-button"
              aria-pressed={isSaved === true}
              aria-label={isSaved ? 'Aus Bibliothek entfernen' : 'In Bibliothek speichern'}
              onClick={() => void setSaved(item.contextUri, !isSaved)}
            >
              <Icon name={isSaved ? 'heartFilled' : 'heart'} size={20} />
            </GlassButton>
          )}
          {item.kind !== 'liked' && (
            <GlassButton variant="floating" size="s" aria-label="Weitere Optionen" onClick={() => openMenu(item)}>
              <Icon name="more" size={20} />
            </GlassButton>
          )}
        </div>
      </header>

      <div className="detail__hero">
        <div
          className={`detail__art${item.kind === 'artist' ? ' detail__art--round' : ''}${item.artStyle ? ` art--${item.artStyle}` : ''}`}
        >
          {image ? <img src={image} alt="" /> : <Icon name={item.placeholderIcon} size={56} />}
        </div>
        <h1 className="detail__title">{content?.title ?? item.title}</h1>
        <p className="detail__subtitle">{content?.subtitle ?? item.subtitle}</p>
      </div>

      <div className="detail__actions">
{item.kind !== 'show' && item.kind !== 'audiobook' && (
        <GlassButton
          variant="plain"
          size="m"
          active={playback?.shuffle_state}
          aria-label="Zufällig abspielen"
          onClick={() => void shufflePlay()}
          disabled={startingKey !== null || !canPlayAll}
        >
          <Icon name="shuffle" size={22} />
        </GlassButton>
        )}
        <GlassButton
          variant="primary"
          size="l"
          className="detail__play"
          aria-label={isThisPlaying ? 'Pause' : 'Abspielen'}
          onClick={playAll}
          disabled={startingKey !== null || !canPlayAll}
        >
          {startingKey === item.key ? (
            <span className="spinner" />
          ) : (
            <span className={`play-icon${isThisPlaying ? ' is-playing' : ''}`}>
              <Icon name="play" size={34} className="play-icon__play" />
              <Icon name="pause" size={34} className="play-icon__pause" />
            </span>
          )}
        </GlassButton>
      </div>

      {state.status === 'loading' && <p className="sheet__message">Lade Titel …</p>}
      {state.status === 'error' && <p className="sheet__message sheet__message--error">{state.message}</p>}
      {content?.tracksUnavailable && <p className="sheet__message">{content.tracksUnavailable}</p>}
      {content && content.tracks.length > 0 && (
        <TabSection title={content.listTitle}>
          <MediaList
            items={content.tracks}
            startingKey={startingKey}
            playingItemUri={playback?.item?.uri ?? null}
            onStart={activate}
            menuPlaylist={item.kind === 'playlist' ? item : undefined}
          />
        </TabSection>
      )}
      {content && content.albums.length > 0 && (
        <TabSection title="Alben & Singles">
          <MediaCarousel
            items={content.albums}
            startingKey={startingKey}
            playingContextUri={playback?.context?.uri ?? null}
            onStart={activate}
          />
        </TabSection>
      )}
    </article>
  );
}

async function loadDetail(item: MediaItem): Promise<DetailContent> {
  const id = idFromUri(item.contextUri);

  switch (item.kind) {
    case 'album': {
      const result = await getAlbum(id);
      if (!result) throw new Error('Album nicht gefunden.');
      const { album, tracks } = result;
      return {
        image: pickImage(album.images, 280),
        title: album.name,
        subtitle: [album.artists.map((artist) => artist.name).join(', '), album.release_date.slice(0, 4)]
          .filter(Boolean)
          .join(' · '),
        listTitle: `${tracks.length} Titel`,
        tracks: tracks.map((track) => contextTrackItem(track, album.uri, String(track.track_number))),
        albums: [],
      };
    }

    case 'playlist': {
      const playlist = await getPlaylist(id);
      let tracks: MediaItem[] = [];
      let tracksUnavailable: string | undefined;
      try {
        tracks = (await getPlaylistTracks(id)).map((entry) =>
          entry.type === 'track' ? contextTrackItem(entry, item.contextUri) : episodeItem(entry, item.contextUri),
        );
      } catch (error) {
        if (!(error instanceof ApiError && (error.status === 403 || error.kind === 'restricted'))) throw error;
        // Spotify only returns the contents of playlists you own or collaborate on.
        tracksUnavailable =
          'Spotify zeigt die Titel nur bei eigenen Playlists an. Abspielen funktioniert trotzdem – tippe auf ▶︎.';
      }
      return {
        image: pickImage(playlist?.images ?? [], 280),
        title: playlist?.name ?? item.title,
        subtitle: item.subtitle,
        listTitle: `${tracks.length} Titel`,
        tracks,
        albums: [],
        tracksUnavailable,
      };
    }

    case 'liked': {
      const liked = cachedLikedTracks() ?? (await getSavedTracks());
      const uris = liked.map((track) => track.uri);
      // There's no context uri for Lieblingssongs, so play the list itself (from the tapped song on).
      const tracks = liked.map((track, index) => ({
        ...contextTrackItem(track, LIKED_SONGS_URI),
        play: { uris: uris.slice(index, index + MAX_URIS_PER_PLAY) },
        fallback: undefined,
      }));
      return {
        image: null,
        title: 'Lieblingssongs',
        subtitle: `${liked.length} Titel`,
        listTitle: `${liked.length} Titel`,
        tracks,
        albums: [],
        playAll: { uris: uris.slice(0, MAX_URIS_PER_PLAY) },
      };
    }

    case 'show': {
      const [show, episodes] = await Promise.all([getShow(id), getShowEpisodes(id)]);
      return {
        image: pickImage(show?.images ?? [], 280),
        title: show?.name ?? item.title,
        subtitle: show ? `Podcast · ${show.publisher}` : item.subtitle,
        listTitle: 'Folgen',
        tracks: episodes.map((episode) => episodeItem(episode, item.contextUri)),
        albums: [],
      };
    }

    case 'audiobook': {
      const [audiobook, chapters] = await Promise.all([getAudiobook(id), getAudiobookChapters(id)]);
      return {
        image: pickImage(audiobook?.images ?? [], 280),
        title: audiobook?.name ?? item.title,
        subtitle: audiobook ? `Hörbuch · ${audiobook.authors.map((author) => author.name).join(', ')}` : item.subtitle,
        listTitle: 'Kapitel',
        tracks: chapters.map((chapter, index) => chapterItem(chapter, item.contextUri, index)),
        albums: [],
      };
    }

    default: {
      // Artist: Spotify removed "top tracks" for Development Mode apps, so show albums & singles.
      const [artist, albums] = await Promise.all([getArtist(id), getArtistAlbums(id)]);
      return {
        image: pickImage(artist?.images ?? [], 280),
        title: artist?.name ?? item.title,
        subtitle: 'Künstler',
        listTitle: '',
        tracks: [],
        albums: albums.map(albumItem),
      };
    }
  }
}
