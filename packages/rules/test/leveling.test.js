import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const data = loadRulesData();
const pregen = (name) => R.migrateBuild(R.PREGENS.find((p) => p.name === name).build, data);
const slugOf = (id, list) => list.find((x) => x.id === id)?.slug;

/**
 * Levels a build up to `target`, making a valid pick wherever a level asks for one (the
 * first feat whose prerequisites are met, the first spells, the given boosts), so a
 * test can check the result against the rules.
 */
function levelTo(start, target, { boosts = ['str', 'dex', 'con', 'wis'], increase = [], choose = {} } = {}) {
  let build = start;
  while (R.levelOf(build) < target) {
    build = R.levelUp(build);
    const level = R.levelOf(build);
    const plan = R.levelPlan(build, data, level);
    const entry = {};
    const owned = new Set(R.featSummary(build, data).owned.map((o) => o.feat.id));
    for (const field of ['classFeat', 'ancestryFeat', 'skillFeat', 'generalFeat']) {
      if (!plan[field]) continue;
      const at = { ...build, levels: build.levels.map((e, i) => (i === level - 2 ? entry : e)) };
      const feat = R.levelFeatOptions(build, data, level, field).find((f) => !owned.has(f.id) && R.featPrerequisites(f, at, data).met && !/more than once/i.test(f.description));
      entry[field] = feat?.id ?? null;
      if (feat) owned.add(feat.id);
    }
    if (plan.skillIncrease) {
      const ranks = R.skillRanksOf(build, data).ranks;
      const room = (s) => R.RANKS.indexOf(ranks[s] ?? 'untrained') < R.RANKS.indexOf(R.maxSkillRank(level));
      const wanted = increase.find(room) ?? data.skills.find((s) => !ranks[s]) ?? data.skills.find(room);
      entry.skillIncrease = wanted;
    }
    if (plan.boosts) entry.boosts = boosts;
    if (plan.choices.length) entry.choices = Object.fromEntries(plan.choices.map(({ feature, choice }) => [feature.slug, choose[choice.kind] ?? choice.options[0]]));
    if (plan.spells) entry.spells = R.levelSpellOptions(build, data, level).slice(0, plan.spells).map((s) => s.id);
    build = { ...build, levels: build.levels.map((e, i) => (i === level - 2 ? entry : e)) };
    // Feats like Ancestral Paragon grant another feat to pick.
    for (const slot of R.featSummary(build, data).slots) {
      if (slot.chosen) continue;
      const taken = new Set(R.featSummary(build, data).owned.map((o) => o.feat.id));
      const pick = slot.options.find((f) => !taken.has(f.id) && R.featPrerequisites(f, build, data).met);
      if (pick) build = { ...build, bonusFeats: { ...build.bonusFeats, [slot.parent.id]: pick.id } };
    }
  }
  return build;
}

describe('leveling up', () => {
  it('reads each class’s schedule from the data', () => {
    const fighter = data.classes.find((c) => c.slug === 'fighter');
    const at = (level) => R.levelGrants(fighter, level);
    assert.equal(at(2).classFeat, true);
    assert.equal(at(3).generalFeat, true);
    assert.equal(at(3).skillIncrease, true);
    assert.equal(at(5).ancestryFeat, true);
    assert.equal(at(5).boosts, true);
    assert.equal(at(4).boosts, false);
    assert.deepEqual(at(3).features.map((f) => f.name), ['Bravery']);
  });

  it('levels Valeros to 9 with a clean build, and the numbers follow the rules', () => {
    const build = levelTo(pregen('Valeros'), 9, { boosts: ['str', 'dex', 'con', 'wis'], increase: ['athletics'], choose: { weaponGroup: 'sword' } });
    assert.deepEqual(R.buildProblems(build, data), []);
    const c = R.buildCharacter(build, data);
    assert.equal(c.level, 9);
    // Bravery (3): Will expert. Battlefield Surveyor (7): Perception master. Battle Hardened (9): Fortitude master.
    assert.equal(c.proficiencies.will, 'expert');
    assert.equal(c.proficiencies.perception, 'master');
    assert.equal(c.proficiencies.fortitude, 'master');
    // Fighter Weapon Mastery (5) with swords: master with simple and martial swords.
    const longsword = R.toWeapon(data.weapons.find((w) => w.slug === 'longsword'));
    assert.equal(R.weaponRank(c, longsword), 'master');
    const club = R.toWeapon(data.weapons.find((w) => w.slug === 'club'));
    assert.equal(R.weaponRank(c, club), 'expert');
    // Hit Points: ancestry + (class + Con) per level.
    assert.equal(R.maxHp(c), c.ancestry.hp + (c.classHp + c.abilities.con) * 9);
    // Five class feats by 9 (1, 2, 4, 6, 8), three skill increases (3, 5, 7, 9 = four).
    assert.equal(c.feats.filter((f) => /class feat/i.test(f.from)).length, 5);
    assert.equal(c.skills.athletics, 'master');
  });

  it('applies attribute boosts at 5, with partial boosts above +4', () => {
    const start = pregen('Valeros');
    const base = R.attributes(start, data).mods;
    assert.equal(base.str, 4);
    const at5 = R.attributes(levelTo(start, 5, { boosts: ['str', 'dex', 'con', 'wis'] }), data);
    assert.equal(at5.mods.str, 4, 'a boost at +4 is only a partial boost');
    assert.ok(at5.partial.has('str'));
    assert.equal(at5.mods.dex, base.dex + 1);
    const at10 = R.attributes(levelTo(start, 10, { boosts: ['str', 'dex', 'con', 'wis'] }), data);
    assert.equal(at10.mods.str, 5, 'two partial boosts make +1');
    assert.ok(!at10.partial.has('str'));
  });

  it('limits skill increases: master from 7th, legendary from 15th', () => {
    assert.equal(R.maxSkillRank(3), 'expert');
    assert.equal(R.maxSkillRank(7), 'master');
    assert.equal(R.maxSkillRank(15), 'legendary');
    let build = levelTo(pregen('Valeros'), 5, { increase: ['athletics'] });
    // Two increases to Athletics by 5 would reach master too early.
    build = { ...build, levels: build.levels.map((e) => (e.skillIncrease ? { ...e, skillIncrease: 'athletics' } : e)) };
    const problems = R.buildProblems(build, data).map((p) => p.message);
    assert.ok(problems.some((m) => /athletics can't go above expert/i.test(m)), problems.join(' | '));
  });

  it('asks for each level’s choices before the build is complete', () => {
    const build = R.levelUp(pregen('Valeros'));
    const messages = R.buildProblems(build, data).map((p) => p.message);
    assert.ok(messages.includes('Level 2: choose a class feat.'), messages.join(' | '));
    assert.ok(messages.includes('Level 2: choose a skill feat.'), messages.join(' | '));
  });

  it('rejects a feat above the level it was taken at', () => {
    let build = levelTo(pregen('Valeros'), 2);
    const tooHigh = data.feats.find((f) => f.category === 'class' && f.traits.includes('fighter') && f.level === 8);
    build = { ...build, levels: [{ ...build.levels[0], classFeat: tooHigh.id }] };
    assert.ok(R.buildProblems(build, data).some((p) => /isn't one you can take at level 2/.test(p.message)));
  });

  it('goes back down a level by dropping that level’s choices', () => {
    const at4 = levelTo(pregen('Valeros'), 4);
    const at3 = R.levelDown(at4);
    assert.equal(R.levelOf(at3), 3);
    assert.equal(at3.levels.length, 2);
    assert.deepEqual(R.buildProblems(at3, data), []);
    assert.equal(R.buildCharacter(at3, data).proficiencies.will, 'expert');
  });

  it('keeps level-1 builds exactly as they were', () => {
    for (const p of R.PREGENS) {
      const build = R.migrateBuild(p.build, data);
      assert.equal(R.levelOf(build), 1);
      assert.equal(R.buildCharacter(build, data).level, 1);
    }
  });
});

describe('spellcasting while leveling', () => {
  it('gives standard casters 2 slots in a new rank, then 3', () => {
    const wizard = data.classes.find((c) => c.slug === 'wizard');
    assert.deepEqual(R.spellSlots(wizard.casting, 'wizard', 1), { 1: 2 });
    assert.deepEqual(R.spellSlots(wizard.casting, 'wizard', 2), { 1: 3 });
    assert.deepEqual(R.spellSlots(wizard.casting, 'wizard', 3), { 1: 3, 2: 2 });
    assert.equal(R.spellSlots(wizard.casting, 'wizard', 17)[9], 2);
    assert.equal(R.maxSpellRank(17), 9);
  });

  it('gives sorcerers one more slot per rank, and wave casters only their two highest ranks', () => {
    const sorcerer = data.classes.find((c) => c.slug === 'sorcerer');
    assert.deepEqual(R.spellSlots(sorcerer.casting, 'sorcerer', 1), { 1: 3 });
    assert.deepEqual(R.spellSlots(sorcerer.casting, 'sorcerer', 4), { 1: 4, 2: 4 });
    const magus = data.classes.find((c) => c.slug === 'magus');
    assert.deepEqual(R.spellSlots(magus.casting, 'magus', 1), { 1: 1 });
    assert.deepEqual(R.spellSlots(magus.casting, 'magus', 6), { 2: 2, 3: 2 });
  });

  it('levels Ezren (wizard) to 5: two new spells a level, up to 3rd rank, and expert spellcasting at 7', () => {
    const at5 = levelTo(pregen('Ezren'), 5, { boosts: ['int', 'dex', 'con', 'wis'] });
    assert.deepEqual(R.buildProblems(at5, data), []);
    const c = R.buildCharacter(at5, data);
    assert.equal(c.spellcasting.maxRank, 3);
    assert.deepEqual(c.spellcasting.slotsByRank, { 1: 3, 2: 3, 3: 2 });
    assert.equal(at5.levels.reduce((n, e) => n + (e.spells?.length ?? 0), 0), 8);
    assert.ok(c.spellcasting.spells.some((s) => s.rank === 3));
    assert.equal(c.proficiencies.spellcasting, 'trained');
    const at7 = R.buildCharacter(levelTo(pregen('Ezren'), 7, { boosts: ['int', 'dex', 'con', 'wis'] }), data);
    assert.equal(at7.proficiencies.spellcasting, 'expert');
  });

  it('grows a sorcerer’s repertoire with their slots', () => {
    const sorcerer = data.classes.find((c) => c.slug === 'sorcerer');
    assert.equal(R.spellsLearnedAt(sorcerer.casting, 'sorcerer', 2), 1);
    assert.equal(R.spellsLearnedAt(sorcerer.casting, 'sorcerer', 3), 3);
    const at3 = levelTo(pregen('Seoni'), 3, { boosts: ['cha', 'dex', 'con', 'wis'] });
    assert.deepEqual(R.buildProblems(at3, data), []);
    assert.ok(slugOf(at3.levels[1].spells[0], data.spells));
  });
});

describe('every class to level 20', () => {
  for (const p of R.PREGENS) {
    it(`${p.name} (${p.className}) levels to 20 with a clean build`, () => {
      const key = R.keyAbilityOf(R.migrateBuild(p.build, data), data);
      const others = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((a) => a !== key).slice(0, 3);
      const build = levelTo(R.migrateBuild(p.build, data), 20, { boosts: [key, ...others] });
      const problems = R.buildProblems(build, data);
      assert.deepEqual(problems, [], `${p.name}: ${problems.map((x) => x.message).join(' | ')}`);
      const c = R.buildCharacter(build, data);
      assert.equal(c.level, 20);
      assert.ok(R.maxHp(c) > 100);
      if (c.spellcasting && c.spellcasting.kind !== 'focus') assert.equal(c.spellcasting.maxRank, 9);
    });
  }
});
