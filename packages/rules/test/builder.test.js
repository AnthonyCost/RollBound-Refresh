import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const { emptyBuild, loreOptions, maxHp, armorClass, savingThrow, skillCheck, strikeBonus, damageModifier, spellDc, classDc, migrateBuild } = R;

const data = loadRulesData();

// Test builds name items by slug ("human", "fighter") so they stay readable. Each
// call converts them to IDs with migrateBuild, which also exercises the migration.
const named = (build) => migrateBuild({ ...build, v: 1 }, data);
const byName = (fn) => (build, ...rest) => fn(named(build), ...rest);
const attributes = byName(R.attributes);
const skillPicks = byName(R.skillPicks);
const languagePicks = byName(R.languagePicks);
const ancestryFeatOptions = byName(R.ancestryFeatOptions);
const classFeatOptions = byName(R.classFeatOptions);
const buildProblems = byName(R.buildProblems);
const buildCharacter = byName(R.buildCharacter);
const gearCost = byName(R.gearCost);
const featSummary = byName(R.featSummary);
const keyAbilityOptions = byName(R.keyAbilityOptions);
const spellcastingOf = byName(R.spellcastingOf);
const spellOptions = byName(R.spellOptions);
const checkPrerequisite = (text, build, d) => R.checkPrerequisite(text, named(build), d);

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
    ancestryFeat: 'cooperative-nature',
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

const firstOption = (cls, key) => data.classes.find((c) => c.slug === cls).features.find((f) => f.choice?.key === key).choice.options;
const optionSlug = (cls, key, name) => firstOption(cls, key).find((o) => o.name === name).slug;

describe('subclass effects', () => {
  it('applies racket skills and key attribute options', () => {
    const thief = { ...emptyBuild(), class: 'rogue', classChoices: { 'rogue-racket': optionSlug('rogue', 'rogue-racket', 'Thief') } };
    assert.ok(skillPicks(thief, data).fixed.has('thievery'));
    const ruffian = { ...thief, classChoices: { 'rogue-racket': optionSlug('rogue', 'rogue-racket', 'Ruffian') } };
    assert.deepEqual(keyAbilityOptions(ruffian, data).sort(), ['dex', 'str']);
  });

  it('gives a warpriest armor training, expert Fortitude, and Shield Block', () => {
    const build = { ...fighterBuild(), class: 'cleric', classChoices: { 'cleric-doctrine': optionSlug('cleric', 'cleric-doctrine', 'Warpriest') }, deity: 'sarenrae' };
    const c = buildCharacter(build, data);
    assert.equal(c.proficiencies.armor.medium, 'trained');
    assert.equal(c.proficiencies.fortitude, 'expert');
    assert.ok(c.feats.some((f) => f.name === 'Shield Block'));
  });

  it("grants Deadly Simplicity only when the deity's favored weapon is simple", () => {
    const warpriest = (deity) => ({ ...fighterBuild(), class: 'cleric', classChoices: { 'cleric-doctrine': 'warpriest' }, deity });
    const has = (b) => featSummary(b, data).owned.some(({ feat }) => feat.slug === 'deadly-simplicity');
    assert.equal(has(warpriest('torag')), false); // warhammer: martial
    assert.equal(has(warpriest('sarenrae')), false); // scimitar: martial
    const simple = data.deities.find((d) => d.weapons.some((w) => data.weapons.find((x) => x.slug === w)?.category === 'simple'));
    assert.equal(has(warpriest(simple.slug)), true);
  });
});

describe('deities', () => {
  const cleric = () => ({
    ...fighterBuild(),
    class: 'cleric',
    keyAbility: null,
    classFeat: null,
    classChoices: { 'cleric-doctrine': optionSlug('cleric', 'cleric-doctrine', 'Cloistered Cleric') },
    deity: 'sarenrae',
  });

  it("trains the deity's skill and favored weapon", () => {
    const build = cleric();
    assert.ok(skillPicks(build, data).fixed.has('medicine'));
    const c = buildCharacter({ ...build, weapons: ['scimitar'] }, data);
    assert.equal(c.proficiencies.weapons.martial, 'untrained');
    assert.equal(strikeBonus(c, c.weapons[0]).parts[1].label, 'Proficiency (Trained)');
  });

  it('asks for sanctification only when the deity allows a choice', () => {
    assert.ok(buildProblems(cleric(), data).some((p) => /holy/.test(p.message)));
    assert.ok(!buildProblems({ ...cleric(), sanctification: 'holy' }, data).some((p) => /holy/.test(p.message)));
  });

  it("rejects a champion cause the deity's sanctification forbids", () => {
    const build = {
      ...fighterBuild(),
      class: 'champion',
      classChoices: { 'champion-cause': optionSlug('champion', 'champion-cause', 'Desecration') },
      deity: 'sarenrae',
      sanctification: 'holy',
    };
    assert.ok(buildProblems(build, data).some((p) => /Desecration cause requires you to be unholy/.test(p.message)));
  });
});

describe('feats that grant feats', () => {
  it('Natural Ambition opens a 1st-level class feat slot', () => {
    const build = { ...fighterBuild(), ancestryFeat: 'natural-ambition' };
    const { slots } = featSummary(build, data);
    assert.equal(slots.length, 1);
    assert.ok(slots[0].options.every((f) => f.category === 'class' && f.traits.includes('fighter')));
    assert.ok(buildProblems(build, data).some((p) => /Natural Ambition/.test(p.message)));
    const done = { ...build, bonusFeats: { 'natural-ambition': 'sudden-charge' } };
    assert.ok(featSummary(done, data).owned.some(({ feat }) => feat.slug === 'sudden-charge'));
  });

  it('grants fixed feats, like a background skill feat', () => {
    assert.ok(featSummary(fighterBuild(), data).owned.some(({ feat, kind }) => feat.name === 'Quick Coercion' && kind === 'granted'));
  });
});

describe('prerequisites', () => {
  const b = fighterBuild();
  it('checks skills, attributes, subclasses, and feats', () => {
    assert.equal(checkPrerequisite('trained in Athletics', b, data), true);
    assert.equal(checkPrerequisite('trained in Arcana', b, data), false);
    assert.equal(checkPrerequisite('trained in Arcana, Nature, Occultism, or Religion', b, data), false);
    assert.equal(checkPrerequisite('trained in Warfare Lore', b, data), true);
    assert.equal(checkPrerequisite('Strength +2', b, data), true);
    assert.equal(checkPrerequisite('Intelligence +1', b, data), false);
    assert.equal(checkPrerequisite('Quick Coercion', b, data), true);
    assert.equal(checkPrerequisite('spellcasting class feature', b, data), false);
    assert.equal(checkPrerequisite('expert in Arcana, Nature, Occultism, or Religion', b, data), false);
    assert.equal(checkPrerequisite('precise strike', b, data), false);
  });

  it("returns null for things it can't check", () => {
    assert.equal(checkPrerequisite('at least 100 years old', b, data), null);
  });
});

describe('spellcasting', () => {
  const sorcerer = () => ({
    ...fighterBuild(),
    class: 'sorcerer',
    keyAbility: null,
    classFeat: null,
    freeBoosts: ['cha', 'dex', 'con', 'wis'],
    classChoices: { 'sorcerer-bloodline': optionSlug('sorcerer', 'sorcerer-bloodline', 'Imperial') },
  });

  it("takes the sorcerer's tradition and gift spells from the bloodline", () => {
    const casting = spellcastingOf(sorcerer(), data);
    assert.equal(casting.tradition, 'arcane');
    assert.deepEqual(casting.granted.map((s) => s.name).sort(), ['Detect Magic', 'Force Barrage']);
    assert.ok(spellOptions(sorcerer(), data).spells.every((s) => s.traditions.includes('arcane') && s.rank === 1));
  });

  it('requires the right number of spells and computes the spell DC', () => {
    const { cantrips, spells } = spellOptions(sorcerer(), data);
    const build = { ...sorcerer(), cantrips: cantrips.slice(0, 4).map((s) => s.slug), spells: spells.slice(0, 2).map((s) => s.slug) };
    assert.ok(!buildProblems(build, data).some((p) => p.step === 'spells'));
    const c = buildCharacter(build, data);
    assert.equal(c.spellcasting.cantrips.length, 5);
    assert.equal(spellDc(c).total, 10 + 2 + 3); // Cha: key boost + free boost
    assert.equal(classDc(c).total, 10 + 2 + 3);
  });
});

describe('stable IDs and migration', () => {
  const v1 = {
    name: 'Old Save',
    ancestry: 'human',
    heritage: 'skilled-human',
    background: 'guard',
    class: 'rogue',
    classChoices: { 'rogue-racket': 'thief' },
    ancestryFeat: 'natural-ambition',
    bonusFeats: { 'natural-ambition': 'nimble-dodge' },
    cantrips: ['daze'],
    armor: 'leather-armor',
    weapons: ['rapier', 'shortbow'],
  };
  const idOf = (list, slug) => list.find((x) => x.slug === slug).id;

  it('converts a version 1 build from slugs to Foundry IDs', () => {
    const m = migrateBuild({ ...v1, v: 1 }, data);
    assert.equal(m.v, R.BUILD_VERSION);
    assert.equal(m.ancestry, idOf(data.ancestries, 'human'));
    assert.equal(m.heritage, idOf(data.heritages, 'skilled-human'));
    assert.equal(m.class, idOf(data.classes, 'rogue'));
    assert.equal(m.classChoices['rogue-racket'], firstOption('rogue', 'rogue-racket').find((o) => o.slug === 'thief').id);
    assert.deepEqual(m.bonusFeats, { [idOf(data.feats, 'natural-ambition')]: idOf(data.feats, 'nimble-dodge') });
    assert.deepEqual(m.cantrips, [idOf(data.spells, 'daze')]);
    assert.deepEqual(m.weapons, [idOf(data.weapons, 'rapier'), idOf(data.weapons, 'shortbow')]);
  });

  it('leaves current builds alone, so it is safe to run on anything', () => {
    const m = migrateBuild({ ...v1, v: 1 }, data);
    assert.equal(migrateBuild(m, data), m);
    assert.deepEqual(migrateBuild({ ...m, v: 1 }, data), m);
  });

  it('gives every rules item a unique ID', () => {
    for (const list of ['ancestries', 'heritages', 'backgrounds', 'classes', 'feats', 'deities', 'spells', 'weapons', 'armor', 'shields']) {
      const ids = data[list].map((x) => x.id);
      assert.ok(ids.every(Boolean), `${list} all have ids`);
      assert.equal(new Set(ids).size, ids.length, `${list} ids are unique`);
    }
  });
});

describe('corrections', () => {
  const cls = (slug) => data.classes.find((c) => c.slug === slug);

  it('fills in spellcasting for every spellcasting class', () => {
    for (const c of data.classes.filter((x) => x.spellcasting)) assert.ok(c.casting, `${c.name} has casting`);
    assert.equal(cls('wizard').casting.cantrips, 10);
    assert.equal(cls('fighter').casting, null);
  });

  it('applies class, subclass, heritage, and feat corrections', () => {
    assert.equal(cls('cleric').divineFont, true);
    assert.equal(cls('cleric').deityFavoredWeapon, 'trained');
    assert.equal(firstOption('rogue', 'rogue-racket').find((o) => o.slug === 'mastermind').keyAbility, 'int');
    assert.deepEqual(data.heritages.find((h) => h.slug === 'dromaar').featAncestries, ['orc']);
    assert.equal(data.feats.find((f) => f.slug === 'deadly-simplicity').grantedOnlyIf, 'deity-favored-weapon-simple');
  });

  it('leaves nothing in the import report', () => {
    assert.deepEqual(data.meta.needsReview, []);
  });
});

describe('data updates', () => {
  const { reviewCharacter, missingChoices, dropMissingChoices } = R;
  const saved = () => JSON.parse(JSON.stringify(R.buildCharacter(named(fighterBuild()), data)));
  // A re-import: the same data under a new version, with optional edits.
  const reimport = (edit = (d) => d) => edit({ ...structuredClone(data), meta: { ...data.meta, version: 'next' } });
  const without = (list, slug) => (d) => ({ ...d, [list]: d[list].filter((x) => x.slug !== slug) });

  it('stamps sheets with the data version and the names of their choices', () => {
    const c = saved();
    assert.equal(c.dataVersion, data.meta.version);
    assert.equal(c.choiceNames[c.build.ancestryFeat], 'Cooperative Nature');
    assert.equal(c.choiceNames[c.build.weapons[0]], 'Longsword');
  });

  it('versions the data by its contents', () => {
    assert.match(data.meta.version, /^[0-9a-f]{12}$/);
  });

  it('leaves characters built from the current data alone', () => {
    assert.deepEqual(reviewCharacter(saved(), data), { status: 'current' });
    assert.deepEqual(reviewCharacter({ ...saved(), build: undefined, dataVersion: 'old' }, data), { status: 'current' });
  });

  it('only restamps a character when a re-import changes nothing it uses', () => {
    const c = saved();
    // Postgres hands JSON back with its keys reordered; that isn't a change.
    const shuffled = Object.fromEntries(Object.entries(c).reverse());
    const review = reviewCharacter(shuffled, reimport());
    assert.equal(review.status, 'restamp');
    assert.equal(review.character.dataVersion, 'next');
  });

  it('offers a refreshed sheet when the numbers change', () => {
    const tougher = reimport((d) => ({ ...d, ancestries: d.ancestries.map((a) => (a.slug === 'human' ? { ...a, hp: 10 } : a)) }));
    const review = reviewCharacter(saved(), tougher);
    assert.equal(review.status, 'refresh');
    assert.equal(R.maxHp(review.character), R.maxHp(saved()) + 2);
  });

  it('names choices a re-import removed and asks for them again', () => {
    const next = reimport((d) => without('weapons', 'longsword')(without('feats', 'cooperative-nature')(d)));
    const review = reviewCharacter(saved(), next);
    assert.equal(review.status, 'repick');
    assert.deepEqual(
      review.missing.map((m) => [m.step, m.kind, m.name]),
      [['feats', 'feat', 'Cooperative Nature'], ['gear', 'weapon', 'Longsword']],
    );

    const cleared = dropMissingChoices(saved().build, next);
    assert.equal(cleared.ancestryFeat, null);
    assert.deepEqual(cleared.weapons, []);
    assert.deepEqual(missingChoices(cleared, next), []);
    assert.ok(R.buildProblems(cleared, next).some((p) => p.message === 'Choose an ancestry feat.'));
  });

  it('flags a choice that still exists but no longer fits', () => {
    const moved = reimport((d) => ({ ...d, heritages: d.heritages.map((h) => (h.slug === 'skilled-human' ? { ...h, ancestry: 'elsewhere' } : h)) }));
    const review = reviewCharacter(saved(), moved);
    assert.equal(review.status, 'repick');
    assert.deepEqual(review.missing, []);
    assert.ok(review.problems.some((p) => p.step === 'ancestry'));
  });
});

describe('Impossible Magic', () => {
  const book = (build) => named({ ...emptyBuild(), ancestry: 'human', heritage: 'skilled-human', heritageSkill: 'medicine', background: 'guard', lore: 'Warfare Lore', ...build });
  const option = (cls, slug) => data.classes.find((c) => c.slug === cls).features.flatMap((f) => f.choice?.options ?? []).find((o) => o.slug === slug);

  it('adds the four classes from the hand-made book', () => {
    assert.ok(data.meta.books.includes('Impossible Magic'));
    for (const slug of ['magus', 'necromancer', 'runesmith', 'summoner']) {
      assert.equal(data.classes.find((c) => c.slug === slug)?.source, 'Impossible Magic', slug);
    }
    assert.equal(data.classes.find((c) => c.slug === 'wizard').features.find((f) => f.choice?.key === 'wizard-arcane-school').choice.options.filter((o) => o.source === 'Impossible Magic').length, 4);
  });

  it('has the magus cast with Intelligence while its key attribute is Strength or Dexterity', () => {
    const b = book({ class: 'magus', keyAbility: 'str', freeBoosts: ['str', 'dex', 'con', 'int'], classChoices: { 'magus-hybrid-study': option('magus', 'twisting-tree').id } });
    const casting = R.spellcastingOf(b, data);
    assert.equal(casting.ability, 'int');
    assert.equal(casting.cantrips, 8);
    assert.deepEqual(casting.prepares, { cantrips: 5, spells: 1 });
  });

  it('gives the necromancer harm in their dirge and Undead Lore', () => {
    const b = book({ class: 'necromancer' });
    assert.deepEqual(R.spellcastingOf(b, data).granted.map((s) => s.slug), ['harm']);
    assert.ok(!R.spellOptions(b, data).spells.some((s) => s.slug === 'harm'), 'harm is known, not one of the picks');
    assert.deepEqual(R.loresOf(b, data), ['Warfare Lore', 'Undead Lore']);
  });

  it('trains a reaper necromancer in martial weapons and medium armor', () => {
    const p = R.proficienciesOf(book({ class: 'necromancer', classChoices: { 'necromancer-fatal-method': option('necromancer', 'reaper').id } }), data);
    assert.equal(p.weapons.martial, 'trained');
    assert.equal(p.armor.medium, 'trained');
  });

  it('limits the summoner’s 1st-level feat to evolution feats', () => {
    const feats = classFeatOptions(book({ class: 'summoner' }), data);
    assert.ok(feats.length >= 4);
    assert.ok(feats.every((f) => f.traits.includes('evolution')));
  });

  it('trains a dragon summoner in Intimidation and the skill of the chosen tradition', () => {
    const b = book({ class: 'summoner', classChoices: { 'summoner-eidolon': option('summoner', 'dragon').id }, tradition: 'occult' });
    const skills = R.grantedSkills(b, data).filter((g) => g.from === 'Dragon').map((g) => g.skill);
    assert.deepEqual(skills.sort(), ['intimidation', 'occultism']);
  });

  it('has the runesmith choose four 1st-level runes', () => {
    const b = book({ class: 'runesmith' });
    assert.equal(R.runesOf(b, data).known, 4);
    assert.equal(R.runeOptions(b, data).length, 16);
    assert.ok(R.buildProblems(b, data).some((p) => p.message.startsWith('Choose 4 runes')));
    const picked = { ...b, runes: R.runeOptions(b, data).slice(0, 4).map((r) => r.id) };
    assert.ok(!R.buildProblems(picked, data).some((p) => /runes/.test(p.message)));
  });

  it('reads the book’s new prerequisite wording', () => {
    const deity = data.deities.find((d) => R.sanctificationOptions(d).includes('unholy'));
    const cleric = book({ class: 'cleric', deity: deity.slug, sanctification: 'unholy' });
    assert.equal(R.checkPrerequisite('You aren’t unholy', cleric, data), false);
    assert.equal(R.checkPrerequisite('You aren’t holy', cleric, data), true);
    const occult = book({ class: 'runesmith', classSkill: 'occultism' });
    assert.equal(R.checkPrerequisite('Trained in Arcana, Trained in Nature, Trained in Occultism, or Trained in Religion', occult, data), true);
  });
});
