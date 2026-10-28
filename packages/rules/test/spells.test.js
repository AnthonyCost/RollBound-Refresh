import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const data = loadRulesData();
const hero = (name) => R.buildCharacter(R.migrateBuild(R.PREGENS.find((p) => p.name === name).build, data), data);
const names = (list) => list.map((s) => s?.name ?? null);

describe('prepared spells', () => {
  it('applies only to casters who prepare from the spells they know', () => {
    assert.ok(R.preparesFromKnown(hero('Ezren')));
    assert.ok(R.preparesFromKnown(hero('Feiya')));
    assert.ok(!R.preparesFromKnown(hero('Seoni')));
    assert.ok(!R.preparesFromKnown(hero('Kyra')));
    assert.ok(!R.preparesFromKnown(hero('Valeros')));
    assert.equal(R.preparedSpells(hero('Seoni'), null), null);
  });

  it("starts with what the hero's sheet prepares", () => {
    const p = R.preparedSpells(hero('Seltyiel'), null);
    assert.deepEqual(names(p.cantrips), ['Detect Magic', 'Electric Arc', 'Gouging Claw', 'Shield', 'Tangle Vine']);
    assert.deepEqual(names(p.slots), ['Thunderstrike']);
    assert.ok(names(p.unprepared.spells).includes('Sure Strike'));
    // Usharak's granted harm is known, so it can be prepared, and it's what his sheet prepares.
    assert.deepEqual(names(R.preparedSpells(hero('Usharak'), null).slots), ['Harm']);
  });

  it('fills slots with any known rank 1 spell, more than once, and leaves empty slots empty', () => {
    const ezren = hero('Ezren');
    const force = ezren.spellcasting.spells.find((s) => s.name === 'Force Barrage');
    const p = R.preparedSpells(ezren, { cantrips: [], slots: [R.spellKey(force), R.spellKey(force)] });
    assert.deepEqual(names(p.slots), ['Force Barrage', 'Force Barrage']);
    assert.deepEqual(R.preparedValue(p), { cantrips: [], slots: [force.id, force.id] });
    assert.deepEqual(names(R.preparedSpells(ezren, { cantrips: [], slots: [null, null] }).slots), [null, null]);
  });

  it("drops spells the character doesn't know any more, and caps cantrips", () => {
    const ezren = hero('Ezren');
    const keys = ezren.spellcasting.cantrips.map(R.spellKey);
    const p = R.preparedSpells(ezren, { cantrips: ['gone', ...keys], slots: ['gone', null] });
    assert.equal(p.cantrips.length, ezren.spellcasting.prepares.cantrips);
    assert.deepEqual(names(p.slots), [null, null]);
  });

  it('checks a prepared list before it is saved', () => {
    const ezren = hero('Ezren');
    const [a, b] = ezren.spellcasting.cantrips.map(R.spellKey);
    const spell = R.spellKey(ezren.spellcasting.spells[0]);
    assert.deepEqual(R.preparedProblems(ezren, { cantrips: [a, b], slots: [spell, null] }), []);
    assert.ok(R.preparedProblems(ezren, { cantrips: [a, a], slots: [spell, null] }).length);
    assert.ok(R.preparedProblems(ezren, { cantrips: ezren.spellcasting.cantrips.map(R.spellKey), slots: [spell, null] }).length);
    assert.ok(R.preparedProblems(ezren, { cantrips: [], slots: [spell] }).length);
    assert.ok(R.preparedProblems(ezren, { cantrips: [], slots: ['nope', null] }).length);
    assert.ok(R.preparedProblems(ezren, { slots: [] }).length);
    assert.ok(R.preparedProblems(hero('Seoni'), { cantrips: [], slots: [] }).length);
  });
});
