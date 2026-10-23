import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { getAlbum, getArtist, getArtistAlbums, getPlaylist, getPlaylistTracks } from '../../api/player';
import { GlassButton } from '../../components/GlassButton';
import { Icon } from '../../components/Icon';
import { MediaCarousel } from '../../components/MediaCards';
import { MediaList } from '../../components/MediaList';
import { pickImage } from '../../lib/item';
import { albumItem, contextTrackItem, errorMessage, idFromUri, type MediaItem } from '../../lib/media';
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

type DetailContent = {
  image: string | null;
  title: string;
  subtitle: string;
  tracks: MediaItem[];
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

  useEffect(() => {
    let cancelled = false;
    loadDetail(item)
      .then((content) => !cancelled && setState({ status: 'ready', content }))
      .catch((error: unknown) => !cancelled && setState({ status: 'error', message: errorMessage(error) }));
    return () => {
      cancelled = true;
    };
  }, [item]);

  const content = state.status === 'ready' ? state.content : null;
  const image = content?.image ?? item.imageLarge;

  const playAll = () => {
    if (isThisPlaying) player.togglePlay();
    else void start(item);
  };

  // Start first (there may be no active device yet), then switch shuffle on for the rest.
  const shufflePlay = async () => {
    const wasShuffling = playback?.shuffle_state ?? false;
    await start(item);
    if (!wasShuffling) player.toggleShuffle();
  };

  return (
    <article className="detail">
      <header className="detail__top">
        <GlassButton variant="floating" size="s" aria-label="Zurück" onClick={onBack}>
          <Icon name="chevronLeft" size={22} />
        </GlassButton>
      </header>

      <div className="detail__hero">
        <div className={`detail__art${item.kind === 'artist' ? ' detail__art--round' : ''}`}>
          {image ? <img src={image} alt="" /> : <Icon name={item.placeholderIcon} size={56} />}
        </div>
        <h1 className="detail__title">{content?.title ?? item.title}</h1>
        <p className="detail__subtitle">{content?.subtitle ?? item.subtitle}</p>
      </div>

      <div className="detail__actions">
        <GlassButton
          variant="plain"
          size="m"
          active={playback?.shuffle_state}
          aria-label="Zufällig abspielen"
          onClick={() => void shufflePlay()}
          disabled={startingKey !== null}
        >
          <Icon name="shuffle" size={22} />
        </GlassButton>
        <GlassButton
          variant="primary"
          size="l"
          className="detail__play"
          aria-label={isThisPlaying ? 'Pause' : 'Abspielen'}
          onClick={playAll}
          disabled={startingKey !== null}
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
        <TabSection title={item.kind === 'artist' ? 'Beliebt' : `${content.tracks.length} Titel`}>
          <MediaList
            items={content.tracks}
            startingKey={startingKey}
            playingItemUri={playback?.item?.uri ?? null}
            onStart={activate}
            onQueue={(uri) => void player.addToQueue(uri)}
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

  if (item.kind === 'album') {
    const result = await getAlbum(id);
    if (!result) throw new Error('Album nicht gefunden.');
    const { album, tracks } = result;
    return {
      image: pickImage(album.images, 280),
      title: album.name,
      subtitle: [album.artists.map((artist) => artist.name).join(', '), album.release_date.slice(0, 4)]
        .filter(Boolean)
        .join(' · '),
      tracks: tracks.map((track) => contextTrackItem(track, album.uri, String(track.track_number))),
      albums: [],
    };
  }

  if (item.kind === 'playlist') {
    const playlist = await getPlaylist(id);
    let tracks: MediaItem[] = [];
    let tracksUnavailable: string | undefined;
    try {
      tracks = (await getPlaylistTracks(id)).map((track) => contextTrackItem(track, item.contextUri));
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
      tracks,
      albums: [],
      tracksUnavailable,
    };
  }

  // Artist: Spotify removed "top tracks" for Development Mode apps, so show albums & singles.
  const [artist, albums] = await Promise.all([getArtist(id), getArtistAlbums(id)]);
  return {
    image: pickImage(artist?.images ?? [], 280),
    title: artist?.name ?? item.title,
    subtitle: 'Künstler',
    tracks: [],
    albums: albums.map(albumItem),
  };
}
