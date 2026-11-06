// The rules glossary: rules, conditions, traits and actions from the Archives of Nethys
// (packages/rules/glossary/). The list loads the first time it's needed; each kind's text
// loads when one of its entries is opened.
import index from '@rollbound/rules/glossary/index.json';

export const GLOSSARY_KINDS = index.kinds;
export const GLOSSARY_LICENSE = index.license;

const LIST = import.meta.glob('../../../packages/rules/glossary/entries.json', { import: 'default' });
const DETAILS = import.meta.glob('../../../packages/rules/glossary/details/*.json', { import: 'default' });
const detailLoaders = Object.fromEntries(Object.entries(DETAILS).map(([path, load]) => [path.split('/').pop(), load]));
let entries = null;
const details = new Map();

const retryable = (promise, clear) =>
  promise.catch((err) => {
    clear();
    throw err;
  });

/** Every entry, sorted by name. Loads once. */
export function loadGlossary() {
  entries ??= retryable(Object.values(LIST)[0](), () => (entries = null));
  return entries;
}

/** One entry's text (HTML), from its kind's file. */
export function loadEntryText(entry) {
  if (!details.has(entry.details)) details.set(entry.details, retryable(detailLoaders[entry.details](), () => details.delete(entry.details)));
  return details.get(entry.details).then((byId) => byId[entry.id] ?? '');
}

/** Each kind's icon and plural, for the shelves and the index. */
export const KIND_INFO = {
  Rule: { icon: 'book', plural: 'Rules' },
  Condition: { icon: 'condition', plural: 'Conditions' },
  Action: { icon: 'swords', plural: 'Actions' },
  Trait: { icon: 'runes', plural: 'Traits' },
};
