import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  emptyBuild,
  attributes,
  skillPicks,
  languagePicks,
  ancestryFeatOptions,
  classFeatOptions,
  buildProblems,
  buildCharacter,
  gearCost,
  loreOptions,
  maxHp,
  armorClass,
  savingThrow,
  skillCheck,
  strikeBonus,
  damageModifier,
} from '../src/index.js';

const data = JSON.parse(readFileSync(new URL('../data/pf2e-level1.json', import.meta.url)));

// A human fighter with the guard background, matching the sample character Mira.
function fighterBuild() {
  return {
    ...emptyBuild(),
    name: 'Test Fighter',
    ancestry: 'human',
    heritage: 'skilled-human',
    heritageSkill: 'medicine',
    ancestryBoosts: ['str', 'con'],
    background: 'guard',
    backgroundBoosts: ['str', 'dex'],
    lore: 'Warfare Lore',
    class: 'fighter',
    keyAbility: 'str',
    classSkill: 'athletics',
    freeBoosts: ['str', 'dex', 'con', 'wis'],
    skills: ['acrobatics', 'survival', 'society'],
    ancestryFeat: ancestryFeatOptions({ ancestry: 'human', heritage: 'skilled-human' }, data)[0].slug,
    classFeat: 'vicious-swing',
    armor: 'chain-mail',
    weapons: ['longsword'],
  };
}

describe('attributes', () => {
  it('adds boosts per source and applies flaws', () => {
    const { mods } = attributes(fighterBuild(), data);
    assert.deepEqual(mods, { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 });
  });

  it('fills fixed ancestry boosts and subtracts the flaw', () => {
    const build = { ...emptyBuild(), ancestry: 'dwarf', ancestryBoosts: [null, null, 'str'] };
    assert.deepEqual(attributes(build, data).mods, { str: 1, dex: 0, con: 1, int: 0, wis: 1, cha: -1 });
  });

  it('alternate ancestry boosts give two free boosts and no flaw', () => {
    const build = { ...emptyBuild(), ancestry: 'dwarf', altAncestryBoosts: true, ancestryBoosts: ['dex', 'cha'] };
    assert.deepEqual(attributes(build, data).mods, { str: 0, dex: 1, con: 0, int: 0, wis: 0, cha: 1 });
  });

  it("flags boosting one attribute twice from the same source", () => {
    const build = { ...fighterBuild(), freeBoosts: ['str', 'str', 'con', 'wis'] };
    assert.ok(buildProblems(build, data).some((p) => p.step === 'attributes' && /twice/.test(p.message)));
  });
});

describe('skills', () => {
  it('counts class picks plus Intelligence', () => {
    const build = { ...fighterBuild(), freeBoosts: ['str', 'dex', 'con', 'int'] };
    const picks = skillPicks(build, data);
    assert.equal(picks.fromClass, 3);
    assert.equal(picks.fromInt, 1);
  });

  it('grants an extra pick when two sources train the same skill', () => {
    const build = { ...fighterBuild(), heritageSkill: 'intimidation' };
    assert.equal(skillPicks(build, data).overlaps, 1);
  });

  it('parses background Lore entries', () => {
    assert.deepEqual(loreOptions('<Legal or Warfare> Lore'), { options: ['Legal Lore', 'Warfare Lore'] });
    assert.deepEqual(loreOptions('<Terrain> Lore'), { placeholder: 'Terrain Lore' });
    assert.deepEqual(loreOptions('Scribing'), { fixed: 'Scribing Lore' });
  });

  it('humans learn one extra language plus Intelligence', () => {
    assert.equal(languagePicks(fighterBuild(), data).total, 1);
  });
});

describe('feats', () => {
  it('offers ancestry feats for the ancestry and its versatile heritage', () => {
    const elfOnly = ancestryFeatOptions({ ancestry: 'human', heritage: null }, data);
    const aiuvarin = ancestryFeatOptions({ ancestry: 'human', heritage: 'aiuvarin' }, data);
    assert.ok(elfOnly.every((f) => f.traits.includes('human')));
    assert.ok(aiuvarin.some((f) => f.traits.includes('elf')));
  });

  it('offers level 1 class feats only to classes that get one', () => {
    assert.ok(classFeatOptions({ class: 'fighter' }, data).some((f) => f.name === 'Vicious Swing'));
    assert.equal(classFeatOptions({ class: 'wizard' }, data).length, 0);
  });
});

describe('a finished build', () => {
  it('has no problems', () => {
    assert.deepEqual(buildProblems(fighterBuild(), data), []);
  });

  it('produces a character the rules engine can play', () => {
    const c = buildCharacter(fighterBuild(), data);
    assert.equal(maxHp(c), 8 + 10 + 2);
    assert.equal(armorClass(c).total, 10 + 1 + 3 + 4); // Dex capped at +1 by chain mail
    assert.equal(savingThrow(c, 'fortitude').total, 2 + 5);
    assert.equal(strikeBonus(c, c.weapons[0]).total, 4 + 5);
    assert.equal(c.skills.medicine, 'trained');
    assert.equal(c.lores[0], 'Warfare Lore');
    assert.ok(c.feats.some((f) => f.name === 'Quick Coercion'));
  });

  it('flags gear over 15 gp', () => {
    const build = { ...fighterBuild(), armor: 'half-plate' };
    assert.ok(gearCost(build, data) > 1500);
    assert.ok(buildProblems(build, data).some((p) => p.step === 'gear'));
  });

  it('falls back to a fist when no weapon is chosen', () => {
    const c = buildCharacter({ ...fighterBuild(), weapons: [] }, data);
    assert.equal(c.weapons[0].name, 'Fist');
  });
});

describe('skill checks', () => {
  const c = buildCharacter(fighterBuild(), data);

  it('adds proficiency for trained skills', () => {
    assert.equal(skillCheck(c, 'athletics').total, 4 + 3);
    assert.equal(skillCheck(c, 'arcana').total, 0);
  });

  it('applies the armor check penalty unless you meet its Strength', () => {
    // Chain mail: Str +3 requirement, check penalty −2, flexible and noisy.
    assert.equal(skillCheck(c, 'thievery').total, 2); // Str +4 meets it
    assert.equal(skillCheck(c, 'stealth').total, 2 - 2); // noisy still applies
    const weak = { ...c, abilities: { ...c.abilities, str: 1 } };
    assert.equal(skillCheck(weak, 'thievery').total, 2 - 2);
    assert.equal(skillCheck(weak, 'acrobatics').total, 2 + 3); // flexible
  });

  it('treats Lore as Intelligence', () => {
    assert.equal(skillCheck(c, 'Warfare Lore').total, 0 + 3);
  });
});

describe('damage modifier', () => {
  const abilities = { str: 3 };
  it('adds Strength to melee and thrown, half to propulsive, none to other ranged', () => {
    assert.equal(damageModifier({ ranged: false }, abilities), 3);
    assert.equal(damageModifier({ ranged: true, traits: ['thrown-10'] }, abilities), 3);
    assert.equal(damageModifier({ ranged: true, traits: ['propulsive'] }, abilities), 1);
    assert.equal(damageModifier({ ranged: true, traits: [] }, abilities), 0);
  });
});
