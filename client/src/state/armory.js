// The armory: every piece of equipment from the Archives of Nethys (packages/rules/armory/).
// The list loads the first time it's needed; each category's rules text loads when one
// of its items is opened.
import index from '@rollbound/rules/armory/index.json';
import { ICON_PATHS } from '../components/iconPaths.js';

export const ARMORY_CATEGORIES = index.categories;
export const ARMORY_LICENSE = index.license;
export const ARMORY_COUNT = index.count;

const LIST = import.meta.glob('../../../packages/rules/armory/items.json', { import: 'default' });
const DETAILS = import.meta.glob('../../../packages/rules/armory/details/*.json', { import: 'default' });
const detailLoaders = Object.fromEntries(Object.entries(DETAILS).map(([path, load]) => [path.split('/').pop(), load]));
let items = null;
const details = new Map();

const retryable = (promise, clear) =>
  promise.catch((err) => {
    clear();
    throw err;
  });

/** Every item, sorted by name. Loads once. */
export function loadArmory() {
  items ??= retryable(Object.values(LIST)[0](), () => (items = null));
  return items;
}

/** One item's rules text (HTML), from its category's file. */
export function loadItemDetails(item) {
  if (!details.has(item.details)) details.set(item.details, retryable(detailLoaders[item.details](), () => details.delete(item.details)));
  return details.get(item.details).then((byId) => byId[item.id] ?? '');
}

/** Where an item's page is. */
export const itemPath = (item) => `/armory/${item.slug}`;

/** "Item 4" or "Item 4+" when it has stronger versions. */
export const itemLevel = (item) => `Item ${item.level}${item.variants?.length > 1 ? '+' : ''}`;

/** A category's Icon name (the anvil, for one without its own). */
export const categoryIcon = (category) => {
  const name = `item${category.replace(/[^A-Za-z]/g, '')}`;
  return ICON_PATHS[name] ? name : 'armory';
};
