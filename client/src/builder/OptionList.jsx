import { useState } from 'react';
import { sourceTag } from './labels.js';

/**
 * A list of choosable rules options. The selected option expands to show its
 * description (imported HTML, reduced to plain formatting tags at import time).
 */
export default function OptionList({ items, selected, onSelect, meta, warn, multiple = false, label, emptyText = 'Nothing to choose here.' }) {
  const [query, setQuery] = useState('');
  const isSelected = (slug) => (multiple ? selected.includes(slug) : selected === slug);
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

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
          const on = isSelected(item.slug);
          const warning = warn?.(item);
          return (
            <li key={item.slug} className={`option ${on ? 'option--on' : ''}`}>
              <button type="button" className="option__head" aria-pressed={on} onClick={() => onSelect(item.slug)}>
                <span className="option__gem" aria-hidden="true" />
                <span className="option__main">
                  <span className="option__name">{item.name}</span>
                  {meta && <span className="option__meta">{meta(item)}</span>}
                  {warning && <span className="option__warn">{warning}</span>}
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
      {q && !shown.length && <p className="muted italic">No matches for “{query}”.</p>}
    </div>
  );
}
