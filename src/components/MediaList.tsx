import { isPlayable, type MediaItem } from '../lib/media';
import { useMediaActions } from '../player/MediaActions';
import { Icon } from './Icon';

type MediaListProps = {
  items: MediaItem[];
  /** Key of the item currently being started (shows a spinner, blocks other taps). */
  startingKey: string | null;
  /** What's playing right now → highlighted (tracks by uri, everything else by context). */
  playingContextUri?: string | null;
  playingItemUri?: string | null;
  onStart: (item: MediaItem) => void;
  /** The playlist page this list belongs to (enables "Aus dieser Playlist entfernen"). */
  menuPlaylist?: MediaItem;
};

export function MediaList({ items, startingKey, playingContextUri, playingItemUri, onStart, menuPlaylist }: MediaListProps) {
  const { openMenu } = useMediaActions();
  return (
    <ul className="list">
      {items.map((item, index) => (
        <li
          // A playlist can contain the same track twice.
          key={`${item.key}-${index}`}
          className={`list-row list-row--split${
            (isPlayable(item) ? item.key === playingItemUri : item.contextUri === playingContextUri) ? ' is-current' : ''
          }`}
        >
          <button
            type="button"
            className="list-row__main"
            onClick={() => onStart(item)}
            disabled={startingKey !== null}
            aria-label={isPlayable(item) ? `${item.title} abspielen` : `${item.title} öffnen`}
          >
            {item.leading !== undefined ? (
              <span className="list-row__number">{item.leading}</span>
            ) : (
              <div
                className={`list-row__art${item.round ? ' list-row__art--round' : ''}${item.artStyle ? ` art--${item.artStyle}` : ''}`}
              >
                {item.image ? <img src={item.image} alt="" loading="lazy" /> : <Icon name={item.placeholderIcon} size={20} />}
              </div>
            )}
            <div className="list-row__text">
              <span className="list-row__title">{item.title}</span>
              <span className="list-row__subtitle">{item.subtitle}</span>
            </div>
            {startingKey === item.key ? (
              <span className="spinner" aria-hidden="true" />
            ) : isPlayable(item) ? (
              item.meta && <span className="list-row__meta">{item.meta}</span>
            ) : (
              <Icon name="chevronRight" size={18} className="list-row__chevron" />
            )}
          </button>
          {item.kind !== 'liked' && (
            <button
              type="button"
              className="list-row__action"
              aria-label={`Weitere Optionen für ${item.title}`}
              onClick={() => openMenu(item, { playlist: menuPlaylist })}
            >
              <Icon name="more" size={20} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
