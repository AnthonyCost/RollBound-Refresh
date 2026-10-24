// How the rules data is stored. The importer splits it into one file per book and
// type (data/player-core/feats.json and so on) plus data/index.json, which lists
// the files and carries the meta (version, books, license). Loaders read the files
// they need and put them back together with assembleData(), which gives the same
// shape the rest of the engine uses: { meta, skills, languages, ancestries, ... }.

/** Every list in the rules data, in the order they're stored. */
export const DATA_TYPES = ['skills', 'languages', 'ancestries', 'heritages', 'backgrounds', 'classes', 'feats', 'deities', 'spells', 'weapons', 'armor', 'shields'];

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

/** The index entries to load, optionally only some types and books (null means all). */
export function dataFiles(index, { types = null, books = null } = {}) {
  return index.files.filter((f) => (!types || types.includes(f.type)) && (!books || !f.book || books.includes(f.book)));
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
