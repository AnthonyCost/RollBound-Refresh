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
    assert.deepEqual(inv.items.map((i) => [i.kind, i.name]), [['weapon', 'Longsword'], ['armor', 'Chain Mail']]);
    assert.equal(R.coinValue(inv.coins), R.STARTING_GOLD_CP - R.gearCost(build, data));
    assert.deepEqual(R.inventoryProblems(inv), []);
  });

  it('starts characters without builder choices with their sheet gear and no coins', () => {
    const inv = R.startingInventory(R.mira, data);
    assert.deepEqual(inv.items.map((i) => i.name), ['Longsword', 'Chain mail']);
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
