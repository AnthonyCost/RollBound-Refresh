import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const expect = (actual) => ({
  toBe: (v) => assert.strictEqual(actual, v),
  toEqual: (v) => assert.deepStrictEqual(actual, v),
  toMatch: (re) => assert.match(actual, re),
  toThrow: () => assert.throws(actual),
});
import {
  proficiencyBonus,
  maxHp,
  armorClass,
  savingThrow,
  perception,
  strikeBonus,
  multipleAttackPenalty,
  degreeOfSuccess,
  degreeRanges,
  strikeDamage,
  statusPenalty,
  endOfTurn,
  rateEncounter,
  creatureXp,
  dcByLevel,
  mira,
} from '../src/index.js';

describe('proficiency', () => {
  it('adds rank bonus plus level, except untrained', () => {
    expect(proficiencyBonus('untrained', 5)).toBe(0);
    expect(proficiencyBonus('trained', 1)).toBe(3);
    expect(proficiencyBonus('expert', 1)).toBe(5);
    expect(proficiencyBonus('legendary', 20)).toBe(28);
  });
  it('rejects unknown ranks', () => {
    expect(() => proficiencyBonus('grandmaster', 1)).toThrow();
  });
});

describe('Mira, level 1 human fighter', () => {
  it('has 20 HP', () => expect(maxHp(mira)).toBe(20));

  it('has AC 18 with chain mail capping Dex at +1', () => {
    const ac = armorClass(mira);
    expect(ac.total).toBe(18);
    const dex = ac.parts.find((p) => p.label === 'Dexterity');
    expect(dex.value).toBe(1);
    expect(dex.note).toMatch(/caps it at \+1/);
  });

  it('gets +2 AC from a raised shield and −2 when off-guard', () => {
    expect(armorClass(mira, { shieldRaised: true }).total).toBe(20);
    expect(armorClass(mira, { conditions: [{ id: 'off-guard' }] }).total).toBe(16);
  });

  it('has Fort +7, Ref +7, Will +4, Perception +6', () => {
    expect(savingThrow(mira, 'fortitude').total).toBe(7);
    expect(savingThrow(mira, 'reflex').total).toBe(7);
    expect(savingThrow(mira, 'will').total).toBe(4);
    expect(perception(mira).total).toBe(6);
  });

  it('strikes at +9, then +4, then −1', () => {
    const sword = mira.weapons[0];
    expect(strikeBonus(mira, sword).total).toBe(9);
    expect(strikeBonus(mira, sword, { attacksSoFar: 1 }).total).toBe(4);
    expect(strikeBonus(mira, sword, { attacksSoFar: 2 }).total).toBe(-1);
  });

  it('applies frightened to strikes', () => {
    const sword = mira.weapons[0];
    const s = strikeBonus(mira, sword, { conditions: [{ id: 'frightened', value: 1 }] });
    expect(s.total).toBe(8);
  });
});

describe('multiple attack penalty', () => {
  it('is −5/−10, or −4/−8 for agile weapons', () => {
    expect(multipleAttackPenalty(0)).toBe(0);
    expect(multipleAttackPenalty(1)).toBe(-5);
    expect(multipleAttackPenalty(3)).toBe(-10);
    expect(multipleAttackPenalty(1, { agile: true })).toBe(-4);
    expect(multipleAttackPenalty(2, { agile: true })).toBe(-8);
  });
});

describe('degrees of success', () => {
  it('uses the ±10 rule', () => {
    expect(degreeOfSuccess(25, 15).name).toBe('critical success');
    expect(degreeOfSuccess(15, 15).name).toBe('success');
    expect(degreeOfSuccess(14, 15).name).toBe('failure');
    expect(degreeOfSuccess(6, 15).name).toBe('failure');
    expect(degreeOfSuccess(5, 15).name).toBe('critical failure');
  });
  it('shifts one step on a natural 20 or 1', () => {
    expect(degreeOfSuccess(14, 15, 20).name).toBe('success');
    expect(degreeOfSuccess(25, 15, 20).name).toBe('critical success');
    expect(degreeOfSuccess(16, 15, 1).name).toBe('failure');
    expect(degreeOfSuccess(3, 15, 1).name).toBe('critical failure');
  });
  it('reports the ranges for a DC', () => {
    expect(degreeRanges(15)).toEqual([
      { name: 'critical success', min: 25, max: null },
      { name: 'success', min: 15, max: 24 },
      { name: 'failure', min: 6, max: 14 },
      { name: 'critical failure', min: null, max: 5 },
    ]);
  });
  it('doubles damage on a crit', () => {
    expect(strikeDamage(6, 4, 'critical success')).toBe(20);
    expect(strikeDamage(6, 4, 'success')).toBe(10);
    expect(strikeDamage(6, 4, 'failure')).toBe(0);
  });
});

describe('conditions', () => {
  it('uses only the worst status penalty', () => {
    const c = [{ id: 'frightened', value: 1 }, { id: 'sickened', value: 2 }];
    expect(statusPenalty(c).value).toBe(-2);
    expect(statusPenalty(c).source).toBe('Sickened 2');
  });
  it('applies clumsy only to Dex-based checks', () => {
    const c = [{ id: 'clumsy', value: 2 }];
    expect(statusPenalty(c, 'dex').value).toBe(-2);
    expect(statusPenalty(c, 'str').value).toBe(0);
  });
  it('ticks frightened down and removes it at 0', () => {
    expect(endOfTurn([{ id: 'frightened', value: 2 }])).toEqual([{ id: 'frightened', value: 1 }]);
    expect(endOfTurn([{ id: 'frightened', value: 1 }, { id: 'off-guard' }])).toEqual([{ id: 'off-guard' }]);
  });
});

describe('GM tools', () => {
  it('prices creatures by level difference', () => {
    expect(creatureXp(1, 1)).toBe(40);
    expect(creatureXp(0, 1)).toBe(30);
    expect(creatureXp(-1, 1)).toBe(20);
    expect(creatureXp(3, 1)).toBe(80);
    expect(creatureXp(-3, 1)).toBe(10);
    expect(creatureXp(-4, 1)).toBe(0);
  });
  it('rates two party-level wolves as moderate for four PCs', () => {
    const r = rateEncounter([{ level: 1, count: 2 }], 1, 4);
    expect(r.xp).toBe(80);
    expect(r.threat).toBe('moderate');
  });
  it('adjusts budgets for party size', () => {
    const r = rateEncounter([{ level: 1, count: 2 }], 1, 5);
    expect(r.budgets.find((b) => b.name === 'moderate').budget).toBe(100);
    // GM Core adds 20 per extra character to Low too (60 + 20), so 80 XP is still low.
    expect(r.budgets.find((b) => b.name === 'low').budget).toBe(80);
    expect(r.threat).toBe('low');
  });
  it('knows DCs by level', () => {
    expect(dcByLevel(0)).toBe(14);
    expect(dcByLevel(1)).toBe(15);
    expect(dcByLevel(20)).toBe(40);
  });
});
