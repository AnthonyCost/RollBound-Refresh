import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import { ARMORY_CATEGORIES, ARMORY_LICENSE, itemLevel, itemPath, loadArmory, loadItemDetails } from '../state/armory.js';

const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const LEVELS = Array.from({ length: 29 }, (_, i) => i);
const MAX_LEVEL = 28;
const PAGE = 60;
const SORTS = { name: 'Name', level: 'Level', price: 'Price' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Filters live in the address, so a filtered list can be bookmarked or shared. */
function useFilters() {
  const [params, setParams] = useSearchParams();
  const get = (k, fallback = '') => params.get(k) ?? fallback;
  const filters = {
    q: get('q'),
    category: get('category'),
    sub: get('sub'),
    rarity: get('rarity'),
    book: get('book'),
    sort: get('sort', 'name'),
    min: Number(get('min', '0')),
    max: Number(get('max', String(MAX_LEVEL))),
  };
  // Built on the browser's address, which updates at once, so quick changes in a row
  // don't undo each other (the hook's own copy only updates on the next render).
  const set = (changes) =>
    setParams(
      () => {
        const next = new URLSearchParams(window.location.search);
        for (const [k, v] of Object.entries(changes)) {
          const empty = v === '' || v == null || (k === 'min' && v === 0) || (k === 'max' && v === MAX_LEVEL) || (k === 'sort' && v === 'name');
          if (empty) next.delete(k);
          else next.set(k, String(v));
        }
        return next;
      },
      { replace: true },
    );
  return [filters, set];
}

/** A short line of an item's key numbers for its card. */
function cardStats(i) {
  const parts = [];
  if (i.weapon?.damage) parts.push(i.weapon.damage);
  if (i.armor?.ac != null) parts.push(`AC +${i.armor.ac}`);
  if (i.shield?.ac != null) parts.push(`AC +${i.shield.ac}`, `Hardness ${i.shield.hardness}`);
  parts.push(i.price ?? 'No price');
  if (i.bulk && i.bulk !== '—') parts.push(`Bulk ${i.bulk}`);
  return parts.join(' · ');
}

/** The armory: every piece of equipment, searchable and filterable like the Bestiary. */
export default function ArmoryPage() {
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useFilters();
  const [shown, setShown] = useState(PAGE);

  useEffect(() => {
    loadArmory().then(setItems, () => setFailed(true));
  }, []);
  useEffect(() => {
    setShown(PAGE);
  }, [filters.q, filters.category, filters.sub, filters.rarity, filters.book, filters.sort, filters.min, filters.max]);

  const books = useMemo(() => (items ? [...new Set(items.map((i) => i.book).filter(Boolean))].sort() : []), [items]);
  const subs = useMemo(
    () => (items && filters.category ? [...new Set(items.filter((i) => i.category === filters.category).map((i) => i.subcategory).filter(Boolean))].sort() : []),
    [items, filters.category],
  );
  const matches = useMemo(() => {
    if (!items) return [];
    const q = filters.q.trim().toLowerCase();
    const list = items.filter(
      (i) =>
        (!q || i.name.toLowerCase().includes(q) || i.formerly?.toLowerCase().includes(q) || i.traits.some((t) => t.toLowerCase() === q)) &&
        (!filters.category || i.category === filters.category) &&
        (!filters.sub || i.subcategory === filters.sub) &&
        (!filters.rarity || i.rarity === filters.rarity) &&
        (!filters.book || i.book === filters.book) &&
        i.level >= filters.min &&
        i.level <= filters.max,
    );
    if (filters.sort === 'level') return [...list].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
    // Items without a price (artifacts and the like) go last.
    if (filters.sort === 'price') return [...list].sort((a, b) => (a.cp ?? Infinity) - (b.cp ?? Infinity) || a.name.localeCompare(b.name));
    return list;
  }, [items, filters]);

  const filtered = filters.q || filters.category || filters.sub || filters.rarity || filters.book || filters.min !== 0 || filters.max !== MAX_LEVEL;
  const total = ARMORY_CATEGORIES.reduce((t, c) => t + c.count, 0);

  return (
    <PageShell crumbs={[{ label: 'Armory' }]}>
      <header className="bestiary__head">
        <h1 className="title">Armory</h1>
        <p className="rule-note">
          {total} weapons, armor, shields and items, from every Pathfinder book, with their full rules. Search by name or trait, or narrow by category, level, rarity and book.
        </p>
      </header>

      <section className="panel bestiary__filters" aria-label="Filters">
        <label className="bestiary__search">
          <span className="visually-hidden">Search</span>
          <input id="armory-search" type="search" value={filters.q} placeholder="Search: longsword, potion, magical…" onChange={(e) => setFilters({ q: e.target.value })} />
        </label>
        <div className="bestiary__selects">
          <label>
            <span>Category</span>
            <select id="armory-category" value={filters.category} onChange={(e) => setFilters({ category: e.target.value, sub: '' })}>
              <option value="">Any category</option>
              {ARMORY_CATEGORIES.map((c) => <option key={c.slug} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
          </label>
          {subs.length > 0 && (
            <label>
              <span>Kind</span>
              <select id="armory-sub" value={filters.sub} onChange={(e) => setFilters({ sub: e.target.value })}>
                <option value="">Any kind</option>
                {subs.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          )}
          <label>
            <span>Level</span>
            <span className="bestiary__range">
              <select id="armory-min" value={filters.min} onChange={(e) => setFilters({ min: Number(e.target.value), max: Math.max(Number(e.target.value), filters.max) })} aria-label="Lowest level">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              to
              <select id="armory-max" value={filters.max} onChange={(e) => setFilters({ max: Number(e.target.value), min: Math.min(Number(e.target.value), filters.min) })} aria-label="Highest level">
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </span>
          </label>
          <label>
            <span>Rarity</span>
            <select id="armory-rarity" value={filters.rarity} onChange={(e) => setFilters({ rarity: e.target.value })}>
              <option value="">Any rarity</option>
              {RARITIES.map((r) => <option key={r} value={r}>{cap(r)}</option>)}
            </select>
          </label>
          <label>
            <span>Book</span>
            <select id="armory-book" value={filters.book} onChange={(e) => setFilters({ book: e.target.value })}>
              <option value="">Every book</option>
              {books.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select id="armory-sort" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value })}>
              {Object.entries(SORTS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
        </div>
      </section>

      {failed && <p className="form-errors" role="alert">Couldn't load the armory. Try refreshing.</p>}
      {!items && !failed && <p className="muted italic center">Opening the armory…</p>}

      {items && (
        <>
          <p className="bestiary__count" role="status">
            {matches.length === items.length ? `All ${matches.length} items` : `${matches.length} of ${items.length} items`}
            {filtered && (
              <>
                {' · '}
                <Link to="/armory" className="bestiary__clear">Clear filters</Link>
              </>
            )}
          </p>
          {matches.length ? (
            <ul className="creatures">
              {matches.slice(0, shown).map((i) => (
                <li key={i.id}>
                  <Link to={itemPath(i)} className="creature-card item-card">
                    <span className="creature-card__level" aria-label={itemLevel(i)}>
                      <small>ITEM</small>
                      {i.level}
                      {i.variants?.length > 1 ? '+' : ''}
                    </span>
                    <span className="creature-card__body">
                      <span className="creature-card__name">{i.name}</span>
                      <span className="creature-card__tags">
                        {i.rarity !== 'common' && <span className={`tag tag--rarity-${i.rarity}`}>{i.rarity}</span>}
                        <span className="tag tag--cantrip">{i.subcategory ?? i.category}</span>
                        {i.traits.slice(0, 2).map((t) => <span key={t} className="tag">{t}</span>)}
                      </span>
                      <span className="creature-card__stats">{cardStats(i)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel panel--dashed muted italic center">No items match. Try a wider level range or fewer filters.</p>
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

/** The numbers at the top of an item's page: price and bulk, then weapon, armor or shield stats. */
function quickFacts(i) {
  const signed = (n) => (n == null ? null : n >= 0 ? `+${n}` : String(n));
  return [
    ['Price', i.price ?? '—'],
    ['Bulk', i.bulk ?? '—'],
    i.usage && ['Usage', i.usage],
    i.hands && ['Hands', i.hands],
    ...(i.weapon
      ? [
          ['Damage', i.weapon.damage],
          ['Category', i.weapon.category],
          ['Group', i.weapon.group],
          ['Type', i.weapon.type],
          i.weapon.range && ['Range', i.weapon.range],
          i.weapon.reload != null && i.weapon.range && ['Reload', i.weapon.reload],
        ]
      : []),
    ...(i.armor
      ? [
          ['AC bonus', signed(i.armor.ac)],
          ['Dex cap', signed(i.armor.dexCap)],
          ['Strength', i.armor.strength ? `+${i.armor.strength}` : '—'],
          ['Check penalty', i.armor.checkPenalty ? String(i.armor.checkPenalty) : '—'],
          ['Speed penalty', i.armor.speedPenalty || '—'],
          i.armor.category && ['Category', i.armor.category],
          i.armor.group && ['Group', i.armor.group],
        ]
      : []),
    ...(i.shield
      ? [
          ['AC bonus', signed(i.shield.ac)],
          ['Hardness', i.shield.hardness],
          ['HP (BT)', i.shield.hp],
          i.shield.speedPenalty && ['Speed penalty', i.shield.speedPenalty],
        ]
      : []),
  ].filter((f) => f && f[1] != null && f[1] !== '');
}

/** One item: its traits, key numbers, and full rules text with its variants. */
export function ItemPage() {
  const { slug } = useParams();
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [html, setHtml] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);
  useEffect(() => {
    loadArmory().then(setItems, () => setFailed(true));
  }, []);
  const item = items?.find((x) => x.slug === slug);
  useEffect(() => {
    if (!item) return undefined;
    let cancelled = false;
    setHtml(null);
    loadItemDetails(item).then((h) => !cancelled && setHtml(h), () => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [item]);

  const crumbs = [{ label: 'Armory', to: '/armory' }, ...(item?.category ? [{ label: item.category, to: `/armory?category=${encodeURIComponent(item.category)}` }] : []), { label: item?.name ?? 'Item' }];
  if (failed) return <PageShell crumbs={crumbs}><p className="form-errors" role="alert">Couldn't load the armory. Try refreshing.</p></PageShell>;
  if (!items) return <PageShell crumbs={crumbs}><p className="muted italic center">Opening the armory…</p></PageShell>;
  if (!item) {
    return (
      <PageShell crumbs={crumbs}>
        <p className="muted italic center">There's no such item in the armory. <Link to="/armory">Back to the armory</Link></p>
      </PageShell>
    );
  }

  const facts = quickFacts(item);
  return (
    <PageShell crumbs={crumbs}>
      <article className="creature item-page">
        <header className="creature__head">
          <div className="creature__title">
            <h1 className="title">{item.name}</h1>
            <span className="creature__level">{itemLevel(item)}</span>
          </div>
          <p className="creature__traits">
            {item.rarity !== 'common' && <span className={`tag tag--rarity-${item.rarity}`}>{item.rarity}</span>}
            {item.traits.map((t) => <span key={t} className="tag">{t}</span>)}
          </p>
          {item.formerly && <p className="rule-note">Formerly {item.formerly}, before the Remaster.</p>}
        </header>

        <dl className="item-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>

        <section className="statblock" aria-label={`${item.name} rules`}>
          <div className="statblock__head">
            <span>{item.name}</span>
            <span>{itemLevel(item)}</span>
          </div>
          <div className="statblock__body item-text">
            {html == null ? <p className="muted italic">Reading the rules…</p> : html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : <p className="muted italic">No rules text beyond its price and Bulk.</p>}
          </div>
        </section>
        <p className="creature__source">
          {item.category}
          {item.subcategory ? ` · ${item.subcategory}` : ''} · {item.book}
          {item.page ? `, page ${item.page}` : ''} ·{' '}
          <a href={item.aon} target="_blank" rel="noreferrer">Archives of Nethys</a>
        </p>
        <p className="creature__license">{ARMORY_LICENSE}</p>
      </article>
    </PageShell>
  );
}
