import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanDescription as clean } from '../scripts/clean-description.js';
import { loadRulesData } from '../src/load.js';

describe('cleaning rules text', () => {
  it('keeps the shape of an area', () => {
    assert.equal(clean('in a @Template[emanation|distance:30]. Next'), 'in a 30-foot emanation. Next');
    assert.equal(clean('a @Template[type:burst|distance:5]'), 'a 5-foot burst');
    assert.equal(clean('@Template[cone|distance:15]{15-foot cone of fire}'), '15-foot cone of fire');
  });

  it('reads damage with nested brackets', () => {
    assert.equal(clean('@Damage[3d6[fire]|options:area-damage] damage'), '3d6 fire damage');
    assert.equal(clean('@Damage[14[void]] damage'), '14 void damage');
    assert.equal(clean('deals @Damage[(1[splash])[cold]] splash damage'), 'deals 1 cold splash damage');
    assert.equal(clean('@Damage[2d6[poison],1d6[persistent,poison]] damage'), '2d6 poison and 1d6 persistent poison damage');
    assert.equal(clean('@Damage[5d8[piercing],5d8[slashing]]{5d8 piercing damage and 5d8 slashing damage}, with'), '5d8 piercing damage and 5d8 slashing damage, with');
  });

  it("works out formulas at the spell's rank", () => {
    assert.equal(clean('@Damage[floor(@item.level/2)d6[persistent,acid]] damage', { level: 2, rank: 2 }), '1d6 persistent acid damage');
    assert.equal(clean('@Damage[(1+(ceil((@item.level - 4) / 2)))d6[piercing]]', { level: 5, rank: 5 }), '2d6 piercing');
    assert.equal(clean('@Damage[(ternary(gte(@item.rank,8),14,10))d6[fire]|options:area-damage]', { level: 6, rank: 6 }), '10d6 fire');
    assert.equal(clean('@Damage[(max(4,(@item.rank)-1))d6[void]]', { level: 5, rank: 5 }), '4d6 void');
    assert.equal(clean('@Damage[(1d6+max(0,floor(@item.rank/2) -3))[electricity]]', { level: 6, rank: 6 }), '1d6 electricity');
    assert.equal(clean('@Damage[(3d4 + (@item.level - 6))[vitality]]', { level: 8, rank: 8 }), '3d4+2 vitality');
    assert.equal(clean('@Damage[5*@item.level]', { level: 8, rank: 8 }), '40');
    assert.equal(clean('@Damage[(@item.rank)[piercing]]', { level: 1, rank: 1 }), '1 piercing');
  });

  it('puts formulas that scale with the character in words', () => {
    assert.equal(clean('@Damage[(2*(1+@actor.level))[healing]]'), '2 × (1 + your level) healing');
    assert.equal(clean('@Damage[(ceil(@actor.level/2))d8[vitality,healing]|shortLabel]'), '1d8 per 2 levels (rounded up) vitality healing');
  });

  it('names checks and saves', () => {
    assert.equal(clean('(@Check[reflex|dc:23|basic] save)'), '(DC 23 basic Reflex save)');
    assert.equal(clean('with a @Check[reflex|showDC:all|dc:29|basic], or'), 'with a DC 29 basic Reflex save, or');
    assert.equal(clean('an @Check[arcana|dc:20] check'), 'a DC 20 Arcana check');
    assert.equal(clean('a @Check[will]'), 'a Will save');
    assert.equal(clean('@Check[athletics|dc:15]{Athletics} check'), 'Athletics check');
  });

  it('reads inline rolls', () => {
    assert.equal(clean('You take [[/r (@actor.level)[fire] #Tamper Backfire]]{fire damage equal to your level}.'), 'You take fire damage equal to your level.');
    assert.equal(clean('[[/act escape dc=29]]{Escapes}'), 'Escapes');
    assert.equal(clean('[[/act long-jump]]'), 'Long Jump');
    assert.equal(clean('[[/r 1d4 #Recharge]] rounds'), '1d4 rounds');
    assert.equal(clean('[[/r {2d6}[fire]]] damage'), '2d6 fire damage');
  });
});

describe('the imported rules text', () => {
  const data = loadRulesData();
  const LEFTOVER = /\{\{|\}\}|\[\[|\]\]|@[A-Z]\w+\[|@(actor|item)\.|\d\[|\|options|\d-foot\s*[.;]|\d-foot\s*,(?!\s*(?:or\s+)?\d+-foot)|\d-foot {2}|check save/;

  for (const type of ['spells', 'feats', 'heritages', 'ancestries', 'backgrounds', 'classes', 'runes', 'items', 'deities']) {
    it(`has no markup left in ${type}`, () => {
      const bad = data[type].flatMap((x) => {
        const fields = [x.description, x.range, x.area, x.target, x.duration, ...(x.features ?? []).map((f) => f.description)];
        return fields.filter((f) => typeof f === 'string' && LEFTOVER.test(f)).map((f) => `${x.name}: ${f.match(new RegExp(`.{0,40}(?:${LEFTOVER.source}).{0,30}`))?.[0]}`);
      });
      assert.deepEqual(bad, []);
    });
  }
});
