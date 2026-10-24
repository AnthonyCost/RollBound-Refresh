// A character's inventory: what they carry and their coins. It's kept apart from
// the sheet the builder makes, so editing a character never touches it. Shape:
// { items: [{ key, kind, id, name, qty, bulk, price, note }], coins: { pp, gp, sp, cp } }
// kind is weapon, armor, shield or item for rules data (id points at it), or custom.
import { STARTING_GOLD_CP, gearCost } from './builder.js';

export const COINS = ['pp', 'gp', 'sp', 'cp'];
export const COIN_NAMES = { pp: 'Platinum', gp: 'Gold', sp: 'Silver', cp: 'Copper' };
const COIN_CP = { pp: 1000, gp: 100, sp: 10, cp: 1 };
export const ITEM_KINDS = ['weapon', 'armor', 'shield', 'item', 'custom'];

export const LIMITS = { items: 300, name: 120, note: 300, qty: 9999, bulk: 100, coins: 10_000_000, backstory: 20_000 };

const find = (list, id) => (id ? list?.find((x) => x.id === id) ?? null : null);
// randomUUID only exists on HTTPS pages (and localhost); getRandomValues works on any.
const newKey = () => Array.from(globalThis.crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');

/** What the coins are worth, in copper. */
export const coinValue = (coins) => COINS.reduce((t, c) => t + (coins?.[c] ?? 0) * COIN_CP[c], 0);

/** Copper as gold, silver and copper pieces (the way prices are paid). */
export function coinsFromCp(total) {
  return { pp: 0, gp: Math.floor(total / 100), sp: Math.floor((total % 100) / 10), cp: total % 10 };
}

/**
 * Coins after paying a price in copper, making change as needed and keeping
 * platinum where it can. null if the coins don't cover it.
 */
export function payCoins(coins, price) {
  const left = coinValue(coins) - price;
  if (left < 0) return null;
  const pp = Math.min(coins.pp ?? 0, Math.floor(left / 1000));
  return { ...coinsFromCp(left - pp * 1000), pp };
}

/** An inventory entry for a rules item: kind is weapon, armor, shield or item. */
export function inventoryItem(kind, item, qty = 1) {
  return { key: newKey(), kind, id: item.id, name: item.name, qty, bulk: item.bulk ?? 0, price: item.price ?? null, note: '' };
}

/** An inventory entry the player makes up: loot, a keepsake, anything not in the rules data. */
export function customItem(name, qty = 1, bulk = 0) {
  return { key: newKey(), kind: 'custom', id: null, name: name.trim(), qty, bulk, price: null, note: '' };
}

/**
 * The inventory a character starts with before anyone edits it: the gear chosen in
 * the builder, and whatever's left of the 15 gp. data needs weapons, armor and
 * shields. Characters without builder choices start with their sheet's gear and no coins.
 */
export function startingInventory(character, data) {
  const build = character.build;
  if (build && data?.weapons && data.armor && data.shields) {
    const items = [
      ...build.weapons.map((id) => find(data.weapons, id)).filter(Boolean).map((w) => inventoryItem('weapon', w)),
      ...[find(data.armor, build.armor)].filter(Boolean).map((a) => inventoryItem('armor', a)),
      ...[find(data.shields, build.shield)].filter(Boolean).map((s) => inventoryItem('shield', s)),
    ];
    return { items, coins: coinsFromCp(Math.max(0, STARTING_GOLD_CP - gearCost(build, data))) };
  }
  const named = (kind, x) => ({ key: newKey(), kind: 'custom', id: null, name: x.name, qty: 1, bulk: kind === 'armor' ? 2 : 1, price: null, note: '' });
  return {
    items: [
      ...(character.weapons ?? []).filter((w) => w.name !== 'Fist').map((w) => named('weapon', w)),
      ...(character.armor ? [named('armor', character.armor)] : []),
      ...(character.shield ? [named('shield', character.shield)] : []),
    ],
    coins: { pp: 0, gp: 0, sp: 0, cp: 0 },
  };
}

/**
 * Total Bulk. Light items (Bulk L, stored as 0.1) count 10 to 1 Bulk; items with no
 * Bulk count nothing. Returns { bulk, light } with light < 10, e.g. 3 Bulk and 4 L.
 */
export function bulkTotal(items) {
  const lights = items.reduce((t, i) => t + (i.bulk > 0 && i.bulk < 1 ? i.qty : 0), 0);
  const heavy = items.reduce((t, i) => t + (i.bulk >= 1 ? i.bulk * i.qty : 0), 0);
  return { bulk: Math.floor(heavy) + Math.floor(lights / 10), light: lights % 10 };
}

/** "3, 4 L", "4 L", "1" or "—": how Pathfinder writes Bulk. */
export function formatBulk({ bulk, light }) {
  return [bulk && String(bulk), light && `${light} L`].filter(Boolean).join(', ') || '—';
}

/** Bulk limits: encumbered above 5 + Str, and 10 + Str is the most you can carry. */
export const bulkLimits = (character) => ({ encumbered: 5 + character.abilities.str, max: 10 + character.abilities.str });

/** Problems with an inventory sent to the server (empty when it's fine). */
export function inventoryProblems(inv) {
  if (!inv || typeof inv !== 'object' || !Array.isArray(inv.items)) return ['Inventory must be { items, coins }.'];
  const errors = [];
  if (inv.items.length > LIMITS.items) errors.push(`An inventory can hold at most ${LIMITS.items} entries.`);
  const keys = new Set();
  inv.items.forEach((i, n) => {
    const at = `Item ${n + 1}`;
    if (!i || typeof i !== 'object') return errors.push(`${at} must be an object.`);
    if (typeof i.key !== 'string' || !i.key || i.key.length > 64 || keys.has(i.key)) errors.push(`${at} needs a unique key.`);
    keys.add(i.key);
    if (!ITEM_KINDS.includes(i.kind)) errors.push(`${at}: kind must be one of ${ITEM_KINDS.join(', ')}.`);
    if (i.kind !== 'custom' && (typeof i.id !== 'string' || !i.id || i.id.length > 64)) errors.push(`${at} needs the id of its rules item.`);
    if (typeof i.name !== 'string' || !i.name.trim() || i.name.length > LIMITS.name) errors.push(`${at}: name must be 1–${LIMITS.name} characters.`);
    if (!Number.isInteger(i.qty) || i.qty < 1 || i.qty > LIMITS.qty) errors.push(`${at}: quantity must be a whole number from 1 to ${LIMITS.qty}.`);
    if (typeof i.bulk !== 'number' || !(i.bulk >= 0 && i.bulk <= LIMITS.bulk)) errors.push(`${at}: Bulk must be from 0 to ${LIMITS.bulk}.`);
    if (i.price !== null && (!Number.isInteger(i.price) || i.price < 0)) errors.push(`${at}: price must be whole copper pieces, or null.`);
    if (typeof i.note !== 'string' || i.note.length > LIMITS.note) errors.push(`${at}: note must be ${LIMITS.note} characters or fewer.`);
  });
  for (const c of COINS) {
    const v = inv.coins?.[c];
    if (!Number.isInteger(v) || v < 0 || v > LIMITS.coins) errors.push(`${COIN_NAMES[c]} pieces must be a whole number from 0 to ${LIMITS.coins.toLocaleString('en-US')}.`);
  }
  return errors;
}
