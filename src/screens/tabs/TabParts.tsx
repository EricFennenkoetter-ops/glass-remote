import type { ReactNode } from 'react';
import { startLogin } from '../../auth/session';
import { GlassButton } from '../../components/GlassButton';
import { Icon } from '../../components/Icon';

export function TabSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tab-section">
      <h2 className="tab-section__title">{title}</h2>
      {children}
    </section>
  );
}

/** Shown when the session predates the personal scopes (playlists, recently played, top). */
export function ReconnectCard() {
  return (
    <div className="message-card glass glass--text reconnect-card">
      <div className="message-card__icon">
        <Icon name="music" size={32} />
      </div>
      <h2 className="message-card__title">Deine Musik anzeigen?</h2>
      <p className="message-card__text">
        Für deine Playlists, „Zuletzt gehört“ und deine Top-Künstler braucht Glass Remote zwei zusätzliche
        Berechtigungen. Einmal neu verbinden genügt.
      </p>
      <GlassButton variant="primary" size="pill" onClick={() => void startLogin()}>
        Neu mit Spotify verbinden
      </GlassButton>
    </div>
  );
}

export function SkeletonCarousel() {
  return (
    <ul className="carousel" aria-busy="true" aria-label="Lädt">
      {Array.from({ length: 4 }, (_, index) => (
        <li key={index} className="carousel__item">
          <div className="media-card">
            <div className="media-card__art skeleton-block" />
            <span className="skeleton-line" />
          </div>
        </li>
      ))}
    </ul>
  );
}
