// The rules data and its version. The index is tiny (the version, books and file
// list), so any screen can tell whether a saved character was built from older
// data without loading the rules. The data itself is one file per book and type,
// each loaded the first time something needs it.
import index from '@rollbound/rules/data/index.json';
import { assembleData, dataFiles } from '@rollbound/rules';
import { api } from '../api.js';

export const RULES_VERSION = index.meta.version;
/** Every book RollBound has, in order; campaigns choose from these. */
export const ALL_BOOKS = index.meta.books;
/** A campaign's books for display: null means every book. */
export const booksLabel = (books) => (books ? books.join(' · ') : 'Every book');

const FILES = import.meta.glob(['../../../packages/rules/data/**/*.json', '!**/index.json'], { import: 'default' });
const loaders = Object.fromEntries(Object.entries(FILES).map(([path, load]) => [path.split('/data/')[1], load]));
const cache = new Map();

function loadFile(path) {
  if (!loaders[path]) return Promise.reject(new Error(`Rules data file ${path} is missing`));
  if (!cache.has(path)) {
    // A failed download can be retried on the next call.
    cache.set(path, loaders[path]().catch((err) => (cache.delete(path), Promise.reject(err))));
  }
  return cache.get(path);
}

/**
 * Loads the rules data, optionally only some types or books, e.g.
 * loadRules({ types: EARLY_TYPES }). Files already loaded are reused.
 */
export async function loadRules(filter) {
  const files = dataFiles(index, filter);
  const lists = await Promise.all(files.map((f) => loadFile(f.path)));
  return assembleData(index, Object.fromEntries(files.map((f, i) => [f.path, lists[i]])));
}

/** Whether a saved character was built from different rules data than the current one. */
export const isOutdated = (character) => Boolean(character?.build) && character.dataVersion !== RULES_VERSION;

/** Saves a new sheet over an existing character. */
export async function replaceCharacter(id, data) {
  await api.saveCharacter(id, data);
}
