import { useEffect, useMemo } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { useRules } from '../state/useRules.js';
import { titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';

const SPELL_TYPES = ['spells'];
const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
/** Spells on one page of the index. */
const PAGE = 24;

export const spellPath = (s) => `/spells/${s.slug}`;
const RANKS = Array.from({ length: 10 }, (_, i) => i + 1);
const KINDS = { spell: 'Spells', focus: 'Focus Spells', ritual: 'Rituals' };
/** How the books head a spell: "Cantrip 1", "Spell 3", "Focus 4", "Ritual 5". */
const kindOf = (s) => (s.kind === 'ritual' ? 'Ritual' : s.kind === 'focus' ? 'Focus' : s.rank === 0 ? 'Cantrip' : 'Spell');
const levelOf = (s) => s.rank || 1;

// The book's sections, in index order: cantrips, ranks 1 to 10, focus spells, rituals.
// Each has a thumb-index tab, a heading in the list, and a name for the running header.
const SECTIONS = [
  { key: 'c', tab: 'C', name: 'Cantrips' },
  ...RANKS.map((r) => ({ key: String(r), tab: String(r), name: `Rank ${r}` })),
  { key: 'f', tab: 'F', name: 'Focus Spells' },
  { key: 'r', tab: 'R', name: 'Rituals' },
];
const sectionOf = (s) => (s.kind === 'focus' ? 'f' : s.kind === 'ritual' ? 'r' : s.rank === 0 ? 'c' : String(s.rank));
const sectionName = (key) => SECTIONS.find((x) => x.key === key)?.name ?? '';

/** Filters live in the address, so a filtered list can be bookmarked (as on the Bestiary). */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get('q') ?? '', kind: params.get('kind') ?? '', rank: params.get('rank') ?? '', tradition: params.get('tradition') ?? '', rarity: params.get('rarity') ?? '', book: params.get('book') ?? '' };
  // null when the address doesn't say, so an open spell can show the page it's on.
  const page = params.has('page') ? Math.max(1, Number(params.get('page')) || 1) : null;
  // Built on the browser's address so quick changes in a row don't undo each other.
  // Changing a filter goes back to the first page.
  const set = (changes) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        if (!('page' in changes)) next.delete('page');
        for (const [k, v] of Object.entries(changes)) {
          if (v === '' || v == null || (k === 'page' && v === 1)) next.delete(k);
          else next.set(k, String(v));
        }
        return next;
      },
      { replace: true },
    );
  return [filters, page, set];
}

/**
 * The Spell Book, laid out like an open book. On wide screens the left page is the
 * index (searchable, filterable, in numbered pages, with thumb-index tabs for each
 * rank) and the right page is the open spell. On phones it's one page at a time: the
 * index at /spells, the spell at /spells/:slug. Filters and the page stay in the
 * address, so opening a spell keeps your place in the index.
 */
export default function SpellBookPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const rules = useRules(SPELL_TYPES);
  const [filters, page, setFilters] = useFilters();

  const spells = rules?.spells ?? null;
  const books = useMemo(() => (spells ? [...new Set(spells.map((s) => s.source))] : []), [spells]);
  const matches = useMemo(() => {
    if (!spells) return [];
    const q = filters.q.trim().toLowerCase();
    return spells
      .filter(
        (s) =>
          (!q || s.name.toLowerCase().includes(q) || s.traits.some((t) => t === q)) &&
          (!filters.kind || s.kind === filters.kind) &&
          (filters.rank === '' || String(s.rank) === filters.rank) &&
          (!filters.tradition || s.traditions.includes(filters.tradition)) &&
          (!filters.rarity || s.rarity === filters.rarity) &&
          (!filters.book || s.source === filters.book),
      )
      // Ordinary spells first, then focus spells, then rituals; each by rank, then name.
      .sort((a, b) => Object.keys(KINDS).indexOf(a.kind) - Object.keys(KINDS).indexOf(b.kind) || a.rank - b.rank || a.name.localeCompare(b.name));
  }, [spells, filters.q, filters.kind, filters.rank, filters.tradition, filters.rarity, filters.book]);
  const filtered = Object.values(filters).some(Boolean);

  const open = slug ? spells?.find((x) => x.slug === slug) : null;
  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const openAt = open ? matches.indexOf(open) : -1;
  const current = Math.min(page ?? (openAt >= 0 ? Math.floor(openAt / PAGE) + 1 : 1), pages);
  const onPage = matches.slice((current - 1) * PAGE, current * PAGE);
  // Where each section starts, for the thumb-index tabs.
  const firstPageOf = useMemo(() => {
    const at = {};
    matches.forEach((s, i) => (at[sectionOf(s)] ??= Math.floor(i / PAGE) + 1));
    return at;
  }, [matches]);
  const openSections = new Set(onPage.map(sectionOf));
  const first = onPage[0] && sectionOf(onPage[0]);
  const last = onPage.at(-1) && sectionOf(onPage.at(-1));
  const runningHead = first ? (first === last ? sectionName(first) : `${sectionName(first)} – ${sectionName(last)}`) : 'No spells';

  const turn = (to) => setFilters({ page: Math.min(pages, Math.max(1, to)) });

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
  useEffect(() => {
    if (slug) window.scrollTo(0, 0);
  }, [slug]);

  const crumbs = slug ? [{ label: 'Spells', to: `/spells${search}` }, { label: open?.name ?? 'Spell' }] : [{ label: 'Spells' }];
  const closeTo = `/spells${search}`;

  return (
    <PageShell crumbs={crumbs}>
      <header className={`bestiary__head ${slug ? 'book__intro--open' : ''}`}>
        <h1 className="title">Spell Book</h1>
        <p className="rule-note">
          {spells ? `${spells.length} spells` : 'Every spell'} from {books.length ? books.join(', ') : 'the books RollBound uses'}: cantrips and every rank from 1 to 10, plus focus spells and rituals. Search by name or trait, or narrow by type, rank, tradition and rarity.
        </p>
      </header>

      <section className={`panel bestiary__filters ${slug ? 'book__filters--open' : ''}`} aria-label="Filters">
        <label className="bestiary__search">
          <span className="visually-hidden">Search</span>
          <input id="spell-search" type="search" value={filters.q} placeholder="Search: fire, heal, mental…" onChange={(e) => setFilters({ q: e.target.value })} />
        </label>
        <div className="bestiary__selects">
          <label>
            <span>Type</span>
            <select id="spell-kind" value={filters.kind} onChange={(e) => setFilters({ kind: e.target.value })}>
              <option value="">Any type</option>
              {Object.entries(KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Rank</span>
            <select id="spell-rank" value={filters.rank} onChange={(e) => setFilters({ rank: e.target.value })}>
              <option value="">Any rank</option>
              <option value="0">Cantrips</option>
              {RANKS.map((r) => <option key={r} value={r}>Rank {r}</option>)}
            </select>
          </label>
          <label>
            <span>Tradition</span>
            <select id="spell-tradition" value={filters.tradition} onChange={(e) => setFilters({ tradition: e.target.value })}>
              <option value="">Any tradition</option>
              {TRADITIONS.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
          </label>
          <label>
            <span>Rarity</span>
            <select id="spell-rarity" value={filters.rarity} onChange={(e) => setFilters({ rarity: e.target.value })}>
              <option value="">Any rarity</option>
              {RARITIES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
            </select>
          </label>
          <label>
            <span>Book</span>
            <select id="spell-book" value={filters.book} onChange={(e) => setFilters({ book: e.target.value })}>
              <option value="">Every book</option>
              {books.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
        </div>
      </section>

      {rules?.error && <p className="form-errors" role="alert">Couldn't load the spells. Try refreshing.</p>}
      {!rules && <p className="muted italic center">Opening the spell book…</p>}
      {slug && spells && !open && (
        <p className="muted italic center">There's no such spell in the Spell Book. <Link to={closeTo}>Back to the index</Link></p>
      )}

      {spells && (
        <div className={`book ${slug ? 'book--open' : ''}`}>
          <nav className="book__tabs" aria-label="Sections">
            {SECTIONS.map((x) => (
              <button
                key={x.key}
                type="button"
                className={`book__tab ${openSections.has(x.key) ? 'book__tab--here' : ''}`}
                disabled={!firstPageOf[x.key]}
                aria-current={openSections.has(x.key) ? 'true' : undefined}
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
                {matches.length === spells.length ? `${matches.length} spells` : `${matches.length} of ${spells.length}`}
                {filtered && (
                  <>
                    {' · '}
                    <Link to="/spells" className="bestiary__clear">Clear filters</Link>
                  </>
                )}
              </span>
            </header>

            {onPage.length ? (
              <ol key={current} className="book__list book__turn">
                {onPage.map((s, i) => {
                  const section = sectionOf(s);
                  const starts = i === 0 || sectionOf(onPage[i - 1]) !== section;
                  return (
                    <li key={s.id}>
                      {starts && <h2 className="book__section">{sectionName(section)}</h2>}
                      <Link
                        to={`${spellPath(s)}${search}`}
                        className={`book__entry-link ${s.slug === slug ? 'book__entry-link--open' : ''}`}
                        aria-current={s.slug === slug ? 'page' : undefined}
                      >
                        <span className="book__entry-name">{s.name}</span>
                        <span className="book__entry-dots" aria-hidden="true" />
                        <span className="book__entry-meta">
                          {s.rarity !== 'common' && <span className={`tag tag--rarity-${s.rarity}`}>{s.rarity}</span>}
                          <ActionCost actions={s.actions} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="muted italic center book__empty">No spells match. Try fewer filters.</p>
            )}

            <footer className="book__foot">
              <button type="button" className="book__turn-btn" disabled={current <= 1} onClick={() => turn(current - 1)} aria-label="Previous page">‹</button>
              <span className="book__folio">Page {current} of {pages}</span>
              <button type="button" className="book__turn-btn" disabled={current >= pages} onClick={() => turn(current + 1)} aria-label="Next page">›</button>
            </footer>
          </section>

          <section className="book__page book__leaf" aria-label={open ? open.name : 'Open spell'}>
            {open ? (
              <SpellEntry key={open.slug} s={open} closeTo={closeTo} />
            ) : (
              <div className="book__blank">
                <span className="book__blank-mark" aria-hidden="true">✦</span>
                <p className="book__blank-title">Choose a spell</p>
                <p className="rule-note">Pick a spell from the index to read it here. Use the tabs to jump to a rank, and the arrow keys to turn pages.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}

/** One spell, as the right-hand page: its traits, the details a caster needs, and the full rules text. */
function SpellEntry({ s, closeTo }) {
  const facts = [
    ['Traditions', s.traditions.map(titleCase).join(', ')],
    ['Type', s.kind === 'focus' ? 'Focus spell: cast with a Focus Point' : s.kind === 'ritual' ? 'Ritual' : null],
    ['Cast', <ActionCost key="cast" actions={s.actions} />],
    ['Range', s.range],
    ['Area', s.area],
    ['Targets', s.target],
    ['Defense', s.defense && titleCase(s.defense)],
    ['Duration', s.duration],
  ].filter(([, v]) => v);
  return (
    <article className="creature spell-page book__turn">
      <Link to={closeTo} className="book__back">‹ Back to the index</Link>
      <header className="creature__head">
        <div className="creature__title">
          <h2 className="title">{s.name}</h2>
          <span className="creature__level">{kindOf(s)} {levelOf(s)}</span>
        </div>
        <p className="creature__traits">
          {s.rarity !== 'common' && <span className={`tag tag--rarity-${s.rarity}`}>{s.rarity}</span>}
          {s.rank === 0 && <span className="tag">cantrip</span>}
          {s.kind === 'focus' && <span className="tag">focus</span>}
          {s.traits.map((t) => <span key={t} className="tag">{t}</span>)}
        </p>
      </header>

      <section className="statblock spell-block" aria-label={`${s.name} details`}>
        <div className="statblock__head">
          <span>{s.name}</span>
          <span>{kindOf(s)} {levelOf(s)}</span>
        </div>
        <div className="statblock__body">
          <dl className="spell-facts">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <hr />
          <div className="spell-text" dangerouslySetInnerHTML={{ __html: s.description }} />
        </div>
      </section>
      <p className="creature__source">
        {s.source} ·{' '}
        <a href={`https://2e.aonprd.com/Search.aspx?q=${encodeURIComponent(s.name)}`} target="_blank" rel="noreferrer">Look it up on Archives of Nethys</a>
      </p>
      {s.rank === 0 && <p className="rule-note">Cantrips can be cast at will and are automatically heightened to half your level, rounded up.</p>}
      {s.kind === 'focus' && s.rank > 0 && <p className="rule-note">Focus spells cost a Focus Point and are automatically heightened to half your level, rounded up.</p>}
    </article>
  );
}

/** /spells/id/:spellId, for links that only know a spell's id. */
export function SpellByIdPage() {
  const { spellId } = useParams();
  const rules = useRules(SPELL_TYPES);
  if (!rules) return <PageShell crumbs={[{ label: 'Spells', to: '/spells' }]}><p className="muted italic center">Opening the spell book…</p></PageShell>;
  const s = rules.spells?.find((x) => x.id === spellId);
  return <Navigate to={s ? spellPath(s) : '/spells'} replace />;
}
