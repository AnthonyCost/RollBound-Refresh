// The armory's gear a new character can buy in the builder: every item that isn't a weapon,
// armor or shield (those have their own lists, with the numbers the sheet uses), at level 1
// or lower and within the starting 15 gp. Rare and unique items need more than a GM's nod, so
// they're left out; uncommon ones are offered with a note to ask. An item with stronger
// versions (Healing Potion) offers each version that qualifies (Healing Potion (Minor)).
import { LIMITS, STARTING_GOLD_CP } from '@rollbound/rules';

const OWN_LISTS = new Set(['Weapons', 'Armor', 'Shields']);
const CONSUMABLE = new Set(['Consumables', 'Alchemical Items', 'Snares']);
const COIN = { pp: 1000, gp: 100, sp: 10, cp: 1 };

/** "1,500 gp" or "5 sp" in copper; null for anything else ("from 4 gp", "—"). */
export function priceCp(text) {
  const m = /^\s*([\d,]+)\s*(pp|gp|sp|cp)\s*$/.exec(text ?? '');
  return m ? Number(m[1].replace(/,/g, '')) * COIN[m[2]] : null;
}
console.assert(priceCp('1,500 gp') === 150000 && priceCp('5 sp') === 50 && priceCp('from 4 gp') === null, 'priceCp');

/** An armory Bulk ("L", "1", "L when not activated", "—", null) as the inventory's number: light is 0.1. */
export function bulkOf(b) {
  const m = /^\s*(L|\d+)/.exec(b ?? '');
  return !m ? 0 : m[1] === 'L' ? 0.1 : Math.min(LIMITS.bulk, Number(m[1]));
}
console.assert(bulkOf('L') === 0.1 && bulkOf('2') === 2 && bulkOf('L when not activated') === 0.1 && bulkOf('—') === 0 && bulkOf(null) === 0 && bulkOf('250') === LIMITS.bulk, 'bulkOf');

/**
 * Every armory item a merchant could sell, one per version (Healing Potion (Minor), (Lesser)…):
 * { id, name, level, price (cp, or null when it has none), armory }, sorted by name.
 */
export function armoryWares(armory) {
  return armory
    .flatMap((a) =>
      a.variants?.length
        ? a.variants.map((v, i) => ({ id: `${a.id}-${i}`, name: v.name, level: v.level ?? a.level, price: priceCp(v.price), armory: a }))
        : [{ id: a.id, name: a.name, level: a.level, price: a.cp ?? null, armory: a }],
    )
    .sort((x, y) => x.name.localeCompare(y.name));
}

/**
 * The buyable gear, as builder items: { id, name, kind: 'gear' | 'consumable', item }, where
 * item is { id, name, level, rarity, traits, usage, bulk, price (cp), source, category, armory }.
 */
export function starterGear(armory) {
  return armoryWares(armory)
    .filter((v) => !OWN_LISTS.has(v.armory.category) && ['common', 'uncommon'].includes(v.armory.rarity) && v.price != null && v.level <= 1 && v.price <= STARTING_GOLD_CP)
    .map(({ id, name, level, price, armory: a }) => {
      const kind = CONSUMABLE.has(a.category) ? 'consumable' : 'gear';
      return { id: `${kind}:${id}`, name, kind, item: { id, name, level, rarity: a.rarity, traits: a.traits, usage: a.usage, bulk: bulkOf(a.bulk), price, source: a.book, category: a.category, armory: a } };
    });
}
