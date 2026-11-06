import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import ActionCost from '../components/ActionCost.jsx';
import BookSpread, { LETTER_SECTIONS, letterOf } from '../components/BookSpread.jsx';
import { GLOSSARY_KINDS, GLOSSARY_LICENSE, KIND_INFO, loadEntryText, loadGlossary } from '../state/glossary.js';

const MENTIONED = '~mentioned';
const total = GLOSSARY_KINDS.reduce((t, k) => t + k.count, 0);

/** Whether an entry is named for the search (or was, before the Remaster). */
const isNamed = (e, q) => e.name.toLowerCase().includes(q) || Boolean(e.formerly?.toLowerCase().includes(q));
/** Whether the search only turns up in an entry's summary or where it sits in its book. */
const isMentioned = (e, q) => e.summary.toLowerCase().includes(q) || Boolean(e.path?.toLowerCase().includes(q));

/** The search, kind and book live in the address, so a search can be bookmarked or shared. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get('q') ?? '', kind: params.get('kind') ?? '', book: params.get('book') ?? '' };
  // Built on the browser's address, which updates at once, so quick changes in a row don't undo each other.
  const set = (changes) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        next.delete('page');
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );
  return [filters, set];
}

/**
 * The rules glossary: Pathfinder's rules, conditions, traits and basic actions, as the
 * Archives of Nethys has them (Remaster versions, findable by their old names too), laid out
 * like an open book. The open entry is at /glossary/:slug, and links in its text open others.
 */
export default function GlossaryPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const [entries, setEntries] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useFilters();

  useEffect(() => {
    loadGlossary().then(setEntries, () => setFailed(true));
  }, []);
  useEffect(() => {
    if (slug) window.scrollTo(0, 0);
  }, [slug]);

  const books = useMemo(() => (entries ? [...new Set(entries.map((e) => e.book).filter(Boolean))].sort() : []), [entries]);
  const q = filters.q.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!entries) return [];
    const list = entries.filter(
      (e) => (!q || isNamed(e, q) || isMentioned(e, q)) && (!filters.kind || e.kind === filters.kind) && (!filters.book || e.book === filters.book),
    );
    // Entries named for the search come before ones that only mention it: "flank" lists Flanking first.
    return q ? [...list].sort((a, b) => Number(!isNamed(a, q)) - Number(!isNamed(b, q))) : list;
  }, [entries, q, filters.kind, filters.book]);

  const open = slug && entries ? entries.find((e) => e.slug === slug) ?? null : null;
  const closeTo = `/glossary${search}`;
  const filtered = Boolean(filters.q || filters.kind || filters.book);
  // Entries that only mention the search get a section of their own, after the named ones.
  const index = q && matches.some((e) => !isNamed(e, q))
    ? {
        sections: [...LETTER_SECTIONS, { key: MENTIONED, tab: 'Mentions', name: `Mentions “${filters.q.trim()}”` }],
        sectionOf: (e) => (isNamed(e, q) ? letterOf(e) : MENTIONED),
      }
    : { sections: LETTER_SECTIONS, sectionOf: letterOf };

  return (
    <PageShell crumbs={slug ? [{ label: 'Rules Glossary', to: closeTo }, { label: open?.name ?? 'Entry' }] : [{ label: 'Rules Glossary' }]}>
      <header className={`bestiary__head ${slug ? 'book__intro--open' : ''}`}>
        <h1 className="title">Rules Glossary</h1>
        <p className="rule-note">
          {total.toLocaleString()} rules, conditions, traits and actions from Pathfinder Second Edition, as the Archives of Nethys has them. Remaster names come first,
          and the old names still find them: search “flat-footed” to find Off-Guard.
        </p>
      </header>

      <div className={`armory-shelves ${slug ? 'armory-shelves--open' : ''}`} role="group" aria-label="Kinds">
        {GLOSSARY_KINDS.map((k) => (
          <button key={k.kind} type="button" className="armory-shelf" aria-pressed={filters.kind === k.kind} onClick={() => setFilters({ kind: filters.kind === k.kind ? '' : k.kind })}>
            <Icon name={KIND_INFO[k.kind].icon} size={32} />
            <span className="armory-shelf__name">{KIND_INFO[k.kind].plural}</span>
            <span className="armory-shelf__count">{k.count.toLocaleString()}</span>
          </button>
        ))}
      </div>

      <section className={`panel bestiary__filters ${slug ? 'book__filters--open' : ''}`} aria-label="Filters">
        <label className="bestiary__search">
          <span className="visually-hidden">Search the glossary</span>
          <input id="glossary-search" type="search" value={filters.q} placeholder="Search: flanking, off-guard, persistent damage…" onChange={(e) => setFilters({ q: e.target.value })} />
        </label>
        <div className="bestiary__selects">
          <label>
            <span>Book</span>
            <select id="glossary-book" value={filters.book} onChange={(e) => setFilters({ book: e.target.value })}>
              <option value="">Every book</option>
              {books.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </div>
      </section>

      {failed && <p className="form-errors" role="alert">Couldn't load the glossary. Try refreshing.</p>}
      {!entries && !failed && <p className="muted italic center">Opening the glossary…</p>}
      {slug && entries && !open && (
        <p className="muted italic center">There's no such entry in the glossary. <Link to={closeTo}>Back to the index</Link></p>
      )}

      {entries && (
        <BookSpread
          items={matches}
          total={entries.length}
          noun="entries"
          sections={index.sections}
          sectionOf={index.sectionOf}
          open={open}
          href={(e) => `/glossary/${e.slug}${search}`}
          lead={(e) => (
            <span className="book__type" title={e.kind}>
              <Icon name={KIND_INFO[e.kind].icon} size={18} />
              <span className="visually-hidden">{e.kind}: </span>
            </span>
          )}
          meta={(e) => (e.actions ? <ActionCost actions={e.actions} /> : <span className="glossary-kind">{e.kind}</span>)}
          leaf={open && <Entry key={open.id} entry={open} closeTo={closeTo} search={search} setFailed={setFailed} />}
          blankIcon="book"
          blank={
            <>
              <p className="book__blank-title">Look something up</p>
              <p className="rule-note">Search for a rule or term, or pick one from the index. Links in an entry open the entries they mention.</p>
            </>
          }
          filtered={filtered}
          clearTo="/glossary"
          emptyText="Nothing matches. Try a shorter word, or another book."
        />
      )}
    </PageShell>
  );
}

/** One entry, as the right-hand page: what kind it is, where it sits in its book, its full text. */
function Entry({ entry, closeTo, search, setFailed }) {
  const [html, setHtml] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    loadEntryText(entry).then((h) => !cancelled && setHtml(h), () => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [entry, setFailed]);

  // Links to other entries open in place, keeping the search, instead of reloading the page.
  const follow = (e) => {
    const a = e.target.closest('a[data-glossary]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(`/glossary/${a.dataset.glossary}${search}`);
  };

  return (
    <article className="creature book__turn item-page">
      <Link to={closeTo} className="book__back">‹ Back to the index</Link>
      <header className="creature__head">
        <div className="creature__title">
          <span className="creature__type" title={entry.kind}><Icon name={KIND_INFO[entry.kind].icon} size={30} /></span>
          <h2 className="title">{entry.name}</h2>
          {entry.actions && <span className="creature__level"><ActionCost actions={entry.actions} /></span>}
        </div>
        <p className="creature__traits">
          <span className="tag tag--cantrip">{entry.kind}</span>
          {entry.traits?.map((t) => <span key={t} className="tag">{t}</span>)}
        </p>
        {entry.path && <p className="glossary-path">{entry.path}</p>}
        {entry.formerly && <p className="rule-note">Formerly {entry.formerly}, before the Remaster.</p>}
      </header>

      <section className="statblock" aria-label={`${entry.name} rules`}>
        <div className="statblock__body item-text glossary-text" onClick={follow}>
          {html == null ? <p className="muted italic">Reading the rules…</p> : <div dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      </section>
      <p className="creature__source">
        {entry.book}
        {entry.page ? `, page ${entry.page}` : ''} · <a href={entry.aon} target="_blank" rel="noreferrer">Archives of Nethys</a>
      </p>
      <p className="creature__license">{GLOSSARY_LICENSE}</p>
    </article>
  );
}
