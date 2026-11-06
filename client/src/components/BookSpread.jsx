import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from './Icon.jsx';

/** Entries on one page of the index. */
const PAGE = 24;

/** Sections for an alphabetical index: a tab for each letter. */
export const LETTER_SECTIONS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((l) => ({ key: l, tab: l, name: l }));
/** An entry's letter section, by the first letter of its name. */
export const letterOf = (item) => {
  const l = item.name[0].toUpperCase();
  return l >= 'A' && l <= 'Z' ? l : 'A';
};

/**
 * A reference laid out like an open book (the Spell Book and the Bestiary). On wide
 * screens: thumb-index tabs down the left edge, the index on the left page in numbered
 * pages, and the open entry on the right page. On phones: one page at a time, the
 * index or the open entry. The page number lives in the address (?page=), beside the
 * page's own filters, so opening an entry keeps your place.
 *
 * items: the matching entries, already sorted into sections.
 * sections: [{ key, tab, name }] in index order; sectionOf(item) gives an item's key.
 * open: the open entry (or null), shown by leaf; blank shows before one is opened, under
 * blankIcon (an Icon name for what the book holds).
 * href(item): where an entry opens (keep the current search so filters stay).
 * meta(item): what sits after the dot leader (level, rarity, actions).
 * lead(item), optional: what sits before the name (a session's number).
 *
 * In the character builder, entries open with onOpen(item) instead of a link, and the
 * page is kept on screen rather than in the address (resetKey: change it to go back to
 * the first page, e.g. when a filter changes). marked(item) shows the chosen diamond;
 * blocked(item) grays an entry out, with the reason as its tooltip. tabsOnTop runs the
 * tabs across the top, for sections with names rather than letters. short leaves out the
 * tabs and page turner, for an index that always fits one page. heading replaces the
 * running head's list of sections.
 */
export default function BookSpread({
  items, total, noun, sections, sectionOf, open, href, onOpen, meta, lead, leaf, blank, blankIcon, heading, filtered, clearTo, emptyText,
  marked = () => false, blocked = () => null, short = false, tabsOnTop = false, resetKey = '',
}) {
  const [params, setParams] = useSearchParams();
  const [localPage, setLocalPage] = useState(null);
  useEffect(() => setLocalPage(null), [resetKey]);
  const pages = Math.max(1, Math.ceil(items.length / PAGE));
  // Without a page asked for, show the page the open entry is on.
  const openAt = open ? items.indexOf(open) : -1;
  const urlPage = params.has('page') ? Math.max(1, Number(params.get('page')) || 1) : null;
  const asked = onOpen ? localPage : urlPage;
  const current = Math.min(asked ?? (openAt >= 0 ? Math.floor(openAt / PAGE) + 1 : 1), pages);
  const onPage = items.slice((current - 1) * PAGE, current * PAGE);

  const turn = (to) =>
    onOpen ? setLocalPage(Math.min(pages, Math.max(1, to))) : setParams(
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

  // The arrow keys turn pages, except while typing in a field. With several books on
  // the page (the Level step), only the book that has focus turns.
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.target.closest('input, select, textarea, [contenteditable]') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (document.querySelectorAll('.book').length > 1 && !ref.current?.contains(document.activeElement)) return;
      if (e.key === 'ArrowLeft' && current > 1) turn(current - 1);
      if (e.key === 'ArrowRight' && current < pages) turn(current + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div ref={ref} className={`book ${open ? 'book--open' : ''} ${tabsOnTop ? 'book--tabs-top' : ''}`}>
      {!short && <nav className="book__tabs" aria-label="Sections">
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
      </nav>}

      <section className="book__page book__index" aria-label="Index">
        <header className="book__running">
          <span>{heading ?? runningHead}</span>
          <span role="status">
            {items.length === total ? `${total} ${total === 1 ? noun.replace(/ies$/, 'y').replace(/s$/, '') : noun}` : `${items.length} of ${total}`}
            {filtered && clearTo && (
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
              const chosen = marked(item);
              const reason = blocked(item);
              const className = `book__entry-link ${isOpen ? 'book__entry-link--open' : ''} ${reason ? 'book__entry-link--blocked' : ''}`;
              const inner = (
                <>
                  {onOpen && <span className={`book__mark ${chosen ? 'book__mark--on' : ''}`} aria-hidden="true" />}
                  {lead && <span className="book__lead">{lead(item)}</span>}
                  <span className="book__entry-name">
                    {item.name}
                    {chosen && <span className="visually-hidden"> (chosen)</span>}
                  </span>
                  <span className="book__entry-dots" aria-hidden="true" />
                  <span className="book__entry-meta">{meta(item)}</span>
                </>
              );
              return (
                <li key={item.id}>
                  {starts && <h2 className="book__section">{nameOf(section)}</h2>}
                  {onOpen ? (
                    <button type="button" className={className} aria-pressed={isOpen} title={reason ?? undefined} onClick={() => onOpen(item)}>
                      {inner}
                    </button>
                  ) : (
                    <Link to={href(item)} className={className} aria-current={isOpen ? 'page' : undefined}>
                      {inner}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="muted italic center book__empty">{emptyText}</p>
        )}

        {!short && <footer className="book__foot">
          <button type="button" className="book__turn-btn" disabled={current <= 1} onClick={() => turn(current - 1)} aria-label="Previous page">‹</button>
          <span className="book__folio">Page {current} of {pages}</span>
          <button type="button" className="book__turn-btn" disabled={current >= pages} onClick={() => turn(current + 1)} aria-label="Next page">›</button>
        </footer>}
      </section>

      <section className="book__page book__leaf" aria-label={open ? open.name : 'Open entry'}>
        {open ? leaf : (
          <div className="book__blank">
            <span className="book__blank-mark"><Icon name={blankIcon} size={64} /></span>
            {blank}
          </div>
        )}
      </section>
    </div>
  );
}
