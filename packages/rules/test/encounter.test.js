import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTurn, applyCombatAction, cycleCondition, endTurn, CONDITIONS, armorClass, savingThrow, perception, strikeBonus, currentCombatant, initiativeOrder, maxHp, moveCombatant, placeByInitiative, startEncounter, migrateBuild, buildCharacter, PREGENS } from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const c = (key, kind, initiative, extra = {}) => ({ key, kind, name: key, perception: 0, initiative, defeated: false, ...extra });
// A die that rolls these numbers in turn.
const dice = (...rolls) => () => (rolls.shift() - 1) / 20;

describe('running an encounter', () => {
  it('orders by initiative, creatures before characters on a tie', () => {
    const order = initiativeOrder([c('Ezren', 'pc', 15), c('Goblin', 'creature', 15), c('Kyra', 'pc', 20), c('Orc', 'creature', 3)]);
    assert.deepEqual(order.map((x) => x.key), ['Kyra', 'Goblin', 'Ezren', 'Orc']);
  });

  it('rolls d20 + Perception for everyone and starts round 1 with the highest', () => {
    const state = startEncounter([c('Ezren', 'pc', null, { perception: 5 }), c('Goblin', 'creature', null, { perception: 2 })], dice(10, 18));
    assert.equal(state.round, 1);
    assert.deepEqual(state.combatants.map((x) => [x.key, x.initiative]), [['Goblin', 20], ['Ezren', 15]]);
    assert.equal(currentCombatant(state).key, 'Goblin');
  });

  it('moves through turns, skips the defeated, and starts a new round after the last', () => {
    let state = { round: 1, current: 'A', combatants: [c('A', 'pc', 20), c('B', 'creature', 15, { defeated: true }), c('C', 'pc', 10)] };
    state = advanceTurn(state);
    assert.deepEqual([state.round, state.current], [1, 'C']);
    state = advanceTurn(state);
    assert.deepEqual([state.round, state.current], [2, 'A']);
    state = advanceTurn(state, -1);
    assert.deepEqual([state.round, state.current], [1, 'C']);
  });

  it('keeps going after the current combatant is defeated, and stops when everyone is', () => {
    const state = { round: 3, current: 'B', combatants: [c('A', 'pc', 20), c('B', 'creature', 15, { defeated: true }), c('C', 'pc', 10)] };
    assert.equal(advanceTurn(state).current, 'C');
    const done = { ...state, combatants: state.combatants.map((x) => ({ ...x, defeated: true })) };
    assert.equal(advanceTurn(done).current, null);
  });

  it('never goes back below round 1', () => {
    const state = { round: 1, current: 'A', combatants: [c('A', 'pc', 20), c('B', 'creature', 15)] };
    assert.deepEqual([advanceTurn(state, -1).round, advanceTurn(state, -1).current], [1, 'B']);
  });

  it('lets the GM move someone in the order, and the turns follow it', () => {
    let state = { round: 1, current: 'A', combatants: [c('A', 'pc', 20), c('B', 'creature', 15), c('C', 'pc', 10)] };
    state = moveCombatant(state, 'C', 1);
    assert.deepEqual(state.combatants.map((x) => x.key), ['A', 'C', 'B']);
    assert.equal(advanceTurn(state).current, 'C');
    assert.deepEqual(moveCombatant(state, 'A', 99).combatants.map((x) => x.key), ['C', 'B', 'A']);
  });

  it('places an edited initiative without undoing the GM’s other moves', () => {
    // C was moved above B by hand; then A's initiative drops to 5.
    const state = { round: 1, current: 'A', combatants: [c('A', 'pc', 5), c('C', 'pc', 10), c('B', 'creature', 15)] };
    assert.deepEqual(placeByInitiative(state, 'A').combatants.map((x) => x.key), ['C', 'B', 'A']);
  });
});

describe('the GM changing a character in a fight', () => {
  const data = loadRulesData();
  // Valeros carries a wooden shield (Hardness 3, 12 HP, broken at 6).
  const valeros = buildCharacter(migrateBuild(PREGENS.find((p) => p.name === 'Valeros').build, data), data);
  const full = maxHp(valeros);
  const act = (state, action, n) => applyCombatAction({ character: valeros, ...state }, action, n, data);

  it('damages and heals within 0 and their maximum', () => {
    assert.equal(act({ hp: full, inventory: null }, 'damage', 5).hp, full - 5);
    assert.equal(act({ hp: 3, inventory: null }, 'damage', 99).hp, 0);
    assert.equal(act({ hp: full - 2, inventory: null }, 'heal', 99).hp, full);
  });

  it('Shield Blocks: Hardness stops part, the shield and they each take the rest', () => {
    const r = act({ hp: full, inventory: null }, 'block', 8);
    assert.deepEqual([r.stopped, r.through, r.hp, r.shield.current], [3, 5, full - 5, 7]);
    const broken = act({ hp: r.hp, inventory: r.inventory }, 'block', 8);
    assert.equal(broken.shield.current, 2);
    assert.ok(broken.shield.broken);
    assert.match(act({ hp: broken.hp, inventory: broken.inventory }, 'block', 4).error, /broken/);
  });

  it('repairs the shield, and says so when there is none', () => {
    const hit = act({ hp: full, inventory: null }, 'block', 8);
    assert.equal(act({ hp: hit.hp, inventory: hit.inventory }, 'repair', 3).shield.current, 10);
    const noShield = { ...hit.inventory, items: hit.inventory.items.filter((i) => i.kind !== 'shield') };
    assert.match(act({ hp: full, inventory: noShield }, 'block', 5).error, /no shield/);
  });
});

describe('conditions in a fight', () => {
  it('tapping adds at 1, raises up to 4, then clears; unvalued ones toggle', () => {
    let list = [];
    for (let i = 0; i < 4; i++) list = cycleCondition(list, 'frightened');
    assert.deepEqual(list, [{ id: 'frightened', value: 4 }]);
    assert.deepEqual(cycleCondition(list, 'frightened'), []);
    assert.deepEqual(cycleCondition([], 'off-guard'), [{ id: 'off-guard' }]);
    assert.deepEqual(cycleCondition([{ id: 'off-guard' }], 'off-guard'), []);
    assert.deepEqual(cycleCondition([], 'made-up'), []);
  });

  it("Next turn does the acting combatant's end-of-turn upkeep", () => {
    const state = { round: 1, current: 'A', combatants: [
      { key: 'A', kind: 'pc', name: 'A', initiative: 20, conditions: [{ id: 'frightened', value: 2 }, { id: 'off-guard' }] },
      { key: 'B', kind: 'creature', name: 'B', initiative: 10, conditions: [{ id: 'frightened', value: 1 }] },
    ] };
    const next = endTurn(state);
    assert.equal(next.current, 'B');
    assert.deepEqual(next.combatants[0].conditions, [{ id: 'frightened', value: 1 }, { id: 'off-guard' }]);
    assert.deepEqual(next.combatants[1].conditions, [{ id: 'frightened', value: 1 }], 'only the one whose turn ended');
  });
});

describe('every condition', () => {
  const data = loadRulesData();
  const v = buildCharacter(migrateBuild(PREGENS.find((p) => p.name === 'Valeros').build, data), data);
  const ac = (conditions) => armorClass(v, { conditions }).total;
  const save = (s, conditions) => savingThrow(v, s, { conditions }).total;
  const base = { ac: ac([]), fort: save('fortitude', []), ref: save('reflex', []), will: save('will', []), per: perception(v).total };

  it('lists the Player Core conditions, each with rules text', () => {
    assert.equal(Object.keys(CONDITIONS).length, 33);
    for (const [id, def] of Object.entries(CONDITIONS)) assert.ok(def.summary(2).length > 10, id);
  });

  it('drained hits Fortitude; stupefied hits Will and Perception', () => {
    assert.equal(save('fortitude', [{ id: 'drained', value: 2 }]), base.fort - 2);
    assert.equal(save('reflex', [{ id: 'drained', value: 2 }]), base.ref);
    assert.equal(save('will', [{ id: 'stupefied', value: 1 }]), base.will - 1);
    assert.equal(perception(v, { conditions: [{ id: 'stupefied', value: 1 }] }).total, base.per - 1);
  });

  it('fatigued is −1 to AC and saves only; unconscious is −4 to AC, Perception and Reflex, and off-guard', () => {
    assert.equal(ac([{ id: 'fatigued' }]), base.ac - 1);
    assert.equal(save('will', [{ id: 'fatigued' }]), base.will - 1);
    assert.equal(perception(v, { conditions: [{ id: 'fatigued' }] }).total, base.per);
    assert.equal(ac([{ id: 'unconscious' }]), base.ac - 6);
    assert.equal(save('reflex', [{ id: 'unconscious' }]), base.ref - 4);
    assert.equal(save('will', [{ id: 'unconscious' }]), base.will);
  });

  it('prone and grabbed make you off-guard; prone also costs 2 on attacks', () => {
    assert.equal(ac([{ id: 'prone' }]), base.ac - 2);
    assert.equal(ac([{ id: 'grabbed' }, { id: 'off-guard' }]), base.ac - 2, "off-guard doesn't stack with itself");
    const sword = v.weapons[0];
    assert.equal(strikeBonus(v, sword, { conditions: [{ id: 'prone' }] }).total, strikeBonus(v, sword).total - 2);
  });
});

