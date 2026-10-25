import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { BESTIARY_BOOKS, bookKey, creaturePath, creatureThumb, loadBestiary } from '../state/bestiary.js';

// The creature types a monster's traits can name, in the order the books list them.
const TYPES = ['Aberration', 'Animal', 'Astral', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Dream', 'Elemental', 'Ethereal', 'Fey', 'Fiend', 'Fungus', 'Giant', 'Humanoid', 'Monitor', 'Ooze', 'Plant', 'Spirit', 'Time', 'Undead'];
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const LEVELS = Array.from({ length: 27 }, (_, i) => i - 1);
const PAGE = 60;
const titleCase = (s) => s[0].toUpperCase() + s.slice(1);

/** Filters live in the address, so a filtered list can be bookmarked or shared. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const get = (k, fallback = '') => params.get(k) ?? fallback;
  const filters = {
    q: get('q'),
    book: get('book'),
    type: get('type'),
    size: get('size'),
    rarity: get('rarity'),
    family: get('family'),
    min: Number(get('min', '-1')),
    max: Number(get('max', '25')),
  };
  // Built on the browser's address, which updates at once, so quick changes in a row
  // don't undo each other (the hook's own copy only updates on the next render).
  const set = (changes) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(changes)) {
          const empty = v === '' || v == null || (k === 'min' && v === -1) || (k === 'max' && v === 25);
          if (empty) next.delete(k);
          else next.set(k, String(v));
        }
        return next;
      },
      { replace: true },
    );
  return [filters, set];
}

/** The bestiary: every creature in Monster Core and Monster Core 2, searchable and filterable. */
export default function BestiaryPage() {
  const [creatures, setCreatures] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useFilters();
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    loadBestiary().then(setCreatures, () => setFailed(true));
  }, []);
  useEffect(() => {
    setShown(PAGE);
  }, [filters.q, filters.book, filters.type, filters.size, filters.rarity, filters.family, filters.min, filters.max]);

  const matches = useMemo(() => {
    if (!creatures) return [];
    const q = filters.q.trim().toLowerCase();
    return creatures.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || c.formerly?.toLowerCase().includes(q) || c.traits.some((t) => t.toLowerCase() === q)) &&
        (!filters.book || bookKey(c.book) === filters.book) &&
        (!filters.type || c.traits.includes(filters.type)) &&
        (!filters.size || c.size === filters.size) &&
        (!filters.rarity || c.rarity === filters.rarity) &&
        (!filters.family || c.family.includes(filters.family)) &&
        c.level >= filters.min &&
        c.level <= filters.max,
    );
  }, [creatures, filters]);

  const filtered = filters.q || filters.book || filters.type || filters.size || filters.rarity || filters.family || filters.min !== -1 || filters.max !== 25;
  const total = BESTIARY_BOOKS.reduce((t, b) => t + b.count, 0);

  return (
    <PageShell crumbs={[{ label: 'Bestiary' }]}>
      <header className="bestiary__head">
        <h1 className="title">Bestiary</h1>
        <p className="rule-note">
          {total} creatures from {BESTIARY_BOOKS.map((b) => b.book).join(' and ')}, with their full stat blocks. Search by name, or narrow by level, type, size and rarity.
        </p>
      </header>

      <section className="panel bestiary__filters" aria-label="Filters">
        <label className="bestiary__search">
          <span className="visually-hidden">Search</span>
          <input id="bestiary-search" type="search" value={filters.q} placeholder="Search: goblin, dragon, lich…" onChange={(e) => setFilters({ q: e.target.value })} />
        </label>
        <div className="bestiary__selects">
          <label>
            <span>Level</span>
            <span className="bestiary__range">
              <select id="bestiary-min" value={filters.min} onChange={(e) => setFilters({ min: Number(e.target.value), max: Math.max(Number(e.target.value), filters.max) })} aria-label="Lowest level">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              to
              <select id="bestiary-max" value={filters.max} onChange={(e) => setFilters({ max: Number(e.target.value), min: Math.min(Number(e.target.value), filters.min) })} aria-label="Highest level">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </span>
          </label>
          <label>
            <span>Type</span>
            <select id="bestiary-type" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })}>
              <option value="">Any type</option>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span>Size</span>
            <select id="bestiary-size" value={filters.size} onChange={(e) => setFilters({ size: e.target.value })}>
              <option value="">Any size</option>
              {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span>Rarity</span>
            <select id="bestiary-rarity" value={filters.rarity} onChange={(e) => setFilters({ rarity: e.target.value })}>
              <option value="">Any rarity</option>
              {RARITIES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
            </select>
          </label>
          <label>
            <span>Book</span>
            <select id="bestiary-book" value={filters.book} onChange={(e) => setFilters({ book: e.target.value })}>
              <option value="">Both books</option>
              {BESTIARY_BOOKS.map((b) => <option key={b.book} value={bookKey(b.book)}>{b.book}</option>)}
            </select>
          </label>
        </div>
        {filters.family && (
          <p className="bestiary__family">
            Family: <strong>{filters.family}</strong>{' '}
            <button type="button" className="link-button" onClick={() => setFilters({ family: '' })}>Show all families</button>
          </p>
        )}
      </section>

      {failed && <p className="form-errors" role="alert">Couldn't load the bestiary. Try refreshing.</p>}
      {!creatures && !failed && <p className="muted italic center">Opening the tome…</p>}

      {creatures && (
        <>
          <p className="bestiary__count" role="status">
            {matches.length === creatures.length ? `All ${matches.length} creatures` : `${matches.length} of ${creatures.length} creatures`}
            {filtered && (
              <>
                {' · '}
                <Link to="/bestiary" className="bestiary__clear">Clear filters</Link>
              </>
            )}
          </p>
          {matches.length ? (
            <ul className="creatures">
              {matches.slice(0, shown).map((c) => (
                <li key={c.id}>
                  <Link to={creaturePath(c)} className="creature-card">
                    {creatureThumb(c) ? (
                      <span className="creature-card__thumb">
                        <img src={creatureThumb(c)} alt="" loading="lazy" decoding="async" />
                        <span className="creature-card__badge" aria-label={`Level ${c.level}`}>{c.level}</span>
                      </span>
                    ) : (
                      <span className="creature-card__level" aria-label={`Level ${c.level}`}>
                        <small>LVL</small>
                        {c.level}
                      </span>
                    )}
                    <span className="creature-card__body">
                      <span className="creature-card__name">{c.name}</span>
                      <span className="creature-card__tags">
                        {c.rarity !== 'common' && <span className={`tag tag--rarity-${c.rarity}`}>{c.rarity}</span>}
                        {c.size && <span className="tag">{c.size}</span>}
                        {c.traits.slice(0, 3).map((t) => <span key={t} className="tag">{t}</span>)}
                      </span>
                      <span className="creature-card__stats">
                        HP {c.hp} · AC {c.ac} · {c.book === 'Monster Core' ? 'MC' : 'MC2'} {c.page && `p. ${c.page}`}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel panel--dashed muted italic center">No creatures match. Try a wider level range or fewer filters.</p>
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
