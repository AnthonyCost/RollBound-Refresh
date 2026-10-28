import { useState } from 'react';
import { sourceTag } from './labels.js';

/**
 * A list of choosable rules options. The selected option expands to show its
 * description (imported HTML, reduced to plain formatting tags at import time).
 * Clicking the selected option again unselects it: onSelect(null) for a single
 * choice; a multiple list gets the ID and toggles it itself.
 */
export default function OptionList({ items, selected, onSelect, meta, warn, note, blocked, multiple = false, label, emptyText = 'Nothing to choose here.' }) {
  const [query, setQuery] = useState('');
  const isSelected = (id) => (multiple ? selected.includes(id) : selected === id);
  const q = query.trim().toLowerCase();
  // Searching never hides what's chosen.
  const shown = q ? items.filter((i) => isSelected(i.id) || i.name.toLowerCase().includes(q)) : items;

  return (
    <div className="options">
      {items.length > 10 && (
        <input
          className="options__search"
          type="search"
          placeholder={`Search ${items.length} options`}
          aria-label={`Search ${label ?? 'options'}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {!items.length && <p className="muted italic">{emptyText}</p>}
      <ul className="options__list" aria-label={label}>
        {shown.map((item) => {
          const on = isSelected(item.id);
          const reason = blocked?.(item);
          const warning = reason ?? warn?.(item);
          const hint = note?.(item);
          return (
            <li key={item.id} className={`option ${on ? 'option--on' : ''} ${on && item.description ? 'option--open' : ''} ${reason && !on ? 'option--blocked' : ''}`}>
              <button type="button" className="option__head" aria-pressed={on} disabled={Boolean(reason) && !on} onClick={() => onSelect(on && !multiple ? null : item.id)}>
                <span className="option__gem" aria-hidden="true" />
                <span className="option__main">
                  <span className="option__name">{item.name}</span>
                  {meta && <span className="option__meta">{meta(item)}</span>}
                  {warning && <span className="option__warn">{warning}</span>}
                  {hint && <span className="option__hint">{hint}</span>}
                </span>
                <span className="option__tags">
                  {item.rarity && item.rarity !== 'common' && <span className="tag tag--rare">{item.rarity}</span>}
                  {item.source && <span className="tag">{sourceTag(item.source)}</span>}
                </span>
              </button>
              {on && item.description && (
                <div className="option__desc" dangerouslySetInnerHTML={{ __html: item.description }} />
              )}
            </li>
          );
        })}
      </ul>
      {q && !shown.some((i) => !isSelected(i.id)) && <p className="muted italic">No matches for “{query}”.</p>}
    </div>
  );
}
