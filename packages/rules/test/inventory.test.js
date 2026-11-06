import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const data = loadRulesData();
const byName = (list, name) => list.find((x) => x.name === name);

describe('inventory', () => {
  it('imports general gear with prices and Bulk', () => {
    const rope = byName(data.items, 'Rope');
    assert.equal(rope.price, 50);
    assert.equal(rope.bulk, 0.1);
    assert.ok(data.items.length > 300);
    assert.ok(data.items.some((i) => i.category === 'consumable') && data.items.some((i) => i.category === 'container'));
  });

  it("starts with the builder's gear and what's left of 15 gp", () => {
    const build = { ...R.emptyBuild(), weapons: [byName(data.weapons, 'Longsword').id], armor: byName(data.armor, 'Chain Mail').id };
    const inv = R.startingInventory({ build }, data);
    assert.deepEqual(inv.items.map((i) => [i.kind, i.name, i.equipped]), [['weapon', 'Longsword', true], ['armor', 'Chain Mail', true]]);
    assert.equal(R.coinValue(inv.coins), R.STARTING_GOLD_CP - R.gearCost(build, data));
    assert.deepEqual(R.inventoryProblems(inv), []);
  });

  it('starts with gear bought from the armory, priced and counted against the 15 gp', () => {
    const build = { ...R.emptyBuild(), gear: [{ id: 'aon-equipment-2943-0', name: 'Healing Potion (Minor)', price: 400, bulk: 0.1, qty: 2 }] };
    assert.equal(R.gearCost(build, data), 800);
    const inv = R.startingInventory({ build }, data);
    assert.deepEqual(inv.items.map((i) => [i.kind, i.name, i.qty, i.price, i.equipped]), [['custom', 'Healing Potion (Minor)', 2, 400, false]]);
    assert.equal(R.coinValue(inv.coins), R.STARTING_GOLD_CP - 800);
    assert.deepEqual(R.inventoryProblems(inv), []);
    // A build saved before armory gear existed has none.
    const { gear, ...old } = build;
    assert.equal(R.gearCost({ ...old }, data), 0);
  });

  it('starts characters without builder choices with their sheet gear, matched to the rules, and no coins', () => {
    const inv = R.startingInventory(R.mira, data);
    assert.deepEqual(inv.items.map((i) => [i.kind, i.name, i.equipped]), [['weapon', 'Longsword', true], ['armor', 'Chain Mail', true]]);
    assert.equal(R.coinValue(inv.coins), 0);
  });

  it('adds up Bulk the Pathfinder way', () => {
    const items = [{ bulk: 1, qty: 2 }, { bulk: 0.1, qty: 13 }, { bulk: 0, qty: 50 }];
    assert.deepEqual(R.bulkTotal(items), { bulk: 3, light: 3 });
    assert.equal(R.formatBulk(R.bulkTotal(items)), '3, 3 L');
    assert.equal(R.formatBulk(R.bulkTotal([{ bulk: 0.1, qty: 9 }])), '9 L');
    assert.equal(R.formatBulk(R.bulkTotal([])), '—');
    assert.deepEqual(R.bulkLimits(R.mira), { encumbered: 9, max: 14 });
  });

  it('values coins in copper', () => {
    assert.equal(R.coinValue({ pp: 1, gp: 2, sp: 3, cp: 4 }), 1234);
    assert.deepEqual(R.coinsFromCp(1234), { pp: 0, gp: 12, sp: 3, cp: 4 });
  });

  it('pays for things, making change', () => {
    assert.deepEqual(R.payCoins({ pp: 0, gp: 2, sp: 0, cp: 0 }, 50), { pp: 0, gp: 1, sp: 5, cp: 0 });
    assert.deepEqual(R.payCoins({ pp: 1, gp: 0, sp: 0, cp: 5 }, 5), { pp: 1, gp: 0, sp: 0, cp: 0 });
    assert.deepEqual(R.payCoins({ pp: 1, gp: 0, sp: 0, cp: 0 }, 1), { pp: 0, gp: 9, sp: 9, cp: 9 });
    assert.equal(R.payCoins({ pp: 0, gp: 0, sp: 4, cp: 0 }, 50), null);
  });

  it('equips and unequips: the sheet follows', () => {
    const start = R.startingInventory(R.mira, data);
    // As started, the sheet is the same as before.
    const same = R.equipCharacter(R.mira, start, data);
    assert.equal(R.armorClass(same).total, R.armorClass(R.mira).total);
    assert.deepEqual(same.weapons.map((w) => w.name), ['Longsword']);
    // Take the armor off: AC drops to unarmored.
    const chain = start.items.find((i) => i.kind === 'armor');
    const off = R.toggleEquipped(start, chain.key);
    assert.equal(R.equipCharacter(R.mira, off, data).armor, null);
    assert.ok(R.armorClass(R.equipCharacter(R.mira, off, data)).total < R.armorClass(R.mira).total);
    // Removing the longsword leaves a fist.
    const noSword = { ...start, items: start.items.filter((i) => i.kind !== 'weapon') };
    assert.deepEqual(R.equipCharacter(R.mira, noSword, data).weapons.map((w) => w.name), ['Fist']);
    // A second weapon adds a Strike.
    const dagger = R.inventoryItem('weapon', byName(data.weapons, 'Dagger'));
    const two = R.toggleEquipped({ ...start, items: [...start.items, dagger] }, dagger.key);
    assert.deepEqual(R.equipCharacter(R.mira, two, data).weapons.map((w) => w.name), ['Longsword', 'Dagger']);
    assert.deepEqual(R.inventoryProblems(two), []);
  });

  it('wears one armor and one shield at a time', () => {
    const start = R.startingInventory(R.mira, data);
    const leather = R.inventoryItem('armor', byName(data.armor, 'Leather Armor'));
    const swapped = R.toggleEquipped({ ...start, items: [...start.items, leather] }, leather.key);
    assert.deepEqual(swapped.items.filter((i) => i.equipped).map((i) => i.name), ['Longsword', 'Leather Armor']);
    assert.equal(R.equipCharacter(R.mira, swapped, data).armor.name, 'Leather Armor');
    const both = { ...swapped, items: swapped.items.map((i) => (i.kind === 'armor' ? { ...i, equipped: true } : i)) };
    assert.ok(R.inventoryProblems(both).some((e) => /one suit of armor/.test(e)));
    const custom = R.customItem('Locket');
    assert.equal(R.toggleEquipped({ ...start, items: [custom] }, custom.key).items[0].equipped, false);
    assert.ok(R.inventoryProblems({ ...start, items: [{ ...custom, equipped: true }] }).some((e) => /only weapons/.test(e)));
  });

  it('treats inventories saved before equipping as wearing their gear', () => {
    const start = R.startingInventory(R.mira, data);
    const legacy = { ...start, items: start.items.map(({ equipped, ...i }) => i) };
    assert.equal(R.armorClass(R.equipCharacter(R.mira, legacy, data)).total, R.armorClass(R.mira).total);
    assert.deepEqual(R.withEquipped(legacy).items.map((i) => i.equipped), [true, true]);
  });

  it('leaves the sheet alone with no inventory or no gear data', () => {
    assert.equal(R.equipCharacter(R.mira, null, data), R.mira);
    assert.equal(R.equipCharacter(R.mira, R.startingInventory(R.mira, data), { spells: [] }), R.mira);
  });

  it('rejects bad inventories', () => {
    const ok = { items: [R.customItem('Lucky coin')], coins: { pp: 0, gp: 1, sp: 0, cp: 0 } };
    assert.deepEqual(R.inventoryProblems(ok), []);
    assert.ok(R.inventoryProblems(null).length);
    assert.ok(R.inventoryProblems({ ...ok, coins: { ...ok.coins, gp: -1 } }).some((e) => /Gold/.test(e)));
    assert.ok(R.inventoryProblems({ ...ok, items: [{ ...ok.items[0], qty: 0 }] }).some((e) => /quantity/.test(e)));
    assert.ok(R.inventoryProblems({ ...ok, items: [{ ...ok.items[0], name: ' ' }] }).some((e) => /name/.test(e)));
    assert.ok(R.inventoryProblems({ ...ok, items: [ok.items[0], ok.items[0]] }).some((e) => /unique key/.test(e)));
    assert.ok(R.inventoryProblems({ ...ok, items: [{ ...ok.items[0], kind: 'weapon' }] }).some((e) => /id of its rules item/.test(e)));
  });
});

describe('shield damage', () => {
  const steel = data.shields.find((s) => s.name === 'Steel Shield');
  const withShield = (damage, equipped = true) => ({ items: [{ ...R.inventoryItem('shield', steel, 1, equipped), ...(damage != null && { damage }) }], coins: { pp: 0, gp: 0, sp: 0, cp: 0 } });

  it('reports the equipped shield at full Hit Points with no damage', () => {
    const s = R.shieldState(withShield(null), data);
    assert.deepEqual([s.current, s.max, s.hardness, s.brokenAt, s.broken, s.destroyed], [20, 20, 5, 10, false, false]);
    assert.equal(R.shieldState(withShield(null, false), data), null);
  });

  it('breaks at its Broken Threshold and is destroyed at 0', () => {
    assert.equal(R.shieldState(withShield(9), data).broken, false);
    assert.equal(R.shieldState(withShield(10), data).broken, true);
    const gone = R.shieldState(withShield(25), data);
    assert.deepEqual([gone.current, gone.destroyed], [0, true]);
  });

  it('saves damage on the shield and checks it', () => {
    const inv = withShield(null);
    const hurt = R.setItemDamage(inv, inv.items[0].key, 7.4);
    assert.equal(hurt.items[0].damage, 7);
    assert.deepEqual(R.inventoryProblems(hurt), []);
    assert.ok(R.inventoryProblems({ ...hurt, items: [{ ...hurt.items[0], damage: -1 }] }).length);
    assert.ok(R.inventoryProblems({ ...hurt, items: [{ ...hurt.items[0], damage: 1.5 }] }).length);
  });
});

describe('consumables', () => {
  const armory = JSON.parse(readFileSync(new URL('../armory/details/consumables.json', import.meta.url)));
  const potion = armory['aon-equipment-2943'];
  it("reads a healing potion's action and each grade's healing", () => {
    assert.deepEqual(
      ['Healing Potion (Minor)', 'Healing Potion (Lesser)', 'Healing Potion (Major)'].map((n) => R.consumableUse(potion, n)).map(({ cost, heal }) => [cost, heal]),
      [['1', '1d8'], ['1', '2d8+5'], ['1', '8d8+30']],
    );
    assert.match(R.consumableUse(potion, 'Healing Potion (Minor)').text, /regain the listed number of Hit Points.*restores 1d8/);
  });
  it('is empty for an item with no rules text', () => {
    assert.deepEqual(R.consumableUse(''), { cost: null, heal: null, text: '' });
  });
});
