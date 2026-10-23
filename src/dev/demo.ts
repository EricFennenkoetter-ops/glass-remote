// Dev-only (`npm run dev`, then open /?demo): a fake Spotify player behind window.fetch so the UI
// can be tried without an account. Never included in production builds.
import type { Device, PlaybackState, RepeatState, Track } from '../api/types';

type DemoTrack = { name: string; artist: string; album: string; durationMs: number; colours: [string, string, string] };

const TRACKS: DemoTrack[] = [
  { name: 'Glasshouse Drift', artist: 'Aurora Static', album: 'Refraction', durationMs: 214_000, colours: ['#7c3aed', '#db2777', '#0ea5e9'] },
  { name: 'Salt & Sodium', artist: 'The Lumen Club', album: 'Daylight Hours', durationMs: 187_000, colours: ['#fde68a', '#fb923c', '#fef3c7'] },
  { name: 'Night Ferry', artist: 'Okapi Harbour', album: 'Low Tide', durationMs: 263_000, colours: ['#0f766e', '#134e4a', '#22d3ee'] },
  { name: 'Velvet Engine', artist: 'Mira Kova', album: 'Pulse Atlas', durationMs: 198_000, colours: ['#dc2626', '#1e1b4b', '#f97316'] },
];

function coverDataUrl([a, b, c]: [string, string, string], size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, a);
  gradient.addColorStop(1, b);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(size * 0.68, size * 0.36, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#fff';
  ctx.fillRect(size * 0.12, size * 0.7, size * 0.5, size * 0.04);
  return canvas.toDataURL('image/png');
}

function toTrack(track: DemoTrack, index: number): Track {
  const large = coverDataUrl(track.colours, 640);
  const medium = coverDataUrl(track.colours, 300);
  const small = coverDataUrl(track.colours, 64);
  return {
    type: 'track',
    id: `demo${index}`,
    uri: `spotify:track:demo${index}`,
    name: track.name,
    duration_ms: track.durationMs,
    artists: [{ name: track.artist }],
    album: {
      uri: `spotify:album:demo${index}`,
      name: track.album,
      images: [
        { url: large, width: 640, height: 640 },
        { url: medium, width: 300, height: 300 },
        { url: small, width: 64, height: 64 },
      ],
    },
  };
}

export function installDemo(): void {
  localStorage.setItem(
    'glass-remote.tokens',
    JSON.stringify({
      accessToken: 'demo',
      refreshToken: 'demo',
      expiresAt: Date.now() + 365 * 24 * 3600_000,
      scope:
        'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative user-read-recently-played user-top-read',
    }),
  );

  const tracks = TRACKS.map(toTrack);
  const devices: Device[] = [
    { id: 'iphone', is_active: true, is_private_session: false, is_restricted: false, name: 'iPhone', type: 'Smartphone', volume_percent: null, supports_volume: false },
    { id: 'mac', is_active: false, is_private_session: false, is_restricted: false, name: 'MacBook Pro', type: 'Computer', volume_percent: 64, supports_volume: true },
    { id: 'kitchen', is_active: false, is_private_session: false, is_restricted: false, name: 'Küche', type: 'Speaker', volume_percent: 40, supports_volume: true },
  ];
  const state = {
    index: 0,
    playing: true,
    progress: 42_000,
    since: Date.now(),
    shuffle: false,
    repeat: 'off' as RepeatState,
    deviceId: 'iphone',
    contextUri: null as string | null,
  };

  const progress = () => {
    const track = tracks[state.index]!;
    const value = state.playing ? state.progress + (Date.now() - state.since) : state.progress;
    if (value >= track.duration_ms) {
      state.index = (state.index + 1) % tracks.length;
      state.progress = 0;
      state.since = Date.now();
      return 0;
    }
    return value;
  };
  const freeze = () => {
    state.progress = progress();
    state.since = Date.now();
  };
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  const empty = () => new Response(null, { status: 204 });

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input.toString() : input.url);
    if (url.hostname !== 'api.spotify.com') return realFetch(input, init);
    await new Promise((resolve) => setTimeout(resolve, 120)); // network latency
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace('/v1', '');
    const device = devices.find((d) => d.id === state.deviceId)!;

    if (method === 'GET' && path === '/me/player') {
      const playback: PlaybackState = {
        device: { ...device, is_active: true },
        repeat_state: state.repeat,
        shuffle_state: state.shuffle,
        timestamp: Date.now(),
        progress_ms: progress(),
        is_playing: state.playing,
        item: tracks[state.index]!,
        currently_playing_type: 'track',
        context: { uri: state.contextUri ?? tracks[state.index]!.album.uri, type: state.contextUri ? 'playlist' : 'album' },
        actions: { disallows: state.playing ? { resuming: true } : { pausing: true } },
      };
      return json(playback);
    }
    if (method === 'GET' && path === '/me/player/queue') {
      const queue = Array.from({ length: 8 }, (_, i) => tracks[(state.index + 1 + i) % tracks.length]!);
      return json({ currently_playing: tracks[state.index], queue });
    }
    if (method === 'GET' && path === '/me/player/devices') {
      return json({ devices: devices.map((d) => ({ ...d, is_active: d.id === state.deviceId })) });
    }
    if (path === '/me/player/play') {
      const body = init?.body ? (JSON.parse(String(init.body)) as { uris?: string[]; context_uri?: string; offset?: { uri: string } }) : {};
      const targetUri = body.offset?.uri ?? body.uris?.[0] ?? body.context_uri;
      state.contextUri = body.context_uri?.startsWith('spotify:playlist:') ? body.context_uri : null;
      if (targetUri) {
        const index = tracks.findIndex((t) => t.uri === targetUri || t.album.uri === targetUri);
        state.index = index >= 0 ? index : (state.index + 1) % tracks.length;
        state.progress = 0;
      }
      const requestedDevice = url.searchParams.get('device_id');
      if (requestedDevice) state.deviceId = requestedDevice;
      state.since = Date.now();
      state.playing = true;
      return empty();
    }
    if (method === 'POST' && path === '/me/player/queue') {
      return empty();
    }
    if (method === 'GET' && path === '/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const hits = tracks.filter((t) => `${t.name} ${t.artists[0]?.name} ${t.album.name}`.toLowerCase().includes(q));
      const paging = <T>(items: T[]) => ({ items, total: items.length, next: null });
      return json({
        tracks: paging(hits),
        artists: paging(hits.map((t, i) => ({ type: 'artist', uri: `spotify:artist:demo${i}`, name: t.artists[0]?.name, images: t.album.images }))),
        albums: paging(hits.map((t) => ({ type: 'album', uri: t.album.uri, name: t.album.name, album_type: 'album', release_date: '2025-03-14', artists: t.artists, images: t.album.images }))),
        playlists: paging(hits.length ? [null, { type: 'playlist', uri: 'spotify:playlist:demo', name: `Das ist ${hits[0]?.artists[0]?.name}`, images: hits[0]?.album.images, owner: { display_name: 'Spotify' }, items: { total: 50 } }] : []),
      });
    }
    if (method === 'GET' && path === '/me/player/recently-played') {
      const items = [2, 0, 3, 1, 2, 0].map((index, i) => ({
        track: tracks[index],
        played_at: new Date(Date.now() - i * 600_000).toISOString(),
        context: i % 2 ? { type: 'playlist', uri: `spotify:playlist:mine${index}` } : { type: 'album', uri: tracks[index]!.album.uri },
      }));
      return json({ items });
    }
    if (method === 'GET' && path === '/me/top/artists') {
      const items = tracks.map((t, i) => ({ type: 'artist', uri: `spotify:artist:demo${i}`, name: t.artists[0]?.name, images: t.album.images }));
      return json({ items, total: items.length, next: null });
    }
    if (method === 'GET' && path === '/me/top/tracks') {
      return json({ items: [...tracks].reverse(), total: tracks.length, next: null });
    }
    if (method === 'GET' && path === '/me/playlists') {
      const items = tracks.map((t, i) => ({ type: 'playlist', uri: `spotify:playlist:mine${i}`, name: ['Chill am Abend', 'Sommer 2026', 'Autofahrt', 'Fokus'][i], images: t.album.images, owner: { display_name: 'Eric' }, items: { total: 20 + i * 7 } }));
      return json({ items, total: items.length, next: null });
    }
    if (path === '/me/player/pause') {
      freeze();
      state.playing = false;
      return empty();
    }
    if (path === '/me/player/next' || path === '/me/player/previous') {
      const step = path.endsWith('next') ? 1 : tracks.length - 1;
      state.index = (state.index + step) % tracks.length;
      state.progress = 0;
      state.since = Date.now();
      return empty();
    }
    if (path === '/me/player/seek') {
      state.progress = Number(url.searchParams.get('position_ms'));
      state.since = Date.now();
      return empty();
    }
    if (path === '/me/player/shuffle') {
      state.shuffle = url.searchParams.get('state') === 'true';
      return empty();
    }
    if (path === '/me/player/repeat') {
      state.repeat = url.searchParams.get('state') as RepeatState;
      return empty();
    }
    if (path === '/me/player/volume') {
      device.volume_percent = Number(url.searchParams.get('volume_percent'));
      return empty();
    }
    if (method === 'PUT' && path === '/me/player') {
      const body = JSON.parse(String(init?.body)) as { device_ids: string[] };
      freeze();
      state.deviceId = body.device_ids[0] ?? state.deviceId;
      return empty();
    }
    return new Response(JSON.stringify({ error: { status: 404, message: 'Not found (demo)' } }), { status: 404 });
  };
}
