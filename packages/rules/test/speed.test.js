import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { landSpeed, swimSpeed, HERITAGE_SWIM_SPEEDS } from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const halfPlate = { name: 'Half Plate', strength: 3, speedPenalty: -10 };
const breastplate = { name: 'Breastplate', strength: 3, speedPenalty: -5 };
const dwarf = (str, armor, feats = []) => ({ ancestry: { name: 'Dwarf', speed: 20 }, abilities: { str }, armor, feats });

describe('speed', () => {
  it('is the ancestry speed without armor', () => {
    assert.equal(landSpeed(dwarf(0, null)).total, 20);
  });

  it('takes the full armor penalty below its Strength', () => {
    assert.equal(landSpeed(dwarf(2, halfPlate)).total, 10);
    assert.equal(landSpeed(dwarf(2, breastplate)).total, 15);
  });

  it('reduces the penalty by 5 feet at its Strength', () => {
    assert.equal(landSpeed(dwarf(3, halfPlate)).total, 15);
    assert.equal(landSpeed(dwarf(3, breastplate)).total, 20);
  });

  it('ignores the penalty with Unburdened Iron', () => {
    assert.equal(landSpeed(dwarf(0, halfPlate, [{ slug: 'unburdened-iron' }])).total, 20);
  });

  it('applies armor to a swim Speed', () => {
    const c = { ...dwarf(2, breastplate), heritage: 'Wetlander Lizardfolk' };
    assert.equal(swimSpeed(c), 10);
    assert.equal(swimSpeed({ ...c, armor: null }), 15);
    assert.equal(swimSpeed({ ...c, heritage: 'Rock Dwarf' }), null);
  });

  it('lists every heritage the rules data gives a swim Speed', () => {
    const swimmers = loadRulesData().heritages.filter((h) => /swim Speed/.test(h.description)).map((h) => h.name);
    assert.deepEqual(swimmers.sort(), Object.keys(HERITAGE_SWIM_SPEEDS).sort());
  });
});
