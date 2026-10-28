import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

/** Entries on one page of the index. */
const PAGE = 24;

/**
 * A reference laid out like an open book (the Spell Book and the Bestiary). On wide
 * screens: thumb-index tabs down the left edge, the index on the left page in numbered
 * pages, and the open entry on the right page. On phones: one page at a time, the
 * index or the open entry. The page number lives in the address (?page=), beside the
 * page's own filters, so opening an entry keeps your place.
 *
 * items: the matching entries, already sorted into sections.
 * sections: [{ key, tab, name }] in index order; sectionOf(item) gives an item's key.
 * open: the open entry (or null), shown by leaf; blank shows before one is opened.
 * href(item): where an entry opens (keep the current search so filters stay).
 * meta(item): what sits after the dot leader (level, rarity, actions).
 */
export default function BookSpread({ items, total, noun, sections, sectionOf, open, href, meta, leaf, blank, filtered, clearTo, emptyText }) {
  const [params, setParams] = useSearchParams();
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  // Without a page in the address, show the page the open entry is on.
  const openAt = open ? items.indexOf(open) : -1;
  const asked = params.has('page') ? Math.max(1, Number(params.get('page')) || 1) : null;
  const current = Math.min(asked ?? (openAt >= 0 ? Math.floor(openAt / PAGE) + 1 : 1), pages);
  const onPage = items.slice((current - 1) * PAGE, current * PAGE);

  const turn = (to) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        const page = Math.min(pages, Math.max(1, to));
        if (page === 1) next.delete('page');
        else next.set('page', String(page));
        return next;
      },
      { replace: true },
    );

  // Where each section starts, for the tabs; and the sections on this page, for the header.
  const firstPageOf = {};
  items.forEach((item, i) => (firstPageOf[sectionOf(item)] ??= Math.floor(i / PAGE) + 1));
  const here = new Set(onPage.map(sectionOf));
  const nameOf = (key) => sections.find((x) => x.key === key)?.name ?? '';
  const first = onPage[0] && sectionOf(onPage[0]);
  const last = onPage.at(-1) && sectionOf(onPage.at(-1));
  const runningHead = first ? (first === last ? nameOf(first) : `${nameOf(first)} – ${nameOf(last)}`) : `No ${noun}`;

  // The arrow keys turn pages, except while typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, select, textarea, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'ArrowLeft' && current > 1) turn(current - 1);
      if (e.key === 'ArrowRight' && current < pages) turn(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className={`book ${open ? 'book--open' : ''}`}>
      <nav className="book__tabs" aria-label="Sections">
        {sections.map((x) => (
          <button
            key={x.key}
            type="button"
            className={`book__tab ${here.has(x.key) ? 'book__tab--here' : ''}`}
            disabled={!firstPageOf[x.key]}
            aria-current={here.has(x.key) ? 'true' : undefined}
            aria-label={`${x.name}${firstPageOf[x.key] ? `, page ${firstPageOf[x.key]}` : ', none match'}`}
            title={x.name}
            onClick={() => turn(firstPageOf[x.key])}
          >
            {x.tab}
          </button>
        ))}
      </nav>

      <section className="book__page book__index" aria-label="Index">
        <header className="book__running">
          <span>{runningHead}</span>
          <span role="status">
            {items.length === total ? `${total} ${noun}` : `${items.length} of ${total}`}
            {filtered && (
              <>
                {' · '}
                <Link to={clearTo} className="bestiary__clear">Clear filters</Link>
              </>
            )}
          </span>
        </header>

        {onPage.length ? (
          <ol key={current} className="book__list book__turn">
            {onPage.map((item, i) => {
              const section = sectionOf(item);
              const starts = i === 0 || sectionOf(onPage[i - 1]) !== section;
              const isOpen = item === open;
              return (
                <li key={item.id}>
                  {starts && <h2 className="book__section">{nameOf(section)}</h2>}
                  <Link to={href(item)} className={`book__entry-link ${isOpen ? 'book__entry-link--open' : ''}`} aria-current={isOpen ? 'page' : undefined}>
                    <span className="book__entry-name">{item.name}</span>
                    <span className="book__entry-dots" aria-hidden="true" />
                    <span className="book__entry-meta">{meta(item)}</span>
                  </Link>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted italic center book__empty">{emptyText}</p>
        )}

        <footer className="book__foot">
          <button type="button" className="book__turn-btn" disabled={current <= 1} onClick={() => turn(current - 1)} aria-label="Previous page">‹</button>
          <span className="book__folio">Page {current} of {pages}</span>
          <button type="button" className="book__turn-btn" disabled={current >= pages} onClick={() => turn(current + 1)} aria-label="Next page">›</button>
        </footer>
      </section>

      <section className="book__page book__leaf" aria-label={open ? open.name : 'Open entry'}>
        {open ? leaf : (
          <div className="book__blank">
            <span className="book__blank-mark" aria-hidden="true">✦</span>
            {blank}
          </div>
        )}
      </section>
    </div>
  );
}
