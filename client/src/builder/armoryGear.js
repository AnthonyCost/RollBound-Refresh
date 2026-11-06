// The armory's gear a new character can buy in the builder: every item that isn't a weapon,
// armor or shield (those have their own lists, with the numbers the sheet uses), at level 1
// or lower and within the starting 15 gp. Rare and unique items need more than a GM's nod, so
// they're left out; uncommon ones are offered with a note to ask. An item with stronger
// versions (Healing Potion) offers each version that qualifies (Healing Potion (Minor)).
import { STARTING_GOLD_CP } from '@rollbound/rules';

const OWN_LISTS = new Set(['Weapons', 'Armor', 'Shields']);
const CONSUMABLE = new Set(['Consumables', 'Alchemical Items', 'Snares']);
const COIN = { pp: 1000, gp: 100, sp: 10, cp: 1 };

/** "1,500 gp" or "5 sp" in copper; null for anything else ("from 4 gp", "—"). */
export function priceCp(text) {
  const m = /^\s*([\d,]+)\s*(pp|gp|sp|cp)\s*$/.exec(text ?? '');
  return m ? Number(m[1].replace(/,/g, '')) * COIN[m[2]] : null;
}
console.assert(priceCp('1,500 gp') === 150000 && priceCp('5 sp') === 50 && priceCp('from 4 gp') === null, 'priceCp');

/** An armory Bulk ("L", "1", "—", null) as the inventory's number: light is 0.1. */
export const bulkOf = (b) => (b === 'L' ? 0.1 : Number.isFinite(Number(b)) && b != null && b !== '' ? Number(b) : 0);

/**
 * The buyable gear, as builder items: { id, name, kind: 'gear' | 'consumable', item }, where
 * item is { id, name, level, rarity, traits, usage, bulk, price (cp), source, category, armory }.
 */
export function starterGear(armory) {
  const out = [];
  for (const a of armory) {
    if (OWN_LISTS.has(a.category) || !['common', 'uncommon'].includes(a.rarity)) continue;
    const versions = a.variants?.length
      ? a.variants.map((v, i) => ({ id: `${a.id}-${i}`, name: v.name, level: v.level ?? a.level, price: priceCp(v.price) }))
      : [{ id: a.id, name: a.name, level: a.level, price: a.cp }];
    for (const v of versions) {
      if (v.price == null || v.level > 1 || v.price > STARTING_GOLD_CP) continue;
      out.push({
        id: `${CONSUMABLE.has(a.category) ? 'consumable' : 'gear'}:${v.id}`,
        name: v.name,
        kind: CONSUMABLE.has(a.category) ? 'consumable' : 'gear',
        item: { id: v.id, name: v.name, level: v.level, rarity: a.rarity, traits: a.traits, usage: a.usage, bulk: bulkOf(a.bulk), price: v.price, source: a.book, category: a.category, armory: a },
      });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}
