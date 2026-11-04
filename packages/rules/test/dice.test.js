import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDice, rollDice } from '../src/index.js';

describe('dice expressions', () => {
  it('reads counts, sizes and modifiers', () => {
    assert.deepEqual(parseDice('2d6+3'), { count: 2, sides: 6, mod: 3 });
    assert.deepEqual(parseDice('1d8 + 4'), { count: 1, sides: 8, mod: 4 });
    assert.deepEqual(parseDice('1d4−1'), { count: 1, sides: 4, mod: -1 });
    assert.deepEqual(parseDice('d12'), { count: 1, sides: 12, mod: 0 });
    assert.deepEqual(parseDice('1d100'), { count: 1, sides: 100, mod: 0 });
    for (const bad of ['', '2d7', '0d6', 'd', '2d6+', 'fire']) assert.equal(parseDice(bad), null, bad);
  });

  it('rolls each die and adds the modifier, never below 1', () => {
    const faces = [3, 5];
    const rng = () => (faces.shift() - 1) / 6;
    const r = rollDice('2d6+4', rng);
    assert.deepEqual(r.dice.map((d) => d.value), [3, 5]);
    assert.equal(r.total, 12);
    assert.equal(rollDice('1d4-5', () => 0).total, 1, 'a 1 minus 5 still deals 1');
    for (let i = 0; i < 200; i++) {
      const x = rollDice('3d8');
      assert.ok(x.dice.every((d) => d.value >= 1 && d.value <= 8) && x.total >= 3 && x.total <= 24);
    }
  });
});
