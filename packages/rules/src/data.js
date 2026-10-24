// How the rules data is stored. The importer splits it into one file per book and
// type (data/player-core/feats.json and so on) plus data/index.json, which lists
// the files and carries the meta (version, books, license). Loaders read the files
// they need and put them back together with assembleData(), which gives the same
// shape the rest of the engine uses: { meta, skills, languages, ancestries, ... }.

/** Every list in the rules data, in the order they're stored. */
export const DATA_TYPES = ['skills', 'languages', 'ancestries', 'heritages', 'backgrounds', 'classes', 'feats', 'deities', 'spells', 'runes', 'weapons', 'armor', 'shields'];

/** What the builder's first steps (ancestry, background, class) need; the rest can load behind them. */
export const EARLY_TYPES = ['skills', 'languages', 'ancestries', 'heritages', 'backgrounds', 'classes', 'deities'];

// Lists of plain strings (skills, languages) aren't from any one book.
const COMMON = 'common';
const folderOf = (book) => book.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const byName = (a, b) => a.name.localeCompare(b.name);

/** Splits full rules data into { index, files: { path: items } }. */
export function splitData(data) {
  const files = {};
  const entries = [];
  for (const type of DATA_TYPES) {
    const groups = new Map();
    for (const item of data[type] ?? []) {
      const book = typeof item === 'object' ? (item.source ?? COMMON) : COMMON;
      if (!groups.has(book)) groups.set(book, []);
      groups.get(book).push(item);
    }
    for (const [book, items] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      const path = `${book === COMMON ? COMMON : folderOf(book)}/${type}.json`;
      files[path] = items;
      entries.push({ path, type, book: book === COMMON ? null : book, count: items.length });
    }
  }
  return { index: { meta: data.meta, files: entries }, files };
}

/** The core rules: every campaign includes it. */
export const CORE_BOOK = 'Player Core';

/**
 * A campaign's book list in its stored form: null means every book (including ones
 * added later), otherwise the chosen books in data order, always with Player Core.
 * Unknown titles are dropped.
 */
export function campaignBooks(selected, allBooks) {
  if (!Array.isArray(selected)) return null;
  const chosen = new Set([CORE_BOOK, ...selected]);
  const books = allBooks.filter((b) => chosen.has(b));
  return books.length === allBooks.length ? null : books;
}

/**
 * Whether a book's content is allowed under a campaign's books. Only the books
 * players choose (meta.books) are filtered; support books that other books borrow
 * from (deities from Divine Mysteries, a feat a class grants) always load.
 */
export const bookAllowed = (book, books, allBooks) => !books || !book || !allBooks.includes(book) || books.includes(book);

/**
 * The rules data as a campaign sees it: options from books it doesn't allow are
 * gone, including a book's extra subclass options for other books' classes. Feats
 * and spells that allowed content grants stay, whichever book prints them (a Dark
 * Archive background grants a Player Core 2 feat), so nobody loses what they're owed.
 */
export function campaignData(data, books) {
  if (!books) return data;
  const ok = (x) => bookAllowed(x.source, books, data.meta.books);
  const out = { ...data };
  for (const type of DATA_TYPES) if (data[type]?.length && typeof data[type][0] === 'object') out[type] = data[type].filter(ok);
  out.classes = out.classes.map((c) => ({
    ...c,
    features: c.features.map((f) => (f.choice ? { ...f, choice: { ...f.choice, options: f.choice.options.filter(ok) } } : f)),
  }));

  // Partly loaded data (the builder's first steps) may not have feats or spells yet.
  const add = (type, ids) => {
    if (!data[type]) return 0;
    const have = new Set(out[type].map((x) => x.id));
    const missing = data[type].filter((x) => ids.includes(x.id) && !have.has(x.id));
    if (missing.length) out[type] = [...out[type], ...missing].sort(byName);
    return missing.length;
  };
  const options = out.classes.flatMap((c) => c.features.flatMap((f) => f.choice?.options ?? []));
  add('spells', [...out.classes.flatMap((c) => c.casting?.grantedSpells ?? []), ...options.flatMap((o) => o.grantedSpells ?? [])]);
  // Granted feats can grant more feats, so repeat until nothing new comes in.
  while (
    add('feats', [
      ...(out.backgrounds ?? []).flatMap((b) => b.feats),
      ...(out.heritages ?? []).flatMap((h) => h.feats),
      ...out.classes.flatMap((c) => c.features.flatMap((f) => f.feats)),
      ...options.flatMap((o) => o.feats),
      ...(out.feats ?? []).flatMap((f) => f.feats),
    ])
  );
  return out;
}

/** The index entries to load, optionally only some types and books (null means all). */
export function dataFiles(index, { types = null, books = null } = {}) {
  return index.files.filter((f) => (!types || types.includes(f.type)) && bookAllowed(f.book, books, index.meta.books));
}

/**
 * Puts loaded files back together. loaded maps each path to its items; types
 * that weren't loaded are left out, so check before using them.
 */
export function assembleData(index, loaded) {
  const data = { meta: index.meta };
  for (const f of index.files) {
    if (!(f.path in loaded)) continue;
    (data[f.type] ??= []).push(...loaded[f.path]);
  }
  // Each book's file is sorted by name; merged lists are re-sorted the same way.
  for (const type of DATA_TYPES) if (data[type]?.length && typeof data[type][0] === 'object') data[type].sort(byName);
  return data;
}
