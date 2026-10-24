// The build sweep: builds a level 1 character with every ancestry, heritage,
// background, subclass option and deity, for every class, and checks each one is
// valid and produces a complete sheet. It guards re-imports and new books: if new
// data breaks a combination, this names it.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/index.js';
import { loadRulesData } from '../src/load.js';

const data = loadRulesData();

// Heritages offered for an ancestry, matching the builder's Ancestry step.
const heritagesFor = (ancestry) => data.heritages.filter((h) => h.ancestry === ancestry.id || !h.ancestry);
const firstMet = (feats, build) => feats.find((f) => R.featPrerequisites(f, build, data).met)?.id ?? null;
// Fills boost slots in order, taking a fresh attribute where there's a choice.
const fillBoosts = (slots) => slots.reduce((out, s) => [...out, s.length === 1 ? s[0] : s.find((a) => !out.includes(a))], []);
const holyOrUnholy = (build) =>
  R.chosenOptions(build, data).map((c) => c.option.tags.find((t) => t === 'holy' || t === 'unholy')).find(Boolean);
const deitiesFor = (build) => {
  const need = holyOrUnholy(build);
  return data.deities.filter((d) => !need || R.sanctificationOptions(d).includes(need));
};

/** Makes the choices a player would, picking the n-th option wherever there's a choice. */
function autoBuild({ cls, ancestry, heritage, background, n, deity }) {
  const b = { ...R.emptyBuild(), name: 'Sweep', ancestry: ancestry.id, heritage: heritage.id, background: background.id, class: cls.id };
  if (heritage.skillChoice) b.heritageSkill = heritage.skillChoice[n % heritage.skillChoice.length];
  const lore = background.lore[0] ? R.loreOptions(background.lore[0]) : null;
  b.lore = lore ? (lore.fixed ?? lore.options?.[0] ?? 'Forest Lore') : '';
  if (cls.skillChoice) b.classSkill = cls.skillChoice[n % cls.skillChoice.length];
  for (const f of cls.features) {
    if (!f.choice) continue;
    const o = f.choice.options[n % f.choice.options.length];
    b.classChoices[f.choice.key] = o.id;
    if (o.skillChoice) b.classChoiceSkills[f.choice.key] = o.skillChoice[0];
    if (o.traditionChoice) b.tradition = R.TRADITIONS[n % R.TRADITIONS.length];
  }
  if (cls.deity) {
    const options = deitiesFor(b);
    const d = deity ?? options[n % options.length];
    b.deity = d.id;
    b.font = d.font[n % d.font.length];
    b.sanctification = holyOrUnholy(b) ?? R.sanctificationOptions(d)[0];
  }
  const keys = R.keyAbilityOptions(b, data);
  b.keyAbility = keys[n % keys.length];
  b.ancestryBoosts = fillBoosts(R.ancestryBoostSlots(ancestry, false));
  b.backgroundBoosts = fillBoosts(background.boosts);
  b.freeBoosts = ['str', 'dex', 'con', 'int'];
  b.ancestryFeat = firstMet(R.ancestryFeatOptions(b, data), b);
  if (cls.classFeatAt1) b.classFeat = firstMet(R.classFeatOptions(b, data), b);
  for (const slot of R.featSummary(b, data).slots) {
    b.bonusFeats[slot.parent.id] = firstMet(slot.options.filter((f) => f.id !== slot.parent.id), b);
  }
  const picks = R.skillPicks(b, data);
  b.skills = data.skills.filter((s) => !picks.fixed.has(s)).slice(0, picks.total);
  const casting = R.spellcastingOf(b, data);
  if (casting && casting.kind !== 'focus') {
    const o = R.spellOptions(b, data);
    b.cantrips = o.cantrips.slice(0, casting.cantrips).map((s) => s.id);
    b.spells = o.spells.slice(0, casting.spells).map((s) => s.id);
  }
  const weapons = data.weapons.filter((w) => w.price <= 200);
  b.weapons = [weapons[n % weapons.length].id];
  const armor = data.armor.filter((a) => a.price <= 900);
  b.armor = armor[n % armor.length].id;
  return b;
}

const isWhole = (x) => Number.isInteger(x?.total ?? x);

/** Problems with one build: rule problems, or a sheet with missing or non-numeric stats. */
function check(build) {
  const problems = R.buildProblems(build, data).map((p) => p.message);
  if (problems.length) return problems;
  const c = JSON.parse(JSON.stringify(R.buildCharacter(build, data)));
  const stats = {
    hp: R.maxHp(c),
    ac: R.armorClass(c),
    perception: R.perception(c),
    fortitude: R.savingThrow(c, 'fortitude'),
    reflex: R.savingThrow(c, 'reflex'),
    will: R.savingThrow(c, 'will'),
    classDc: R.classDc(c),
    ...Object.fromEntries(c.weapons.map((w) => [`strike: ${w.name}`, R.strikeBonus(c, w)])),
    ...Object.fromEntries([...data.skills, ...c.lores].map((s) => [`skill: ${s}`, R.skillCheck(c, s)])),
    ...(c.spellcasting && { spellAttack: R.spellAttack(c), spellDc: R.spellDc(c) }),
  };
  return Object.entries(stats).filter(([, v]) => !isWhole(v)).map(([k]) => `${k} isn't a number`);
}

/** Runs the builds and fails with the first few broken combinations, named. */
function sweep(builds) {
  const failures = [];
  for (const { label, ...parts } of builds) {
    const problems = check(autoBuild(parts));
    if (problems.length) failures.push(`${label}: ${problems.join(' ')}`);
  }
  assert.equal(failures.length, 0, `${failures.length} builds failed, for example:\n  ${failures.slice(0, 10).join('\n  ')}`);
}

const name = (...items) => items.map((x) => x.name).join(' / ');
const optionCount = (cls) => Math.max(1, ...cls.features.filter((f) => f.choice).map((f) => f.choice.options.length));

describe('build sweep', () => {
  it('offers every ancestry its own heritages', () => {
    const without = data.ancestries.filter((a) => !data.heritages.some((h) => h.ancestry === a.id));
    assert.deepEqual(without.map((a) => a.name), []);
  });

  for (const cls of data.classes) {
    describe(cls.name, () => {
      it('works with every ancestry and heritage', () => {
        let n = 0;
        sweep(
          data.ancestries.flatMap((ancestry) =>
            heritagesFor(ancestry).map((heritage) => {
              const background = data.backgrounds[n % data.backgrounds.length];
              return { label: name(ancestry, heritage, background), cls, ancestry, heritage, background, n: n++ };
            }),
          ),
        );
      });

      it('works with every background', () => {
        sweep(
          data.backgrounds.map((background, n) => {
            const ancestry = data.ancestries[n % data.ancestries.length];
            const heritage = heritagesFor(ancestry)[0];
            return { label: name(ancestry, heritage, background), cls, ancestry, heritage, background, n };
          }),
        );
      });

      it('works with every subclass option and deity', () => {
        const ancestry = data.ancestries.find((a) => a.slug === 'human') ?? data.ancestries[0];
        const heritage = heritagesFor(ancestry)[0];
        const background = data.backgrounds[0];
        const base = { cls, ancestry, heritage, background };
        sweep(
          Array.from({ length: optionCount(cls) }, (_, n) => {
            const options = cls.features.filter((f) => f.choice).map((f) => f.choice.options[n % f.choice.options.length]);
            const label = options.map((o) => o.name).join(' / ') || cls.name;
            if (!cls.deity) return [{ ...base, label, n }];
            return deitiesFor(autoBuild({ ...base, n })).map((deity) => ({ ...base, label: `${label} / ${deity.name}`, n, deity }));
          }).flat(),
        );
      });
    });
  }
});
