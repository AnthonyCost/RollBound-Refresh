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

// Art from client/src/assets/creatures/: <slug>.webp (the whole picture) and
// <slug>-thumb.webp (a small square). Only their URLs load here; each image
// downloads when it's shown.
const ART = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/creatures/*.webp', { eager: true, query: '?url', import: 'default' })).map(([path, url]) => [
    path.split('/').pop().replace('.webp', ''),
    url,
  ]),
);

/** A creature's small square thumbnail URL, or null when it has none. */
export const creatureThumb = (c) => ART[`${c.slug}-thumb`] ?? null;

/** A creature's whole picture, for its page, or null when it has none. */
export const creatureArt = (c) => ART[c.slug] ?? null;

// A creature's type for its icon. Some have two (a Giant is also Humanoid, a skeletal
// dragon also Undead), so the first in this list wins: the more telling type goes first.
const TYPE_ORDER = ['Dragon', 'Undead', 'Time', 'Dream', 'Construct', 'Giant', 'Fiend', 'Celestial', 'Monitor', 'Elemental', 'Fungus', 'Ooze', 'Spirit', 'Ethereal', 'Astral', 'Aberration', 'Fey', 'Plant', 'Beast', 'Animal', 'Humanoid'];
/** { type, icon } for a creature, by its traits. Shadow creatures have no type of their own. */
export function creatureType(c) {
  const type = TYPE_ORDER.find((t) => c.traits.includes(t));
  if (type) return { type, icon: `creature${type}` };
  return c.traits.some((t) => t === 'Shade' || t === 'Shadow') ? { type: 'Shadow', icon: 'creatureShadow' } : { type: 'Creature', icon: 'creatureOther' };
}
