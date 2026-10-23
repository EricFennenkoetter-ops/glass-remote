import { GlassButton } from '../components/GlassButton';
import { Icon } from '../components/Icon';

export function Idle({ onOpenDevices }: { onOpenDevices: () => void }) {
  return (
    <main className="screen center-screen">
      <div className="message-card glass glass--text">
        <div className="message-card__icon">
          <Icon name="music" size={40} />
        </div>
        <h1 className="message-card__title">Gerade läuft nichts</h1>
        <p className="message-card__text">Starte Spotify und spiele etwas ab. Oder setze die Wiedergabe auf einem deiner Geräte fort.</p>
        <GlassButton variant="primary" size="pill" onClick={onOpenDevices}>
          <Icon name="devices" size={18} />
          Gerät wählen
        </GlassButton>
      </div>
    </main>
  );
}
