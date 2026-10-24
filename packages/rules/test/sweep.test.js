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
const heritagesFor = (ancestry, d = data) => d.heritages.filter((h) => h.ancestry === ancestry.id || !h.ancestry);
const firstMet = (feats, build, d = data) => feats.find((f) => R.featPrerequisites(f, build, d).met)?.id ?? null;
// Fills boost slots in order, taking a fresh attribute where there's a choice.
const fillBoosts = (slots) => slots.reduce((out, s) => [...out, s.length === 1 ? s[0] : s.find((a) => !out.includes(a))], []);
const holyOrUnholy = (build, d = data) =>
  R.chosenOptions(build, d).map((c) => c.option.tags.find((t) => t === 'holy' || t === 'unholy')).find(Boolean);
const deitiesFor = (build, d = data) => {
  const need = holyOrUnholy(build, d);
  return d.deities.filter((x) => !need || R.sanctificationOptions(x).includes(need));
};

/**
 * Makes the choices a player would, picking the n-th option wherever there's a choice.
 * d is the data to build from: everything, or a campaign's view of it.
 */
function autoBuild({ cls, ancestry, heritage, background, n, deity, choices = {}, tradition, d = data }) {
  const b = { ...R.emptyBuild(), name: 'Sweep', ancestry: ancestry.id, heritage: heritage.id, background: background.id, class: cls.id };
  if (heritage.skillChoice) b.heritageSkill = heritage.skillChoice[n % heritage.skillChoice.length];
  const lore = background.lore[0] ? R.loreOptions(background.lore[0]) : null;
  b.lore = lore ? (lore.fixed ?? lore.options?.[0] ?? 'Forest Lore') : '';
  if (cls.skillChoice) b.classSkill = cls.skillChoice[n % cls.skillChoice.length];
  for (const f of cls.features) {
    if (!f.choice) continue;
    const o = choices[f.choice.key] ?? f.choice.options[n % f.choice.options.length];
    b.classChoices[f.choice.key] = o.id;
    if (o.skillChoice) b.classChoiceSkills[f.choice.key] = o.skillChoice[0];
    if (o.traditionChoice) b.tradition = tradition ?? R.TRADITIONS[n % R.TRADITIONS.length];
  }
  if (cls.deity) {
    const options = deitiesFor(b, d);
    const god = deity ?? options[n % options.length];
    b.deity = god.id;
    b.font = god.font[n % god.font.length];
    b.sanctification = holyOrUnholy(b, d) ?? R.sanctificationOptions(god)[0];
  }
  const keys = R.keyAbilityOptions(b, d);
  b.keyAbility = keys[n % keys.length];
  b.ancestryBoosts = fillBoosts(R.ancestryBoostSlots(ancestry, false));
  b.backgroundBoosts = fillBoosts(background.boosts);
  b.freeBoosts = ['str', 'dex', 'con', 'int'];
  b.ancestryFeat = firstMet(R.ancestryFeatOptions(b, d), b, d);
  if (cls.classFeatAt1) b.classFeat = firstMet(R.classFeatOptions(b, d), b, d);
  for (const slot of R.featSummary(b, d).slots) {
    b.bonusFeats[slot.parent.id] = firstMet(slot.options.filter((f) => f.id !== slot.parent.id), b, d);
  }
  const picks = R.skillPicks(b, d);
  b.skills = d.skills.filter((s) => !picks.fixed.has(s)).slice(0, picks.total);
  const casting = R.spellcastingOf(b, d);
  if (casting && casting.kind !== 'focus') {
    const o = R.spellOptions(b, d);
    b.cantrips = o.cantrips.slice(0, casting.cantrips).map((s) => s.id);
    b.spells = o.spells.slice(0, casting.spells).map((s) => s.id);
  }
  const runes = R.runesOf(b, d);
  if (runes) {
    const options = R.runeOptions(b, d);
    b.runes = Array.from({ length: runes.known }, (_, i) => options[(n + i) % options.length].id);
  }
  const weapons = d.weapons.filter((w) => w.price <= 200);
  b.weapons = [weapons[n % weapons.length].id];
  const armor = d.armor.filter((a) => a.price <= 900);
  b.armor = armor[n % armor.length].id;
  return b;
}

const isWhole = (x) => Number.isInteger(x?.total ?? x);

/** Problems with one build: rule problems, or a sheet with missing or non-numeric stats. */
function check(build, d = data) {
  const problems = R.buildProblems(build, d).map((p) => p.message);
  if (problems.length) return problems;
  const c = JSON.parse(JSON.stringify(R.buildCharacter(build, d)));
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
function sweep(builds, d = data) {
  const failures = [];
  for (const { label, ...parts } of builds) {
    const problems = check(autoBuild({ ...parts, d }), d);
    if (problems.length) failures.push(`${label}: ${problems.join(' ')}`);
  }
  assert.equal(failures.length, 0, `${failures.length} builds failed, for example:\n  ${failures.slice(0, 10).join('\n  ')}`);
}

const name = (...items) => items.map((x) => x.name).join(' / ');
/** Every combination of a class's subclass choices, as { [choice key]: option }. */
const combinations = (cls) =>
  cls.features
    .filter((f) => f.choice)
    .reduce((combos, f) => combos.flatMap((c) => f.choice.options.map((o) => ({ ...c, [f.choice.key]: o }))), [{}]);

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

      // Every combination of the class's choices (a wizard's school and thesis, a
      // necromancer's fatal method and grim fascination), every tradition where an
      // option lets you pick one (a dragon eidolon), and every deity that fits.
      it('works with every combination of subclass options, tradition and deity', () => {
        const ancestry = data.ancestries.find((a) => a.slug === 'human') ?? data.ancestries[0];
        const heritage = heritagesFor(ancestry)[0];
        const background = data.backgrounds[0];
        const base = { cls, ancestry, heritage, background, n: 0 };
        const builds = combinations(cls).flatMap((choices) => {
          const options = Object.values(choices);
          const label = options.map((o) => o.name).join(' / ') || cls.name;
          const traditions = options.some((o) => o.traditionChoice) ? R.TRADITIONS : [undefined];
          return traditions.flatMap((tradition) => {
            const one = { ...base, choices, tradition, label: tradition ? `${label} (${tradition})` : label };
            if (!cls.deity) return [one];
            return deitiesFor(autoBuild(one)).map((deity) => ({ ...one, label: `${one.label} / ${deity.name}`, deity }));
          });
        });
        assert.equal(builds.length >= combinations(cls).length, true);
        sweep(builds);
      });
    });
  }

  // A campaign can allow just Player Core plus one other book. Each book's classes,
  // ancestries, heritages and backgrounds must work with only that, and nothing a
  // character picks may come from a book the campaign leaves out.
  describe('one-book campaigns', () => {
    for (const book of data.meta.books.filter((b) => b !== R.CORE_BOOK)) {
      it(`works with only Player Core and ${book}`, () => {
        const books = R.campaignBooks([book], data.meta.books);
        const view = R.campaignData(data, books);
        const fromBook = (list) => list.filter((x) => x.source === book);
        const classes = fromBook(view.classes).length ? fromBook(view.classes) : view.classes;
        const ancestries = view.ancestries.filter((a) => heritagesFor(a, view).length);
        let n = 0;
        const builds = classes.flatMap((cls) =>
          ancestries.flatMap((ancestry) =>
            heritagesFor(ancestry, view)
              .filter((h) => h.source === book || ancestry.source === book || cls.source === book)
              .slice(0, 3)
              .map((heritage) => {
                const backgrounds = fromBook(view.backgrounds).length ? fromBook(view.backgrounds) : view.backgrounds;
                const background = backgrounds[n % backgrounds.length];
                return { label: `${book}: ${name(cls, ancestry, heritage, background)}`, cls, ancestry, heritage, background, n: n++ };
              }),
          ),
        );
        assert.ok(builds.length > 0, `${book} has something to build`);
        sweep(builds, view);
        const outside = builds.flatMap(({ label, ...parts }) => R.bookIssues(autoBuild({ ...parts, d: view }), data, books).map((i) => `${label}: ${i.name} (${i.book})`));
        assert.deepEqual(outside.slice(0, 5), []);
      });
    }
  });
});
