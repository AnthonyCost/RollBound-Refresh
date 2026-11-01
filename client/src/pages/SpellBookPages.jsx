import { useEffect, useMemo } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { useRules } from '../state/useRules.js';
import { sentenceCase, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';
import BookSpread from '../components/BookSpread.jsx';

const SPELL_TYPES = ['spells'];
const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];

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

/** Filters live in the address, so a filtered list can be bookmarked (as on the Bestiary). */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get('q') ?? '', kind: params.get('kind') ?? '', rank: params.get('rank') ?? '', tradition: params.get('tradition') ?? '', rarity: params.get('rarity') ?? '', book: params.get('book') ?? '' };
  // Built on the browser's address so quick changes in a row don't undo each other.
  // Changing a filter goes back to the first page of the index.
  const set = (changes) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        next.delete('page');
        for (const [k, v] of Object.entries(changes)) {
          if (v === '' || v == null) next.delete(k);
          else next.set(k, String(v));
        }
        return next;
      },
      { replace: true },
    );
  return [filters, set];
}

/**
 * The Spell Book, laid out like an open book (see BookSpread): the index, with a
 * thumb-index tab for each rank, and the open spell at /spells/:slug. Filters stay in
 * the address, so opening a spell keeps your place in the index.
 */
export default function SpellBookPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const rules = useRules(SPELL_TYPES);
  const [filters, setFilters] = useFilters();

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
        <BookSpread
          items={matches}
          total={spells.length}
          noun="spells"
          sections={SECTIONS}
          sectionOf={sectionOf}
          open={open}
          href={(s) => `${spellPath(s)}${search}`}
          meta={(s) => (
            <>
              {s.rarity !== 'common' && <span className={`tag tag--rarity-${s.rarity}`}>{s.rarity}</span>}
              <ActionCost actions={s.actions} />
            </>
          )}
          leaf={open && <SpellEntry key={open.slug} s={open} closeTo={closeTo} />}
          blank={
            <>
              <p className="book__blank-title">Choose a spell</p>
              <p className="rule-note">Pick a spell from the index to read it here. Use the tabs to jump to a rank, and the arrow keys to turn pages.</p>
            </>
          }
          filtered={filtered}
          clearTo="/spells"
          emptyText="No spells match. Try fewer filters."
        />
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
    ['Range', sentenceCase(s.range)],
    ['Area', sentenceCase(s.area)],
    ['Targets', sentenceCase(s.target)],
    ['Defense', s.defense && titleCase(s.defense)],
    ['Duration', sentenceCase(s.duration)],
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
