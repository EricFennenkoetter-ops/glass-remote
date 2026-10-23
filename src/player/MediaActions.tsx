import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/client';
import {
  addToPlaylist,
  createPlaylist,
  getMe,
  getPlaylist,
  removeFromLibrary,
  removeFromPlaylist,
  updatePlaylist,
  type PlaylistDetails,
} from '../api/player';
import type { CurrentUser } from '../api/types';
import { GlassButton } from '../components/GlassButton';
import { Icon, type IconName } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { idFromUri, isPlayable, playlistItem, shareUrl, spotifyUri, type MediaItem } from '../lib/media';
import { showToast } from '../lib/toast';
import type { PlayerEngine } from './engine';
import { markSaved, setSaved, useSaved } from './library';
import { invalidatePersonalData, usePersonalData } from './usePersonalData';

type MenuOptions = {
  /** Set when the menu is opened from inside a playlist page → "Aus dieser Playlist entfernen". */
  playlist?: MediaItem;
};

type MediaActions = {
  openMenu: (item: MediaItem, options?: MenuOptions) => void;
  openDetail: (item: MediaItem) => void;
  createPlaylist: (initialUris?: string[]) => void;
  /** True when the current user owns the playlist (or it's collaborative with them). */
  isOwnPlaylist: (item: MediaItem) => boolean;
};

const MediaActionsContext = createContext<MediaActions | null>(null);

export function useMediaActions(): MediaActions {
  const actions = useContext(MediaActionsContext);
  if (!actions) throw new Error('useMediaActions must be used inside <MediaActionsProvider>');
  return actions;
}

// ---------- current user (for ownership checks) ----------

let meRequest: Promise<CurrentUser | null> | null = null;

function useMe(): CurrentUser | null {
  const [me, setMe] = useState<CurrentUser | null>(null);
  useEffect(() => {
    meRequest ??= getMe().catch(() => null);
    let cancelled = false;
    void meRequest.then((user) => !cancelled && setMe(user));
    return () => {
      cancelled = true;
    };
  }, []);
  return me;
}

// ---------- provider ----------

type EditorState = { mode: 'create'; initialUris: string[] } | { mode: 'edit'; playlist: MediaItem };

type ProviderProps = {
  player: PlayerEngine;
  openDetail: (item: MediaItem) => void;
  /** Called after a playlist was deleted, e.g. to leave its page. */
  onPlaylistDeleted: (uri: string) => void;
  children: ReactNode;
};

export function MediaActionsProvider({ player, openDetail, onPlaylistDeleted, children }: ProviderProps) {
  const me = useMe();
  const [menu, setMenu] = useState<{ item: MediaItem; options: MenuOptions } | null>(null);
  const [pickerUris, setPickerUris] = useState<string[] | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);

  const isOwnPlaylist = useCallback(
    (item: MediaItem) => item.kind === 'playlist' && !!me && item.ownerId === me.id,
    [me],
  );

  const actions = useMemo<MediaActions>(
    () => ({
      openMenu: (item, options = {}) => setMenu({ item, options }),
      openDetail,
      createPlaylist: (initialUris = []) => setEditor({ mode: 'create', initialUris }),
      isOwnPlaylist,
    }),
    [openDetail, isOwnPlaylist],
  );

  const closeMenu = () => setMenu(null);

  const deletePlaylist = async (item: MediaItem) => {
    if (!window.confirm(`„${item.title}“ löschen?`)) return;
    try {
      // For Spotify, deleting your own playlist means unfollowing it.
      await removeFromLibrary([item.contextUri]);
      markSaved(item.contextUri, false);
      invalidatePersonalData();
      onPlaylistDeleted(item.contextUri);
      showToast('Playlist gelöscht', 'info');
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Löschen hat nicht geklappt.');
    }
  };

  return (
    <MediaActionsContext.Provider value={actions}>
      {children}
      <ItemMenuSheet
        menu={menu}
        onClose={closeMenu}
        player={player}
        isOwnPlaylist={isOwnPlaylist}
        onOpenDetail={(item) => {
          closeMenu();
          openDetail(item);
        }}
        onAddToPlaylist={(uri) => {
          closeMenu();
          setPickerUris([uri]);
        }}
        onEditPlaylist={(playlist) => {
          closeMenu();
          setEditor({ mode: 'edit', playlist });
        }}
        onDeletePlaylist={(playlist) => {
          closeMenu();
          void deletePlaylist(playlist);
        }}
      />
      <AddToPlaylistSheet
        uris={pickerUris}
        isOwnPlaylist={isOwnPlaylist}
        onClose={() => setPickerUris(null)}
        onCreateNew={(uris) => {
          setPickerUris(null);
          setEditor({ mode: 'create', initialUris: uris });
        }}
      />
      <PlaylistEditorSheet editor={editor} onClose={() => setEditor(null)} onCreated={openDetail} />
    </MediaActionsContext.Provider>
  );
}

// ---------- … menu ----------

type ItemMenuProps = {
  menu: { item: MediaItem; options: MenuOptions } | null;
  onClose: () => void;
  player: PlayerEngine;
  isOwnPlaylist: (item: MediaItem) => boolean;
  onOpenDetail: (item: MediaItem) => void;
  onAddToPlaylist: (uri: string) => void;
  onEditPlaylist: (playlist: MediaItem) => void;
  onDeletePlaylist: (playlist: MediaItem) => void;
};

function ItemMenuSheet({ menu, onClose, player, isOwnPlaylist, onOpenDetail, onAddToPlaylist, onEditPlaylist, onDeletePlaylist }: ItemMenuProps) {
  // Keep the last item while the sheet animates out.
  const [shown, setShown] = useState(menu);
  useEffect(() => {
    if (menu) setShown(menu);
  }, [menu]);

  const item = shown?.item ?? null;
  const uri = item ? spotifyUri(item) : null;
  const own = item ? isOwnPlaylist(item) : false;
  // Own playlists are always "in the library"; Lieblingssongs and artists can't be saved via the API.
  const canSave = !!item && item.kind !== 'artist' && item.kind !== 'liked' && item.kind !== 'chapter' && !own;
  const isSaved = useSaved(canSave ? uri : null);
  const link = item ? shareUrl(item) : null;
  const containingPlaylist = shown?.options.playlist;

  const run = (action: () => void | Promise<void>) => () => {
    onClose();
    void action();
  };

  const rows: { icon: IconName; label: string; onSelect: () => void; danger?: boolean }[] = [];
  if (item && uri) {
    if (canSave) {
      const label =
        item.kind === 'track'
          ? isSaved
            ? 'Aus Lieblingssongs entfernen'
            : 'Zu Lieblingssongs hinzufügen'
          : item.kind === 'show' || item.kind === 'playlist'
            ? isSaved
              ? 'Nicht mehr folgen'
              : 'Folgen'
            : isSaved
              ? 'Aus Bibliothek entfernen'
              : 'In Bibliothek speichern';
      rows.push({ icon: isSaved ? 'heartFilled' : 'heart', label, onSelect: run(() => setSaved(uri, !isSaved)) });
    }
    if (item.queueUri) {
      const queueUri = item.queueUri;
      rows.push({ icon: 'addToQueue', label: 'Zur Warteschlange hinzufügen', onSelect: run(() => player.addToQueue(queueUri)) });
    }
    if (item.kind === 'track' || item.kind === 'episode') {
      rows.push({ icon: 'plus', label: 'Zu Playlist hinzufügen', onSelect: () => onAddToPlaylist(uri) });
    }
    if (containingPlaylist && isPlayable(item) && isOwnPlaylist(containingPlaylist)) {
      rows.push({
        icon: 'minus',
        label: 'Aus dieser Playlist entfernen',
        onSelect: run(async () => {
          try {
            await removeFromPlaylist(idFromUri(containingPlaylist.contextUri), [uri]);
            invalidatePersonalData();
            showToast(`Aus „${containingPlaylist.title}“ entfernt`, 'info');
          } catch (error) {
            showToast(error instanceof ApiError ? error.message : 'Entfernen hat nicht geklappt.');
          }
        }),
      });
    }
    const album = item.links?.album;
    if (album && album.contextUri !== containingPlaylist?.contextUri) {
      rows.push({ icon: 'disc', label: 'Album anzeigen', onSelect: () => onOpenDetail(album) });
    }
    const artist = item.links?.artist;
    if (artist) rows.push({ icon: 'person', label: 'Künstler anzeigen', onSelect: () => onOpenDetail(artist) });
    if (own) {
      rows.push({ icon: 'pencil', label: 'Playlist bearbeiten', onSelect: () => onEditPlaylist(item) });
      rows.push({ icon: 'trash', label: 'Playlist löschen', onSelect: () => onDeletePlaylist(item), danger: true });
    }
    if (link) rows.push({ icon: 'share', label: 'Teilen', onSelect: run(() => share(item.title, link)) });
  }

  return (
    <Sheet open={menu !== null} title={item?.title ?? ''} onClose={onClose}>
      {item && (
        <div className="menu-header">
          <div className={`list-row__art${item.round ? ' list-row__art--round' : ''}${item.artStyle ? ` art--${item.artStyle}` : ''}`}>
            {item.image ? <img src={item.image} alt="" /> : <Icon name={item.placeholderIcon} size={20} />}
          </div>
          <div className="list-row__text">
            <span className="list-row__title">{item.title}</span>
            <span className="list-row__subtitle">{item.subtitle}</span>
          </div>
        </div>
      )}
      <ul className="menu-list">
        {rows.map((row) => (
          <li key={row.label}>
            <button type="button" className={`menu-row${row.danger ? ' menu-row--danger' : ''}`} onClick={row.onSelect}>
              <Icon name={row.icon} size={22} />
              <span>{row.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** iOS share sheet; clipboard where the Web Share API is missing. */
async function share(title: string, url: string) {
  if (navigator.share) {
    await navigator.share({ title, url }).catch(() => undefined); // cancelling is fine
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Link kopiert', 'info');
  } catch {
    window.prompt('Link kopieren:', url);
  }
}

// ---------- add to playlist ----------

type AddToPlaylistProps = {
  uris: string[] | null;
  isOwnPlaylist: (item: MediaItem) => boolean;
  onClose: () => void;
  onCreateNew: (uris: string[]) => void;
};

function AddToPlaylistSheet({ uris, isOwnPlaylist, onClose, onCreateNew }: AddToPlaylistProps) {
  const personal = usePersonalData();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const playlists = personal.status === 'ready' ? personal.data.playlists.filter(isOwnPlaylist) : [];

  const add = async (playlist: MediaItem) => {
    if (!uris) return;
    setBusyKey(playlist.key);
    try {
      await addToPlaylist(idFromUri(playlist.contextUri), uris);
      invalidatePersonalData();
      showToast(`Zu „${playlist.title}“ hinzugefügt`, 'info');
      onClose();
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : 'Hinzufügen hat nicht geklappt.');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <Sheet open={uris !== null} title="Zu Playlist hinzufügen" onClose={onClose}>
      <ul className="list">
        <li>
          <button type="button" className="list-row list-row--button" onClick={() => uris && onCreateNew(uris)}>
            <div className="list-row__art list-row__art--new">
              <Icon name="plus" size={22} />
            </div>
            <div className="list-row__text">
              <span className="list-row__title">Neue Playlist</span>
            </div>
          </button>
        </li>
        {playlists.map((playlist) => (
          <li key={playlist.key}>
            <button
              type="button"
              className="list-row list-row--button"
              onClick={() => void add(playlist)}
              disabled={busyKey !== null}
            >
              <div className="list-row__art">
                {playlist.image ? <img src={playlist.image} alt="" /> : <Icon name="queue" size={20} />}
              </div>
              <div className="list-row__text">
                <span className="list-row__title">{playlist.title}</span>
                <span className="list-row__subtitle">{playlist.subtitle}</span>
              </div>
              {busyKey === playlist.key && <span className="spinner" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
      {personal.status === 'ready' && playlists.length === 0 && (
        <p className="sheet__message">Du hast noch keine eigenen Playlists.</p>
      )}
    </Sheet>
  );
}

// ---------- create / edit playlist ----------

type EditorProps = {
  editor: EditorState | null;
  onClose: () => void;
  onCreated: (playlist: MediaItem) => void;
};

function PlaylistEditorSheet({ editor, onClose, onCreated }: EditorProps) {
  const [details, setDetails] = useState<PlaylistDetails>({ name: '', description: '', public: false });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!editor) return;
    if (editor.mode === 'create') {
      setDetails({ name: '', description: '', public: false });
      return;
    }
    setDetails({ name: editor.playlist.title, description: '', public: false });
    // Description and visibility aren't part of the list item → load them.
    let cancelled = false;
    getPlaylist(idFromUri(editor.playlist.contextUri))
      .then((playlist) => {
        if (cancelled || !playlist) return;
        setDetails({ name: playlist.name, description: playlist.description ?? '', public: playlist.public ?? false });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [editor]);

  const save = async () => {
    if (!editor || !details.name.trim()) return;
    setBusy(true);
    const clean = { ...details, name: details.name.trim(), description: details.description.trim() };
    try {
      if (editor.mode === 'create') {
        const created = await createPlaylist(clean);
        if (!created) throw new Error('Spotify hat keine Playlist zurückgegeben.');
        if (editor.initialUris.length > 0) await addToPlaylist(idFromUri(created.uri), editor.initialUris);
        invalidatePersonalData();
        showToast(`Playlist „${clean.name}“ erstellt`, 'info');
        onClose();
        onCreated(playlistItem({ ...created, images: created.images ?? [] }));
      } else {
        await updatePlaylist(idFromUri(editor.playlist.contextUri), clean);
        invalidatePersonalData();
        showToast('Playlist gespeichert', 'info');
        onClose();
      }
    } catch (error) {
      showToast(error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Speichern hat nicht geklappt.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={editor !== null} title={editor?.mode === 'edit' ? 'Playlist bearbeiten' : 'Neue Playlist'} onClose={onClose}>
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="field">
          <span>Name</span>
          <input
            value={details.name}
            onChange={(event) => setDetails((d) => ({ ...d, name: event.target.value }))}
            placeholder="Meine Playlist"
            maxLength={100}
            enterKeyHint="done"
            required
          />
        </label>
        <label className="field">
          <span>Beschreibung (optional)</span>
          <textarea
            value={details.description}
            onChange={(event) => setDetails((d) => ({ ...d, description: event.target.value }))}
            rows={3}
            maxLength={300}
          />
        </label>
        <label className="toggle-row">
          <span>Öffentlich (auf deinem Profil sichtbar)</span>
          <input
            type="checkbox"
            className="toggle"
            checked={details.public}
            onChange={(event) => setDetails((d) => ({ ...d, public: event.target.checked }))}
          />
        </label>
        <GlassButton variant="primary" size="pill" type="submit" disabled={busy || !details.name.trim()}>
          {busy && <span className="spinner" aria-hidden="true" />}
          {editor?.mode === 'edit' ? 'Speichern' : 'Erstellen'}
        </GlassButton>
      </form>
    </Sheet>
  );
}
