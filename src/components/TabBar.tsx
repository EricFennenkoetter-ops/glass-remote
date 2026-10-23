import { Icon, type IconName } from './Icon';

export type TabId = 'home' | 'search' | 'library';

const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: 'home', label: 'Start', icon: 'home' },
  { id: 'search', label: 'Suchen', icon: 'search' },
  { id: 'library', label: 'Bibliothek', icon: 'library' },
];

export function TabBar({ active, onChange }: { active: TabId; onChange: (tab: TabId) => void }) {
  return (
    <nav className="tab-bar glass" aria-label="Hauptnavigation">
      {TABS.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          className={`tab-bar__item${active === id ? ' is-active' : ''}`}
          aria-current={active === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon name={icon} size={24} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
