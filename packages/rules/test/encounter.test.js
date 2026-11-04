import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advanceTurn, currentCombatant, initiativeOrder, startEncounter } from '../src/index.js';

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
});
