import { GlassButton } from '../components/GlassButton';
import { Icon } from '../components/Icon';

export function Idle({ onOpenDevices, onOpenSearch }: { onOpenDevices: () => void; onOpenSearch: () => void }) {
  return (
    <main className="screen center-screen">
      <div className="message-card glass glass--text">
        <div className="message-card__icon">
          <Icon name="music" size={40} />
        </div>
        <h1 className="message-card__title">Gerade läuft nichts</h1>
        <p className="message-card__text">
          Such dir direkt hier etwas aus oder setze die Wiedergabe auf einem deiner Geräte fort. Die Spotify-App muss
          dafür auf einem Gerät geöffnet sein.
        </p>
        <div className="message-card__actions message-card__actions--stacked">
          <GlassButton variant="primary" size="pill" onClick={onOpenSearch}>
            <Icon name="search" size={18} />
            Musik suchen
          </GlassButton>
          <GlassButton variant="inner" size="pill" onClick={onOpenDevices}>
            <Icon name="devices" size={18} />
            Gerät wählen
          </GlassButton>
        </div>
      </div>
    </main>
  );
}
