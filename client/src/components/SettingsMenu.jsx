import { useRef } from 'react';
import Icon from './Icon.jsx';

/**
 * Settings as a game's options menu: who or what it's for at the top of a rail of sections,
 * and the section you're on large beside it. The rail is a vertical tab list (arrow keys,
 * Home and End move between sections). sections: [{ id, label, hint, icon, danger? }];
 * children is the active section's content.
 */
export default function SettingsMenu({ label, head, sections, active, onSelect, children }) {
  const tabs = useRef([]);
  const move = (e, i) => {
    const to = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: sections.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const n = (to + sections.length) % sections.length;
    onSelect(sections[n].id);
    tabs.current[n]?.focus();
  };
  const current = sections.find((s) => s.id === active) ?? sections[0];
  return (
    <div className="co settings-menu">
      <div className="co__rail">
        <div className="co__class settings-menu__head">{head}</div>
        <div className="co__tabs" role="tablist" aria-orientation="vertical" aria-label={label}>
          {sections.map((s, i) => (
            <button
              key={s.id}
              ref={(el) => (tabs.current[i] = el)}
              type="button"
              role="tab"
              id={`settings-tab-${s.id}`}
              aria-selected={s.id === current.id}
              aria-controls="settings-panel"
              tabIndex={s.id === current.id ? 0 : -1}
              className={`co__tab settings-menu__tab ${s.danger ? 'settings-menu__tab--danger' : ''}`}
              onClick={() => onSelect(s.id)}
              onKeyDown={(e) => move(e, i)}
            >
              <span className="settings-menu__icon"><Icon name={s.icon} size={20} /></span>
              <span className="co__tab-title">{s.label}</span>
              {s.hint && <span className="settings-menu__hint">{s.hint}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="settings-menu__panel" role="tabpanel" id="settings-panel" aria-labelledby="settings-panel-title">
        {/* Only the heading is keyed (it animates in): the content keeps its state across sections, so a form's unsaved edits survive. */}
        <div className="settings-menu__inner">
          <h2 key={current.id} id="settings-panel-title" className={`settings-menu__title ${current.danger ? 'settings-menu__title--danger' : ''}`}>{current.label}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}
