import type { MediaItem } from '../lib/media';
import { Icon } from './Icon';

type MediaListProps = {
  items: MediaItem[];
  /** Key of the item currently being started (shows a spinner, blocks other taps). */
  startingKey: string | null;
  /** Context uri that is playing right now → highlighted. */
  playingContextUri?: string | null;
  onStart: (item: MediaItem) => void;
  onQueue?: (uri: string) => void;
};

export function MediaList({ items, startingKey, playingContextUri, onStart, onQueue }: MediaListProps) {
  return (
    <ul className="list">
      {items.map((item) => (
        <li
          key={item.key}
          className={`list-row list-row--split${item.contextUri === playingContextUri && !item.queueUri ? ' is-current' : ''}`}
        >
          <button
            type="button"
            className="list-row__main"
            onClick={() => onStart(item)}
            disabled={startingKey !== null}
            aria-label={`${item.title} abspielen`}
          >
            <div className={`list-row__art${item.round ? ' list-row__art--round' : ''}`}>
              {item.image ? <img src={item.image} alt="" loading="lazy" /> : <Icon name={item.placeholderIcon} size={20} />}
            </div>
            <div className="list-row__text">
              <span className="list-row__title">{item.title}</span>
              <span className="list-row__subtitle">{item.subtitle}</span>
            </div>
            {startingKey === item.key ? (
              <span className="spinner" aria-hidden="true" />
            ) : (
              item.meta && <span className="list-row__meta">{item.meta}</span>
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
