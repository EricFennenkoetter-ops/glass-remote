import type { MediaItem } from '../lib/media';
import { Icon } from './Icon';

type MediaListProps = {
  items: MediaItem[];
  /** Key of the item currently being started (shows a spinner, blocks other taps). */
  startingKey: string | null;
  /** What's playing right now → highlighted (tracks by uri, everything else by context). */
  playingContextUri?: string | null;
  playingItemUri?: string | null;
  onStart: (item: MediaItem) => void;
  onQueue?: (uri: string) => void;
};

export function MediaList({ items, startingKey, playingContextUri, playingItemUri, onStart, onQueue }: MediaListProps) {
  return (
    <ul className="list">
      {items.map((item, index) => (
        <li
          // A playlist can contain the same track twice.
          key={`${item.key}-${index}`}
          className={`list-row list-row--split${
            (item.kind === 'track' ? item.key === playingItemUri : item.contextUri === playingContextUri) ? ' is-current' : ''
          }`}
        >
          <button
            type="button"
            className="list-row__main"
            onClick={() => onStart(item)}
            disabled={startingKey !== null}
            aria-label={item.kind === 'track' ? `${item.title} abspielen` : `${item.title} öffnen`}
          >
            {item.leading !== undefined ? (
              <span className="list-row__number">{item.leading}</span>
            ) : (
              <div className={`list-row__art${item.round ? ' list-row__art--round' : ''}`}>
                {item.image ? <img src={item.image} alt="" loading="lazy" /> : <Icon name={item.placeholderIcon} size={20} />}
              </div>
            )}
            <div className="list-row__text">
              <span className="list-row__title">{item.title}</span>
              <span className="list-row__subtitle">{item.subtitle}</span>
            </div>
            {startingKey === item.key ? (
              <span className="spinner" aria-hidden="true" />
            ) : item.kind === 'track' ? (
              item.meta && <span className="list-row__meta">{item.meta}</span>
            ) : (
              <Icon name="chevronRight" size={18} className="list-row__chevron" />
            )}
          </button>
          {item.queueUri && onQueue && (
            <button
              type="button"
              className="list-row__action"
              aria-label={`${item.title} zur Warteschlange hinzufügen`}
              onClick={() => onQueue(item.queueUri!)}
            >
              <Icon name="addToQueue" size={20} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
