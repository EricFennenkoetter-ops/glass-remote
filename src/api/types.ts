// Subset of the Spotify Web API objects this app reads.
// https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback

export type SpotifyImage = { url: string; width: number | null; height: number | null };

export type Track = {
  type: 'track';
  id: string | null;
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
};

export type Episode = {
  type: 'episode';
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  images: SpotifyImage[];
  show: { name: string; publisher: string; images: SpotifyImage[] };
};

export type PlayableItem = Track | Episode;

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
