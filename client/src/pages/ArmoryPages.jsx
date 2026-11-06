import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import BookSpread, { LETTER_SECTIONS, letterOf } from '../components/BookSpread.jsx';
import { ARMORY_CATEGORIES, ARMORY_LICENSE, categoryIcon, itemLevel, itemPath, loadArmory, loadItemDetails } from '../state/armory.js';

const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const LEVELS = Array.from({ length: 29 }, (_, i) => i);
const MAX_LEVEL = 28;
const SORTS = { name: 'Name', level: 'Level', price: 'Price' };
const cap = (s) => s[0].toUpperCase() + s.slice(1);
// The biggest categories, as shelves across the top. The rest are in the Category filter.
const SHELVES = ['Weapons', 'Armor', 'Shields', 'Consumables', 'Alchemical Items', 'Worn Items', 'Held Items', 'Adventuring Gear', 'Runes', 'Staves', 'Wands', 'Artifacts'];
const countOf = (name) => ARMORY_CATEGORIES.find((c) => c.name === name)?.count ?? 0;

// The index's sections follow its sort: letters, levels or price bands (prices in copper).
const PRICE_BANDS = [
  { key: 'under-1', tab: 'Under 1 gp', name: 'Under 1 gp', below: 100 },
  { key: '1', tab: '1 gp', name: '1 to 9 gp', below: 1000 },
  { key: '10', tab: '10 gp', name: '10 to 99 gp', below: 10000 },
  { key: '100', tab: '100 gp', name: '100 to 999 gp', below: 100000 },
  { key: '1000', tab: '1,000 gp', name: '1,000 gp or more', below: Infinity },
  { key: 'none', tab: 'No price', name: 'No price', below: null },
];
const priceBand = (i) => (i.cp == null ? 'none' : PRICE_BANDS.find((b) => b.below != null && i.cp < b.below).key);
const INDEXES = {
  name: { sections: LETTER_SECTIONS, sectionOf: letterOf },
  level: { sections: LEVELS.map((l) => ({ key: l, tab: String(l), name: `Level ${l}` })), sectionOf: (i) => i.level },
  price: { sections: PRICE_BANDS, sectionOf: priceBand, tabsOnTop: true },
};

const TRAIT_SECTION = '~trait';
/** Whether a search finds this item only by a trait or its former name, not its name. */
const isTraitMatch = (i, q) => Boolean(q) && !i.name.toLowerCase().includes(q);

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
        next.delete('page');
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

/**
 * The armory: every piece of equipment, laid out like an open book (see BookSpread), with
 * shelves for the biggest categories above it. The open item is at /armory/:slug. Filters
 * stay in the address, so opening an item keeps your place in the index.
 */
export default function ArmoryPage() {
  const { slug } = useParams();
  const { search } = useLocation();
  const [items, setItems] = useState(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useFilters();

  useEffect(() => {
    loadArmory().then(setItems, () => setFailed(true));
  }, []);
  useEffect(() => {
    if (slug) window.scrollTo(0, 0);
  }, [slug]);

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
    // A search lists items named for it before ones that only have it as a trait or a former name:
    // "healing" shows Healing Potion first, not after the 48 items with the Healing trait.
    const named = (i) => (isTraitMatch(i, q) ? 1 : 0);
    const order =
      filters.sort === 'level' ? (a, b) => a.level - b.level || a.name.localeCompare(b.name)
      // Items without a price (artifacts and the like) go last.
      : filters.sort === 'price' ? (a, b) => (a.cp ?? Infinity) - (b.cp ?? Infinity) || a.name.localeCompare(b.name)
      : () => 0;
    return [...list].sort((a, b) => named(a) - named(b) || order(a, b));
  }, [items, filters]);

  const filtered = filters.q || filters.category || filters.sub || filters.rarity || filters.book || filters.min !== 0 || filters.max !== MAX_LEVEL;
  const total = ARMORY_CATEGORIES.reduce((t, c) => t + c.count, 0);
  const open = slug && items ? items.find((x) => x.slug === slug) ?? null : null;
  const closeTo = `/armory${search}`;
  const sorted = INDEXES[filters.sort] ?? INDEXES.name;
  // Items found only by trait or former name get a section of their own, after the named ones.
  const q = filters.q.trim().toLowerCase();
  const index = q && matches.some((i) => isTraitMatch(i, q))
    ? {
        ...sorted,
        sections: [...sorted.sections, { key: TRAIT_SECTION, tab: 'Trait', name: 'Has the trait or a former name' }],
        sectionOf: (i) => (isTraitMatch(i, q) ? TRAIT_SECTION : sorted.sectionOf(i)),
      }
    : sorted;
  const chooseCategory = (category) => setFilters({ category: category === filters.category ? '' : category, sub: '' });

  return (
    <PageShell crumbs={slug ? [{ label: 'Armory', to: closeTo }, ...(open?.category ? [{ label: open.category, to: `/armory?category=${encodeURIComponent(open.category)}` }] : []), { label: open?.name ?? 'Item' }] : [{ label: 'Armory' }]}>
      <header className={`bestiary__head ${slug ? 'book__intro--open' : ''}`}>
        <h1 className="title">Armory</h1>
        <p className="rule-note">
          {total.toLocaleString()} weapons, armor, shields and items, from every Pathfinder book, with their full rules. Pick a shelf, search by name or trait, or narrow by level, rarity and book.
        </p>
      </header>

      <div className={`armory-shelves ${slug ? 'armory-shelves--open' : ''}`} role="group" aria-label="Categories">
        {SHELVES.map((name) => (
          <button key={name} type="button" className="armory-shelf" aria-pressed={filters.category === name} onClick={() => chooseCategory(name)}>
            <Icon name={categoryIcon(name)} size={32} />
            <span className="armory-shelf__name">{name}</span>
            <span className="armory-shelf__count">{countOf(name)}</span>
          </button>
        ))}
      </div>

      <section className={`panel bestiary__filters ${slug ? 'book__filters--open' : ''}`} aria-label="Filters">
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

      {slug && items && !open && (
        <p className="muted italic center">There's no such item in the armory. <Link to={closeTo}>Back to the index</Link></p>
      )}

      {items && (
        <BookSpread
          items={matches}
          total={items.length}
          noun="items"
          sections={index.sections}
          sectionOf={index.sectionOf}
          tabsOnTop={index.tabsOnTop}
          open={open}
          href={(i) => `${itemPath(i)}${search}`}
          lead={(i) => (
            <span className="book__type" title={i.subcategory ?? i.category}>
              <Icon name={categoryIcon(i.category)} size={18} />
              <span className="visually-hidden">{i.category}: </span>
            </span>
          )}
          meta={(i) => (
            <>
              {i.rarity !== 'common' && <span className={`tag tag--rarity-${i.rarity}`}>{i.rarity}</span>}
              {filters.sort === 'price' && i.price && <span className="armory-price">{i.price}</span>}
              <span className="book__level" aria-label={itemLevel(i)}>{i.level}{i.variants?.length > 1 ? '+' : ''}</span>
            </>
          )}
          leaf={open && <ItemEntry key={open.id} item={open} closeTo={closeTo} setFailed={setFailed} />}
          blankIcon="armory"
          blank={
            <>
              <p className="book__blank-title">Choose an item</p>
              <p className="rule-note">Pick an item from the index to read its rules here. Use the tabs to jump ahead, and the arrow keys to turn pages.</p>
            </>
          }
          filtered={filtered}
          clearTo="/armory"
          emptyText="No items match. Try a wider level range or fewer filters."
        />
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

/** One item, as the right-hand page: its traits, key numbers, and full rules text with its variants. */
function ItemEntry({ item, closeTo, setFailed }) {
  const [html, setHtml] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadItemDetails(item).then((h) => !cancelled && setHtml(h), () => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [item, setFailed]);

  return (
    <article className="creature book__turn item-page">
      <Link to={closeTo} className="book__back">‹ Back to the index</Link>
      <header className="creature__head">
        <div className="creature__title">
          <span className="creature__type" title={item.subcategory ?? item.category}><Icon name={categoryIcon(item.category)} size={30} /></span>
          <h2 className="title">{item.name}</h2>
          <span className="creature__level">{itemLevel(item)}</span>
        </div>
        <p className="creature__traits">
          {item.rarity !== 'common' && <span className={`tag tag--rarity-${item.rarity}`}>{item.rarity}</span>}
          <span className="tag tag--cantrip">{item.subcategory ?? item.category}</span>
          {item.traits.map((t) => <span key={t} className="tag">{t}</span>)}
        </p>
        {item.formerly && <p className="rule-note">Formerly {item.formerly}, before the Remaster.</p>}
      </header>

      <dl className="item-facts">
        {quickFacts(item).map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <section className="statblock" aria-label={`${item.name} rules`}>
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
  );
}
