import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getDevices } from '../api/player';
import type { Device } from '../api/types';
import { exportSessionCode, isStandalone, logout } from '../auth/session';
import { GlassButton } from '../components/GlassButton';
import { deviceIcon, Icon } from '../components/Icon';
import { Sheet } from '../components/Sheet';
import { showToast } from '../lib/toast';

type DevicesSheetProps = {
  open: boolean;
  /** Opened because something should start and the app doesn't know where. */
  choosingForPlayback: boolean;
  onClose: () => void;
  onSelect: (device: Device) => Promise<boolean>;
};

const REFRESH_MS = 5000;

const isIOS = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function DevicesSheet({ open, choosingForPlayback, onClose, onSelect }: DevicesSheetProps) {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let timer: number | undefined;
    const load = async () => {
      try {
        const list = await getDevices();
        if (!cancelled) {
          setDevices(list);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Geräte konnten nicht geladen werden.');
      }
      if (!cancelled) timer = window.setTimeout(load, REFRESH_MS);
    };
    // Coming back from the Spotify app (see "iPhone fehlt?") → reload right away.
    const onVisible = () => {
      if (document.hidden) return;
      window.clearTimeout(timer);
      void load();
    };
    void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open]);

  const select = async (device: Device) => {
    if (!device.id || device.is_restricted || (device.is_active && !choosingForPlayback)) return;
    setSwitchingTo(device.id);
    // Optimistic: mark the target active right away.
    setDevices((list) => list?.map((d) => ({ ...d, is_active: d.id === device.id })) ?? null);
    await onSelect(device);
    setSwitchingTo(null);
    onClose();
  };

  const phoneMissing = devices !== null && isIOS() && !devices.some((device) => device.type === 'Smartphone');

  return (
    <Sheet open={open} title={choosingForPlayback ? 'Wo abspielen?' : 'Wiedergabe auf'} onClose={onClose}>
      {error && <p className="sheet__message sheet__message--error">{error}</p>}
      {devices === null && !error && <p className="sheet__message">Suche Geräte …</p>}
      {devices?.length === 0 && (
        <div className="sheet__empty">
          <Icon name="devices" size={36} />
          <p>Keine Geräte gefunden.</p>
          <p className="sheet__hint">Öffne Spotify auf deinem iPhone, Computer oder Lautsprecher – dann taucht es hier auf.</p>
        </div>
      )}
      {devices && devices.length > 0 && (
        <ul className="list">
          {devices.map((device) => {
            const disabled = !device.id || device.is_restricted;
            return (
              <li key={device.id ?? device.name}>
                <button
                  type="button"
                  className={`list-row list-row--button${device.is_active ? ' is-current' : ''}`}
                  disabled={disabled}
                  aria-pressed={device.is_active}
                  onClick={() => void select(device)}
                >
                  <div className="list-row__art list-row__art--icon">
                    <Icon name={deviceIcon(device.type)} size={22} />
                  </div>
                  <div className="list-row__text">
                    <span className="list-row__title">{device.name}</span>
                    <span className="list-row__subtitle">
                      {device.is_active ? 'Aktiv' : disabled ? 'Nicht steuerbar' : typeLabel(device.type)}
                      {device.is_private_session ? ' · Private Session' : ''}
                    </span>
                  </div>
                  {switchingTo === device.id ? (
                    <span className="spinner" aria-label="Wechsle …" />
                  ) : (
                    device.is_active && <Icon name="check" size={20} className="list-row__check" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {phoneMissing && (
        <div className="device-hint glass glass--text">
          <p className="device-hint__title">Dein iPhone fehlt?</p>
          <p className="sheet__hint">
            Spotify zeigt dein iPhone nur an, solange die Spotify-App dort wach ist. Öffne sie kurz und komm dann
            hierher zurück (oben links auf „Glass Remote“ tippen).
          </p>
          <GlassButton
            variant="primary"
            size="pill"
            onClick={() => {
              window.location.href = 'spotify:';
            }}
          >
            Spotify-App öffnen
          </GlassButton>
        </div>
      )}
      <AccountFooter onClose={onClose} />
    </Sheet>
  );
}

function AccountFooter({ onClose }: { onClose: () => void }) {
  const canHandOver = !isStandalone();

  const copySession = async () => {
    const code = exportSessionCode();
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast('Kopiert. Jetzt die App vom Home-Bildschirm öffnen und „Anmeldung einfügen“ wählen.', 'info');
    } catch {
      window.prompt('Diesen Code kopieren:', code);
    }
  };

  return (
    <div className="sheet__footer">
      {canHandOver && (
        <GlassButton variant="inner" size="pill" onClick={() => void copySession()}>
          Anmeldung für Home-Bildschirm-App kopieren
        </GlassButton>
      )}
      <GlassButton
        variant="plain"
        size="pill"
        onClick={() => {
          onClose();
          logout();
        }}
      >
        Von Spotify abmelden
      </GlassButton>
    </div>
  );
}

function typeLabel(type: Device['type']): string {
  const labels: Record<string, string> = {
    Computer: 'Computer',
    Smartphone: 'Smartphone',
    Tablet: 'Tablet',
    Speaker: 'Lautsprecher',
    TV: 'Fernseher',
    AVR: 'AV-Receiver',
    STB: 'Set-Top-Box',
    AudioDongle: 'Audio-Adapter',
    GameConsole: 'Spielkonsole',
    CastVideo: 'Chromecast',
    CastAudio: 'Cast-Lautsprecher',
    Automobile: 'Auto',
  };
  return labels[type] ?? 'Gerät';
}
