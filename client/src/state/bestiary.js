// The bestiary: Monster Core and Monster Core 2, one file per book in
// packages/rules/bestiary/, each loaded the first time it's needed.
import index from '@rollbound/rules/bestiary/index.json';

export const BESTIARY_BOOKS = index.books;
export const BESTIARY_LICENSE = index.license;

const FILES = import.meta.glob(['../../../packages/rules/bestiary/*.json', '!**/index.json'], { import: 'default' });
const loaders = Object.fromEntries(Object.entries(FILES).map(([path, load]) => [path.split('/').pop(), load]));
let all = null;

/** Every creature in every book, sorted by level then name. Loads once. */
export function loadBestiary() {
  all ??= Promise.all(BESTIARY_BOOKS.map((b) => loaders[b.file]()))
    .then((lists) => lists.flat().sort((a, b) => a.level - b.level || a.name.localeCompare(b.name)))
    .catch((err) => {
      all = null;
      throw err;
    });
  return all;
}

/** A book's short name for links and tags: "Monster Core 2" → "mc2". */
export const bookKey = (book) => (book === 'Monster Core' ? 'mc' : book === 'Monster Core 2' ? 'mc2' : book.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
export const bookByKey = (key) => BESTIARY_BOOKS.find((b) => bookKey(b.book) === key)?.book ?? null;

/** Where a creature's page is. */
export const creaturePath = (c) => `/bestiary/${bookKey(c.book)}/${c.slug}`;
