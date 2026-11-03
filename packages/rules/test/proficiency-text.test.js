import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { proficiencyIncreases, sectionFor } from '../scripts/proficiency-text.js';

const CLASSES = ['Barbarian', 'Champion', 'Druid', 'Exemplar', 'Fighter', 'Investigator', 'Kineticist', 'Magus', 'Oracle', 'Psychic', 'Sorcerer', 'Thaumaturge', 'Wizard'];
const read = (html, cls = 'Fighter') => proficiencyIncreases(html, cls, CLASSES);

describe('reading proficiency increases from feature text', () => {
  it('reads a single save', () => {
    const r = read('<p>Your proficiency rank for Will saves increases to expert. When you roll a success…</p>');
    assert.deepEqual(r.increases, [{ target: 'will', rank: 'expert' }]);
    assert.deepEqual(r.flags, []);
  });

  it('reads Perception and class DC', () => {
    assert.deepEqual(read('<p>Your proficiency rank for Perception increases to expert.</p>').increases, [{ target: 'perception', rank: 'expert' }]);
    assert.deepEqual(read('<p>Your proficiency rank for your fighter class DC increases to expert.</p>').increases, [{ target: 'classDc', rank: 'expert' }]);
  });

  it('reads lists of weapons and armor', () => {
    const w = read('<p>Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increase to expert.</p>').increases.map((i) => i.target).sort();
    assert.deepEqual(w, ['martial', 'simple', 'unarmed']);
    const a = read('<p>Your proficiency ranks for light, medium, and heavy armor, as well as for unarmored defense, increase to expert.</p>').increases.map((i) => i.target).sort();
    assert.deepEqual(a, ['heavy', 'light', 'medium', 'unarmored']);
  });

  it('reads spellcasting and a combined class DC and spell sentence', () => {
    assert.deepEqual(read('<p>Your proficiency ranks for spell attack modifier and spell DC increase to master.</p>').increases, [{ target: 'spellcasting', rank: 'master' }]);
    const both = read('<p>Your proficiency ranks for your champion class DC and divine spell attack rolls and DCs increase to expert.</p>', 'Champion').increases.map((i) => i.target).sort();
    assert.deepEqual(both, ['classDc', 'spellcasting']);
  });

  it('takes only the paragraph for the class in shared features', () => {
    const html =
      '<p><strong>Champion, Exemplar, Investigator, Magus</strong> Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increase to expert.</p>' +
      '<p><strong>Druid, Kineticist</strong> Your proficiency rank for simple weapons and unarmed attacks increases to expert.</p>';
    assert.deepEqual(read(html, 'Druid').increases.map((i) => i.target).sort(), ['simple', 'unarmed']);
    assert.deepEqual(read(html, 'Magus').increases.map((i) => i.target).sort(), ['martial', 'simple', 'unarmed']);
    assert.equal(sectionFor(html, 'Wizard', CLASSES), '');
  });

  it('flags increases limited to a weapon group instead of guessing', () => {
    const r = read('<p>Choose one weapon group. Your proficiency rank increases to master with the simple weapons, martial weapons, and unarmed attacks in that group, and to expert with the advanced weapons in that group.</p>');
    assert.deepEqual(r.increases, []);
    assert.equal(r.flags.length, 1);
  });

  it('reads two increases in one sentence, one per clause', () => {
    const r = read('<p>Your proficiency ranks for simple weapons, martial weapons, and unarmed attacks increase to legendary, and your proficiency rank for advanced weapons increases to master.</p>');
    assert.deepEqual(r.flags, []);
    assert.deepEqual(Object.fromEntries(r.increases.map((i) => [i.target, i.rank])), { simple: 'legendary', martial: 'legendary', unarmed: 'legendary', advanced: 'master' });
    const monk = read('<p>Your proficiency rank for unarmored defense increases to legendary, and your proficiency rank for your monk class DC increases to master.</p>');
    assert.deepEqual(Object.fromEntries(monk.increases.map((i) => [i.target, i.rank])), { unarmored: 'legendary', classDc: 'master' });
  });

  it('reads a class DC named for the class', () => {
    assert.deepEqual(read('<p>Your proficiency rank for your ranger DC increases to expert.</p>').increases, [{ target: 'classDc', rank: 'expert' }]);
  });

  it('does not mistake a spell DC for a class DC', () => {
    assert.deepEqual(read('<p>Your proficiency ranks for spell attack modifier and spell DC increase to master.</p>').increases, [{ target: 'spellcasting', rank: 'master' }]);
  });
});
