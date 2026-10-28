// Turns the iconics in pregens/specs.js (choices by name, from their PDF sheets) into
// builder builds and writes src/pregens.js.
//   npm run pregens -w packages/rules
// For each hero it finds every choice by name, works out the attribute boosts that give
// the sheet's attributes, splits trained skills into granted and chosen, then checks the
// build with buildProblems() and compares Hit Points, AC, Perception and saves with the
// sheet. Anything it can't place is reported, and that hero is left out.
import { writeFileSync } from 'node:fs';
import { loadRulesData } from '../src/load.js';
import {
  ABILITIES, emptyBuild, lookup, ancestryBoostSlots, attributes, skillPicks, grantedSkills, languagePicks,
  featSummary, ancestryFeatOptions, classFeatOptions, spellOptions, spellcastingOf, runeOptions, buildProblems, buildCharacter,
} from '../src/builder.js';
import { maxHp, armorClass, perception, savingThrow, SKILL_ABILITY } from '../src/character.js';
import { SPECS } from '../pregens/specs.js';

const data = loadRulesData();
const norm = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const byName = (list, name) => (name ? list.find((x) => norm(x.name) === norm(name)) ?? null : null);
const slugOf = (s) => norm(s).replace(/ /g, '-');

/** Every way to fill slots (each a list of allowed attributes) without repeating one in a source. */
function* fill(slots, taken = []) {
  if (!slots.length) return yield [];
  const [first, ...rest] = slots;
  for (const a of first) {
    if (taken.includes(a)) continue;
    for (const tail of fill(rest, [...taken, a])) yield [a, ...tail];
  }
}

/** Boosts that give exactly the sheet's attributes, or null. */
function solveBoosts(build, want) {
  const { ancestry, background } = lookup(build, data);
  const free = [ABILITIES, ABILITIES, ABILITIES, ABILITIES];
  for (const alt of [false, true]) {
    const aSlots = ancestryBoostSlots(ancestry, alt);
    for (const a of fill(aSlots)) {
      for (const b of fill(background.boosts)) {
        for (const f of fill(free)) {
          const trial = { ...build, altAncestryBoosts: alt, ancestryBoosts: a, backgroundBoosts: b, freeBoosts: f };
          const { mods } = attributes(trial, data);
          if (ABILITIES.every((x) => mods[x] === want[x])) return trial;
        }
      }
    }
  }
  return null;
}

const results = [];
for (const spec of SPECS) {
  const issues = [];
  // Notes: differences from the sheet the builder can't express. They don't block the hero.
  const notes = spec.note ? [spec.note] : [];
  const need = (label, value) => {
    if (!value) issues.push(`no ${label}`);
    return value;
  };
  let build = { ...emptyBuild(), name: spec.name };
  const ancestry = need(`ancestry "${spec.ancestry}"`, byName(data.ancestries, spec.ancestry));
  const heritage = need(`heritage "${spec.heritage}"`, byName(data.heritages, spec.heritage));
  const background = need(`background "${spec.background}"`, byName(data.backgrounds, spec.background));
  const cls = need(`class "${spec.cls}"`, byName(data.classes, spec.cls));
  if (issues.length) {
    results.push({ spec, issues });
    continue;
  }
  build = { ...build, ancestry: ancestry.id, heritage: heritage.id, background: background.id, class: cls.id, keyAbility: spec.key, lore: spec.lore ?? '' };

  // Class options (instinct, muse, ...), then deity, font and sanctification.
  for (const [key, optionName] of Object.entries(spec.choices ?? {})) {
    const feature = cls.features.find((f) => f.choice?.key === key);
    const option = byName(feature?.choice.options ?? [], optionName);
    if (option) build.classChoices = { ...build.classChoices, [key]: option.id };
    else issues.push(`no ${key} option "${optionName}"`);
  }
  if (spec.deity) build.deity = need(`deity "${spec.deity}"`, byName(data.deities, spec.deity))?.id ?? null;
  if (spec.font) build.font = spec.font;
  if (spec.sanctification) build.sanctification = spec.sanctification;
  if (spec.tradition) build.tradition = spec.tradition;
  if (spec.classSkill) build.classSkill = spec.classSkill;

  const solved = solveBoosts(build, spec.attrs);
  if (solved) build = solved;
  else issues.push(`no boosts give ${JSON.stringify(spec.attrs)}`);

  // Skills: anything a choice can be pointed at first, then the free picks are what's left.
  const trained = new Set(spec.trained);
  const grantedNow = () => new Set(grantedSkills(build, data).map((g) => g.skill));
  if (cls.skillChoice && !build.classSkill) build.classSkill = cls.skillChoice.find((s) => trained.has(s)) ?? cls.skillChoice[0];
  for (const [key, id] of Object.entries(build.classChoices)) {
    const option = cls.features.find((f) => f.choice?.key === key).choice.options.find((o) => o.id === id);
    if (option.skillChoice) build.classChoiceSkills = { ...build.classChoiceSkills, [key]: [...trained].find((s) => !grantedNow().has(s)) ?? null };
  }
  if (heritage.skillChoice) build.heritageSkill = [...trained].find((s) => !grantedNow().has(s)) ?? null;
  const { fixed, total } = skillPicks(build, data);
  build.skills = [...trained].filter((s) => !fixed.has(s));
  if (build.skills.length > total) {
    notes.push(`not trained in ${build.skills.slice(total).join(', ')} (from feats the builder doesn't model)`);
    build.skills = build.skills.slice(0, total);
  } else if (build.skills.length < total) {
    // Picks the sheet spent on Lore skills: use them on the skills with the best attribute.
    const { mods } = attributes(build, data);
    const spare = Object.entries(SKILL_ABILITY).filter(([s]) => !fixed.has(s) && !build.skills.includes(s)).sort((a, b) => mods[b[1]] - mods[a[1]]);
    const added = spare.slice(0, total - build.skills.length).map(([s]) => s);
    build.skills = [...build.skills, ...added];
    notes.push(`also trained in ${added.join(', ')} (the sheet spends those picks on Lore)`);
  }

  const langs = languagePicks(build, data);
  const findLang = (l) => [...data.languages, ...langs.granted].find((x) => norm(x) === norm(l));
  const missingLangs = spec.languages.filter((l) => !findLang(l));
  if (missingLangs.length) notes.push(`doesn't speak ${missingLangs.join(', ')} (regional languages aren't in the builder)`);
  build.languages = spec.languages.map(findLang).filter((l) => l && !langs.granted.includes(l)).slice(0, langs.total);

  // Feats: the ancestry and class feat from what the builder offers, then each granted slot.
  const pick = (options, name, label) => {
    if (!name) return null;
    const f = byName(options, name) ?? byName(data.feats, name);
    if (!f) issues.push(`no ${label} "${name}"`);
    return f?.id ?? null;
  };
  build.ancestryFeat = pick(ancestryFeatOptions(build, data), spec.ancestryFeat, 'ancestry feat');
  build.classFeat = pick(classFeatOptions(build, data), spec.classFeat, 'class feat');
  for (let pass = 0; pass < 3; pass++) {
    for (const slot of featSummary(build, data).slots) {
      if (slot.chosen) continue;
      const wanted = Object.entries(spec.bonus ?? {}).find(([parent]) => norm(parent) === norm(slot.parent.name))?.[1];
      if (wanted) build.bonusFeats = { ...build.bonusFeats, [slot.parent.id]: pick(slot.options, wanted, `${slot.parent.name} feat`) };
    }
  }

  const spellsFrom = (names = [], rank) =>
    names.map((n) => {
      const offered = spellOptions(build, data);
      const s = byName(rank === 0 ? offered.cantrips : offered.spells, n) ?? byName(data.spells.filter((x) => (x.kind ?? 'spell') === 'spell'), n);
      if (!s) issues.push(`no spell "${n}"`);
      return s?.id;
    }).filter(Boolean);
  // Spells the class or a choice already grants don't take a pick; extras fill a spellbook or familiar.
  const casting = spellcastingOf(build, data);
  const granted = new Set((casting?.granted ?? []).map((s) => s.id));
  const fit = (ids, count, label) => {
    const own = [...new Set(ids)].filter((id) => !granted.has(id));
    if (count != null && own.length > count) notes.push(`${label}: ${own.slice(count).map((id) => data.spells.find((s) => s.id === id).name).join(', ')} left out`);
    return count != null ? own.slice(0, count) : own;
  };
  build.cantrips = fit([...spellsFrom(spec.cantrips, 0), ...spellsFrom(spec.extraCantrips, 0)], casting?.cantrips, 'cantrips');
  build.spells = fit([...spellsFrom(spec.spells, 1), ...spellsFrom(spec.extraSpells, 1)], casting?.spells, '1st-rank spells');

  build.runes = (spec.runes ?? []).map((n) => need(`rune "${n}"`, byName(runeOptions(build, data), n))?.id).filter(Boolean);

  build.armor = spec.armor ? need(`armor "${spec.armor}"`, byName(data.armor, spec.armor))?.id ?? null : null;
  build.shield = spec.shield ? need(`shield "${spec.shield}"`, byName(data.shields, spec.shield))?.id ?? null : null;
  build.weapons = (spec.weapons ?? []).map((w) => need(`weapon "${w}"`, byName(data.weapons, w))?.id).filter(Boolean);

  const problems = buildProblems(build, data);
  for (const p of problems) issues.push(`builder: ${p.message}`);
  let stats = null;
  if (!problems.length) {
    const c = buildCharacter(build, data);
    stats = { hp: maxHp(c), ac: armorClass(c).total, perception: perception(c).total, fortitude: savingThrow(c, 'fortitude').total, reflex: savingThrow(c, 'reflex').total, will: savingThrow(c, 'will').total };
  }
  results.push({ spec, build, issues, notes, stats, ancestry, heritage, cls });
}

let ok = 0;
for (const r of results) {
  const diffs = r.stats ? Object.entries(r.spec.sheet).filter(([k, v]) => r.stats[k] !== v).map(([k, v]) => `${k} ${r.stats[k]} (sheet ${v})`) : [];
  const status = r.issues.length ? 'PROBLEM' : 'ok';
  if (!r.issues.length) ok++;
  console.log(`${status.padEnd(7)} ${r.spec.name}${diffs.length ? `  differs: ${diffs.join(', ')}` : r.stats ? '  matches the sheet' : ''}`);
  for (const i of r.issues) console.log(`          - ${i}`);
  for (const n of r.notes ?? []) console.log(`          · ${n}`);
}

const good = results.filter((r) => !r.issues.length);
const out = `// Pregenerated heroes for the builder's "Play a pregenerated hero" choice: Paizo's
// iconics at level 1. Generated by scripts/build-pregens.js from pregens/specs.js; edit
// the specs and rerun \`npm run pregens -w packages/rules\` rather than this file. Builds
// are IDs into the rules data, like SAMPLE_BUILDS. The original sheets are PDFs in
// client/public/pregens/.
export const PREGENS = ${JSON.stringify(
  good.map((r) => ({
    slug: slugOf(r.spec.name),
    name: r.spec.name,
    ancestry: r.ancestry.name,
    heritage: r.heritage.name,
    className: r.cls.name,
    classSlug: r.cls.slug,
    pdf: `pregens/${r.spec.pdf}`,
    ...(r.notes.length && { notes: r.notes }),
    build: r.build,
  })),
  null,
  2,
)};
`;
writeFileSync(new URL('../src/pregens.js', import.meta.url), out);
console.log(`\nWrote ${good.length} of ${SPECS.length} heroes to src/pregens.js.`);
