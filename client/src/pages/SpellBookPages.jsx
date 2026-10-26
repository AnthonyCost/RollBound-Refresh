import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { useRules } from '../state/useRules.js';
import { titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';

const SPELL_TYPES = ['spells'];
const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const PAGE = 60;

export const spellPath = (s) => `/spells/${s.slug}`;
const RANKS = Array.from({ length: 10 }, (_, i) => i + 1);
const KINDS = { spell: 'Spells', focus: 'Focus Spells', ritual: 'Rituals' };
/** How the books head a spell: "Cantrip 1", "Spell 3", "Focus 4", "Ritual 5". */
const kindOf = (s) => (s.kind === 'ritual' ? 'Ritual' : s.kind === 'focus' ? 'Focus' : s.rank === 0 ? 'Cantrip' : 'Spell');
const levelOf = (s) => s.rank || 1;

/** Filters live in the address, so a filtered list can be bookmarked (as on the Bestiary). */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = { q: params.get('q') ?? '', kind: params.get('kind') ?? '', rank: params.get('rank') ?? '', tradition: params.get('tradition') ?? '', rarity: params.get('rarity') ?? '', book: params.get('book') ?? '' };
  // Built on the browser's address so quick changes in a row don't undo each other.
  const set = (changes) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
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

/** The Spell Book: every spell in RollBound's rules data, searchable and filterable. */
export default function SpellBookPage() {
  const rules = useRules(SPELL_TYPES);
  const [filters, setFilters] = useFilters();
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    setShown(PAGE);
  }, [filters.q, filters.kind, filters.rank, filters.tradition, filters.rarity, filters.book]);

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
  }, [spells, filters]);
  const filtered = Object.values(filters).some(Boolean);

  return (
    <PageShell crumbs={[{ label: 'Spells' }]}>
      <header className="bestiary__head">
        <h1 className="title">Spell Book</h1>
        <p className="rule-note">
          {spells ? `${spells.length} spells` : 'Every spell'} from {books.length ? books.join(', ') : 'the books RollBound uses'}: cantrips and every rank from 1 to 10, plus focus spells and rituals. Search by name or trait, or narrow by type, rank, tradition and rarity.
        </p>
      </header>

      <section className="panel bestiary__filters" aria-label="Filters">
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
      {spells && (
        <>
          <p className="bestiary__count" role="status">
            {matches.length === spells.length ? `All ${matches.length} spells` : `${matches.length} of ${spells.length} spells`}
            {filtered && (
              <>
                {' · '}
                <Link to="/spells" className="bestiary__clear">Clear filters</Link>
              </>
            )}
          </p>
          {matches.length ? (
            <ul className="creatures">
              {matches.slice(0, shown).map((s) => (
                <li key={s.id}>
                  <Link to={spellPath(s)} className="creature-card spell-card">
                    <span className={`creature-card__level spell-card__rank spell-card__rank--${s.kind}`} aria-label={`${kindOf(s)} ${levelOf(s)}`}>
                      {/* Cantrips show a C; the cantrip tag beside it says the rest. */}
                      {!(s.kind === 'spell' && s.rank === 0) && <small>{s.kind === 'spell' ? 'RANK' : kindOf(s).toUpperCase()}</small>}
                      {s.kind === 'spell' ? (s.rank === 0 ? 'C' : s.rank) : levelOf(s)}
                    </span>
                    <span className="creature-card__body">
                      <span className="creature-card__name">
                        {s.name} <ActionCost actions={s.actions} />
                      </span>
                      <span className="creature-card__tags">
                        {s.rarity !== 'common' && <span className={`tag tag--rarity-${s.rarity}`}>{s.rarity}</span>}
                        {s.rank === 0 && <span className="tag tag--cantrip">cantrip</span>}
                        {s.traits.filter((t) => t !== 'concentrate' && t !== 'manipulate').slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}
                      </span>
                      <span className="creature-card__stats">
                        {s.kind === 'focus' ? 'Focus spell' : s.kind === 'ritual' ? 'Ritual' : s.traditions.map(titleCase).join(', ') || 'No tradition'}
                        {s.defense ? ` · ${titleCase(s.defense)}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel panel--dashed muted italic center">No spells match. Try fewer filters.</p>
          )}
          {matches.length > shown && (
            <button type="button" className="btn bestiary__more" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, matches.length - shown)} more
            </button>
          )}
        </>
      )}
    </PageShell>
  );
}

/** One spell: its traits, the details a caster needs, and the full rules text. */
export function SpellPage() {
  const { slug } = useParams();
  const rules = useRules(SPELL_TYPES);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);
  const s = rules?.spells?.find((x) => x.slug === slug);
  const crumbs = [{ label: 'Spells', to: '/spells' }, { label: s?.name ?? 'Spell' }];

  if (rules?.error) return <PageShell crumbs={crumbs}><p className="form-errors" role="alert">Couldn't load the spells. Try refreshing.</p></PageShell>;
  if (!rules) return <PageShell crumbs={crumbs}><p className="muted italic center">Opening the spell book…</p></PageShell>;
  if (!s) {
    return (
      <PageShell crumbs={crumbs}>
        <p className="muted italic center">There's no such spell in the Spell Book. <Link to="/spells">Back to the Spell Book</Link></p>
      </PageShell>
    );
  }

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
    <PageShell crumbs={crumbs}>
      <article className="creature spell-page">
        <header className="creature__head">
          <div className="creature__title">
            <h1 className="title">{s.name}</h1>
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
    </PageShell>
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
