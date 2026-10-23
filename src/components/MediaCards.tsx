import type { MediaItem } from '../lib/media';
import { Icon } from './Icon';

type CardProps = {
  items: MediaItem[];
  startingKey: string | null;
  playingContextUri: string | null;
  onStart: (item: MediaItem) => void;
};

/** Horizontally scrolling row of cover cards (Spotify "Zuletzt gehört" style). */
export function MediaCarousel({ items, startingKey, playingContextUri, onStart }: CardProps) {
  return (
    <ul className="carousel">
      {items.map((item) => (
        <li key={item.key} className="carousel__item">
          <button
            type="button"
            className={`media-card${item.round ? ' media-card--round' : ''}${item.contextUri === playingContextUri ? ' is-current' : ''}`}
            onClick={() => onStart(item)}
            disabled={startingKey !== null}
          >
            <div className={`media-card__art${item.artStyle ? ` art--${item.artStyle}` : ''}`}>
              {item.imageLarge ? (
                <img src={item.imageLarge} alt="" loading="lazy" draggable={false} />
              ) : (
                <Icon name={item.placeholderIcon} size={36} />
              )}
              {startingKey === item.key && <span className="media-card__busy"><span className="spinner" /></span>}
            </div>
            <span className="media-card__title">{item.title}</span>
            <span className="media-card__subtitle">{item.subtitle}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Two-column grid of compact tiles at the top of the home tab. */
export function ShortcutGrid({ items, startingKey, playingContextUri, onStart }: CardProps) {
  return (
    <ul className="shortcuts">
      {items.map((item) => (
        <li key={item.key}>
          <button
            type="button"
            className={`shortcut${item.contextUri === playingContextUri ? ' is-current' : ''}`}
            onClick={() => onStart(item)}
            disabled={startingKey !== null}
          >
            <div className={`shortcut__art${item.artStyle ? ` art--${item.artStyle}` : ''}`}>
              {item.image ? <img src={item.image} alt="" draggable={false} /> : <Icon name={item.placeholderIcon} size={22} />}
            </div>
            <span className="shortcut__title">{item.title}</span>
            {startingKey === item.key && <span className="spinner shortcut__spinner" aria-hidden="true" />}
            {item.contextUri === playingContextUri && startingKey !== item.key && (
              <span className="shortcut__playing" aria-label="Läuft gerade">
                <i />
                <i />
                <i />
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
