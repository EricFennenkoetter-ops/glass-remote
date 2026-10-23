import type { ReactNode } from 'react';
import { Sheet } from '../components/Sheet';
import {
  ACCENTS,
  APP_ICONS,
  BACKGROUNDS,
  DEFAULT_APPEARANCE,
  GLASS_LEVELS,
  updateAppearance,
  useAppearance,
  type Appearance,
} from '../lib/appearance';
import { isStandalone } from '../auth/session';

type AppearanceSheetProps = { open: boolean; onClose: () => void };

export function AppearanceSheet({ open, onClose }: AppearanceSheetProps) {
  const appearance = useAppearance();

  return (
    <Sheet open={open} title="Darstellung" onClose={onClose}>
      <SettingGroup title="Akzentfarbe">
        <div className="swatches" role="radiogroup" aria-label="Akzentfarbe">
          {(Object.keys(ACCENTS) as Appearance['accent'][]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={appearance.accent === key}
              className={`swatch${appearance.accent === key ? ' is-active' : ''}`}
              onClick={() => updateAppearance({ accent: key })}
            >
              <span
                className={`swatch__dot${key === 'auto' ? ' swatch__dot--auto' : ''}`}
                style={ACCENTS[key].colour ? { background: ACCENTS[key].colour } : undefined}
              />
              <span className="swatch__label">{ACCENTS[key].label}</span>
            </button>
          ))}
        </div>
      </SettingGroup>

      <SettingGroup title="Hintergrund">
        <Segmented
          options={BACKGROUNDS}
          value={appearance.background}
          onChange={(background) => updateAppearance({ background })}
        />
      </SettingGroup>

      <SettingGroup title="Glas">
        <Segmented options={GLASS_LEVELS} value={appearance.glass} onChange={(glass) => updateAppearance({ glass })} />
      </SettingGroup>

      <SettingGroup title="Bewegung">
        <label className="toggle-row">
          <span>Farbflecken im Hintergrund bewegen</span>
          <input
            type="checkbox"
            className="toggle"
            checked={appearance.motion}
            onChange={(event) => updateAppearance({ motion: event.target.checked })}
          />
        </label>
      </SettingGroup>

      <SettingGroup title="App-Icon">
        <div className="icon-choices" role="radiogroup" aria-label="App-Icon">
          {(Object.keys(APP_ICONS) as Appearance['icon'][]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={appearance.icon === key}
              className={`icon-choice${appearance.icon === key ? ' is-active' : ''}`}
              onClick={() => updateAppearance({ icon: key })}
            >
              <img src={`./icons/${key}-180.png`} alt="" width={52} height={52} />
              <span>{APP_ICONS[key]}</span>
            </button>
          ))}
        </div>
        <p className="sheet__hint setting-hint">
          {isStandalone()
            ? 'iOS übernimmt ein neues Icon erst beim Hinzufügen: Öffne die Seite in Safari, wähle das Icon dort und füge sie neu zum Home-Bildschirm hinzu (das alte Icon kannst du löschen).'
            : 'Wird verwendet, wenn du die Seite jetzt über „Teilen → Zum Home-Bildschirm“ hinzufügst.'}
        </p>
      </SettingGroup>

      <div className="sheet__footer">
        <button type="button" className="text-link" onClick={() => updateAppearance(DEFAULT_APPEARANCE)}>
          Auf Standard zurücksetzen
        </button>
      </div>
    </Sheet>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="setting-group">
      <h3 className="list-heading">{title}</h3>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<T, string>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {(Object.keys(options) as T[]).map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          className={`segmented__option${value === key ? ' is-active' : ''}`}
          onClick={() => onChange(key)}
        >
          {options[key]}
        </button>
      ))}
    </div>
  );
}
