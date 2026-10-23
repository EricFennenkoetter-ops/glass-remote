import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getQueue } from '../api/player';
import { Sheet } from '../components/Sheet';
import { Icon } from '../components/Icon';
import { describeItem, type ItemInfo } from '../lib/item';
import { formatTime } from '../lib/format';

type QueueSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Changes when the track changes → reload. */
  currentKey: string | null;
};

type QueueState =
  | { status: 'loading' }
  | { status: 'ready'; current: ItemInfo | null; next: ItemInfo[] }
  | { status: 'error'; message: string };

export function QueueSheet({ open, onClose, currentKey }: QueueSheetProps) {
  const [state, setState] = useState<QueueState>({ status: 'loading' });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getQueue()
      .then((queue) => {
        if (cancelled) return;
        setState({
          status: 'ready',
          current: queue?.currently_playing ? describeItem(queue.currently_playing) : null,
          next: (queue?.queue ?? []).map(describeItem),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: error instanceof ApiError ? error.message : 'Warteschlange nicht verfügbar.' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentKey]);

  return (
    <Sheet open={open} title="Als Nächstes" onClose={onClose}>
      {state.status === 'loading' && <SkeletonRows />}
      {state.status === 'error' && <p className="sheet__message">{state.message}</p>}
      {state.status === 'ready' && (
        <>
          {state.current && (
            <>
              <h3 className="list-heading">Läuft gerade</h3>
              <ul className="list">
                <QueueRow item={state.current} current />
              </ul>
            </>
          )}
          <h3 className="list-heading">Warteschlange</h3>
          {state.next.length === 0 ? (
            <p className="sheet__message">Danach kommt nichts mehr.</p>
          ) : (
            <ul className="list">
              {state.next.map((item, index) => (
                <QueueRow key={`${item.key}-${index}`} item={item} />
              ))}
            </ul>
          )}
        </>
      )}
    </Sheet>
  );
}

function QueueRow({ item, current = false }: { item: ItemInfo; current?: boolean }) {
  return (
    <li className={`list-row${current ? ' is-current' : ''}`}>
      <div className="list-row__art">
        {item.imageSmall ? <img src={item.imageSmall} alt="" loading="lazy" /> : <Icon name="music" size={20} />}
      </div>
      <div className="list-row__text">
        <span className="list-row__title">{item.title}</span>
        <span className="list-row__subtitle">{item.subtitle}</span>
      </div>
      <span className="list-row__meta">{formatTime(item.durationMs)}</span>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="list" aria-busy="true" aria-label="Lädt">
      {Array.from({ length: 5 }, (_, index) => (
        <li key={index} className="list-row list-row--skeleton">
          <div className="list-row__art" />
          <div className="list-row__text">
            <span className="skeleton-line" />
            <span className="skeleton-line skeleton-line--short" />
          </div>
        </li>
      ))}
    </ul>
  );
}
