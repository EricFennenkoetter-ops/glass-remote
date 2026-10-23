// Subset of the Spotify Web API objects this app reads.
// https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback

export type SpotifyImage = { url: string; width: number | null; height: number | null };

/** The album fields this app reads; both track.album and search album results have them. */
export type AlbumSummary = {
  uri: string;
  name: string;
  images: SpotifyImage[];
  artists?: { name: string }[];
  album_type?: string;
  release_date?: string;
};

export type Track = {
  type: 'track';
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: AlbumSummary;
};

export type ResumePoint = { fully_played: boolean; resume_position_ms: number };

/** Podcast episode. `show` is missing on simplified episodes (search results, show pages). */
export type Episode = {
  type: 'episode';
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  release_date?: string;
  images: SpotifyImage[];
  resume_point?: ResumePoint;
  show?: { name: string; publisher: string; images: SpotifyImage[] };
};

/** Audiobook chapter. The player reports it while an audiobook plays. */
export type Chapter = {
  type: 'chapter';
  uri: string;
  name: string;
  duration_ms: number;
  chapter_number?: number;
  images?: SpotifyImage[];
  resume_point?: ResumePoint;
  audiobook?: { name: string; images: SpotifyImage[] };
};

export type PlayableItem = Track | Episode | Chapter;

export type Show = {
  type: 'show';
  uri: string;
  name: string;
  publisher: string;
  images: SpotifyImage[];
  total_episodes?: number;
};

export type Audiobook = {
  type: 'audiobook';
  uri: string;
  name: string;
  authors: { name: string }[];
  images: SpotifyImage[];
  total_chapters?: number;
};

export type DeviceType =
  | 'Computer'
  | 'Tablet'
  | 'Smartphone'
  | 'Speaker'
  | 'TV'
  | 'AVR'
  | 'STB'
  | 'AudioDongle'
  | 'GameConsole'
  | 'CastVideo'
  | 'CastAudio'
  | 'Automobile'
  | 'Unknown'
  | (string & {});

export type Device = {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: DeviceType;
  volume_percent: number | null;
  supports_volume: boolean;
};

export type RepeatState = 'off' | 'context' | 'track';

export type PlaybackState = {
  device: Device;
  repeat_state: RepeatState;
  shuffle_state: boolean;
  timestamp: number;
  progress_ms: number | null;
  is_playing: boolean;
  item: PlayableItem | null;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
  /** Album, playlist, artist … the item is played from; null for single tracks. */
  context: { uri: string; type: string } | null;
  actions?: { disallows?: Partial<Record<DisallowKey, boolean>> };
};

export type DisallowKey =
  | 'interrupting_playback'
  | 'pausing'
  | 'resuming'
  | 'seeking'
  | 'skipping_next'
  | 'skipping_prev'
  | 'toggling_repeat_context'
  | 'toggling_shuffle'
  | 'toggling_repeat_track'
  | 'transferring_playback';

export type QueueResponse = {
  currently_playing: PlayableItem | null;
  queue: PlayableItem[];
};

export type DevicesResponse = { devices: Device[] };

export type SimplifiedAlbum = {
  type: 'album';
  uri: string;
  name: string;
  album_type: string;
  release_date: string;
  artists: { name: string }[];
  images: SpotifyImage[];
};

export type Artist = {
  type: 'artist';
  uri: string;
  name: string;
  images: SpotifyImage[];
};

export type SimplifiedPlaylist = {
  type: 'playlist';
  uri: string;
  name: string;
  images: SpotifyImage[] | null;
  owner: { display_name: string | null };
  /** Current field for the item count; `tracks` is the deprecated predecessor. */
  items?: { total: number };
  tracks?: { total: number };
};

/** Spotify can return null entries for unavailable items. */
export type Paging<T> = { items: (T | null)[]; total: number; next: string | null };

export type SearchResponse = {
  tracks?: Paging<Track>;
  artists?: Paging<Artist>;
  albums?: Paging<SimplifiedAlbum>;
  playlists?: Paging<SimplifiedPlaylist>;
  shows?: Paging<Show>;
  episodes?: Paging<Episode>;
  audiobooks?: Paging<Audiobook>;
};

export type RecentlyPlayedResponse = {
  items: { track: Track; played_at: string; context: { uri: string; type: string } | null }[];
};

/** Track inside an album response – no album object of its own. */
export type SimplifiedTrack = Omit<Track, 'album'> & { track_number: number };

export type FullAlbum = SimplifiedAlbum & { tracks: Paging<SimplifiedTrack> };

/** Since Feb 2026 the track/episode lives under `item`; `track` is the deprecated alias. */
export type PlaylistEntry = { item?: PlayableItem | null; track?: PlayableItem | null };

export type FullPlaylist = SimplifiedPlaylist & { description: string | null };

export type SavedTrack = { added_at: string; track: Track };
export type SavedAlbum = { added_at: string; album: SimplifiedAlbum };
export type SavedShow = { added_at: string; show: Show };
