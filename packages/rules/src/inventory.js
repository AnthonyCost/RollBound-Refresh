// A character's inventory: what they carry and their coins. It's kept apart from
// the sheet the builder makes, so editing a character never touches it. Shape:
// { items: [{ key, kind, id, name, qty, bulk, price, note, equipped }], coins: { pp, gp, sp, cp } }
// kind is weapon, armor, shield or item for rules data (id points at it), or custom.
// Equipped weapons, armor and shield are what the sheet's Strikes and AC use.
import { FIST, STARTING_GOLD_CP, gearCost, toArmor, toShield, toWeapon } from './builder.js';

export const COINS = ['pp', 'gp', 'sp', 'cp'];
export const COIN_NAMES = { pp: 'Platinum', gp: 'Gold', sp: 'Silver', cp: 'Copper' };
const COIN_CP = { pp: 1000, gp: 100, sp: 10, cp: 1 };
export const ITEM_KINDS = ['weapon', 'armor', 'shield', 'item', 'custom'];
/** Kinds the sheet can use: any number of weapons, one armor and one shield. */
export const EQUIPPABLE = ['weapon', 'armor', 'shield'];
const ONE_AT_A_TIME = ['armor', 'shield'];

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
export function inventoryItem(kind, item, qty = 1, equipped = false) {
  return { key: newKey(), kind, id: item.id, name: item.name, qty, bulk: item.bulk ?? 0, price: item.price ?? null, note: '', equipped: EQUIPPABLE.includes(kind) && equipped };
}

/** An inventory entry the player makes up: loot, a keepsake, anything not in the rules data. */
export function customItem(name, qty = 1, bulk = 0) {
  return { key: newKey(), kind: 'custom', id: null, name: name.trim(), qty, bulk, price: null, note: '', equipped: false };
}

/**
 * The inventory a character starts with before anyone edits it: their gear,
 * equipped, and whatever's left of the 15 gp. data needs weapons, armor and
 * shields. Characters without builder choices (the sample) match their sheet's
 * gear to the rules by name and start with no coins.
 */
export function startingInventory(character, data) {
  const build = character.build;
  if (build) {
    const items = [
      ...build.weapons.map((id) => find(data.weapons, id)).filter(Boolean).map((w) => inventoryItem('weapon', w, 1, true)),
      ...[find(data.armor, build.armor)].filter(Boolean).map((a) => inventoryItem('armor', a, 1, true)),
      ...[find(data.shields, build.shield)].filter(Boolean).map((s) => inventoryItem('shield', s, 1, true)),
    ];
    return { items, coins: coinsFromCp(Math.max(0, STARTING_GOLD_CP - gearCost(build, data))) };
  }
  const byName = (kind, list, x) => {
    const rule = list.find((r) => r.name.toLowerCase() === x.name.toLowerCase());
    return rule ? inventoryItem(kind, rule, 1, true) : { ...customItem(x.name, 1, kind === 'armor' ? 2 : 1) };
  };
  return {
    items: [
      ...(character.weapons ?? []).filter((w) => w.name !== FIST.name).map((w) => byName('weapon', data.weapons, w)),
      ...(character.armor ? [byName('armor', data.armor, character.armor)] : []),
      ...(character.shield ? [byName('shield', data.shields, character.shield)] : []),
    ],
    coins: { pp: 0, gp: 0, sp: 0, cp: 0 },
  };
}

/**
 * Whether each item is equipped. Inventories saved before equipping existed have
 * no equipped flags; for those, every weapon and the first armor and shield count,
 * which is what the sheet showed then.
 */
function equippedKeys(inv) {
  const legacy = !inv.items.some((i) => 'equipped' in i);
  const on = new Set();
  const taken = new Set();
  for (const i of inv.items) {
    if (!EQUIPPABLE.includes(i.kind) || !(legacy || i.equipped)) continue;
    if (ONE_AT_A_TIME.includes(i.kind)) {
      if (taken.has(i.kind)) continue;
      taken.add(i.kind);
    }
    on.add(i.key);
  }
  return on;
}

/** The inventory with every item's equipped flag spelled out (see equippedKeys). */
export function withEquipped(inv) {
  const on = equippedKeys(inv);
  return { ...inv, items: inv.items.map((i) => ({ ...i, equipped: on.has(i.key) })) };
}

/** Equips or unequips an item. Putting on armor or a shield takes off the one you had. */
export function toggleEquipped(inv, key) {
  const items = withEquipped(inv).items;
  const item = items.find((i) => i.key === key);
  if (!item || !EQUIPPABLE.includes(item.kind)) return inv;
  const wearing = !item.equipped;
  return {
    ...inv,
    items: items.map((i) => {
      if (i.key === key) return { ...i, equipped: wearing };
      if (wearing && ONE_AT_A_TIME.includes(item.kind) && i.kind === item.kind) return { ...i, equipped: false };
      return i;
    }),
  };
}

/**
 * The sheet as the inventory has it: Strikes from the equipped weapons (a fist if
 * none), AC from the equipped armor and shield. With no inventory yet, or without
 * weapons, armor and shields in data, the sheet is unchanged.
 */
export function equipCharacter(character, inv, data) {
  if (!inv || !data?.weapons || !data.armor || !data.shields) return character;
  const on = equippedKeys(inv);
  const equipped = (kind, list) => inv.items.filter((i) => i.kind === kind && on.has(i.key)).map((i) => find(list, i.id)).filter(Boolean);
  const weapons = equipped('weapon', data.weapons).map(toWeapon);
  const [armor] = equipped('armor', data.armor);
  const [shield] = equipped('shield', data.shields);
  return { ...character, weapons: weapons.length ? weapons : [FIST], armor: armor ? toArmor(armor) : null, shield: shield ? toShield(shield) : null };
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
    if (i.equipped !== undefined && typeof i.equipped !== 'boolean') errors.push(`${at}: equipped must be true or false.`);
    if (i.equipped && !EQUIPPABLE.includes(i.kind)) errors.push(`${at}: only weapons, armor and shields can be equipped.`);
  });
  for (const kind of ONE_AT_A_TIME) {
    if (inv.items.filter((i) => i?.kind === kind && i.equipped).length > 1) errors.push(`Only one ${kind === 'armor' ? 'suit of armor' : 'shield'} can be equipped.`);
  }
  for (const c of COINS) {
    const v = inv.coins?.[c];
    if (!Number.isInteger(v) || v < 0 || v > LIMITS.coins) errors.push(`${COIN_NAMES[c]} pieces must be a whole number from 0 to ${LIMITS.coins.toLocaleString('en-US')}.`);
  }
  return errors;
}
