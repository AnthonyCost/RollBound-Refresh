// Leveling up, levels 2 to 20 (Player Core ch. 2, "Leveling Up"). A build's level-1
// choices stay where they are; build.level is the character's level and build.levels
// holds one entry per level from 2 up (build.levels[0] is level 2):
//
//   { classFeat, ancestryFeat, skillFeat, generalFeat,   feat IDs, when the level grants one
//     skillIncrease,                                     a skill (or a Lore) to raise one rank
//     boosts: [4 attributes],                            at levels 5, 10, 15 and 20
//     spells: [spell IDs],                               spells learned this level (casters)
//     choices: { [feature slug]: value } }               e.g. a weapon group, a chosen save
//
// Everything here is a pure function of the build and the class, so the sheet can
// always be rebuilt from the build, and going back a level is dropping the last entry.

import { RANKS } from './proficiency.js';

export const MAX_LEVEL = 20;
export const BOOST_LEVELS = [5, 10, 15, 20];

/** The character's level from a build (builds from before leveling are level 1). */
export const levelOf = (build) => Math.min(MAX_LEVEL, Math.max(1, Number(build?.level) || 1));

/** The choices made at a level (2-20), or an empty entry. */
export function entryFor(build, level) {
  return build?.levels?.[level - 2] ?? {};
}

/** Every level entry the character has reached, as [level, entry]. */
export function reachedEntries(build) {
  const out = [];
  for (let level = 2; level <= levelOf(build); level++) out.push([level, entryFor(build, level)]);
  return out;
}

/** What a level gives a class: which feats, a skill increase, attribute boosts, and the features that arrive. */
export function levelGrants(cls, level) {
  const p = cls?.progression ?? {};
  const has = (list) => (list ?? []).includes(level);
  return {
    level,
    classFeat: level > 1 && has(p.classFeats),
    ancestryFeat: level > 1 && has(p.ancestryFeats),
    skillFeat: has(p.skillFeats),
    generalFeat: has(p.generalFeats),
    skillIncrease: has(p.skillIncreases),
    boosts: BOOST_LEVELS.includes(level),
    features: (cls?.advancement ?? []).filter((a) => a.level === level),
  };
}

// ---------- Feature choices ----------

/**
 * Class features above 1st level that need a choice from the player. Their text says
 * "choose one weapon group" or "the chosen saving throw"; the rules engine turns the
 * choice into the proficiency it gives.
 */
export const WEAPON_GROUPS = ['axe', 'bomb', 'bow', 'brawling', 'club', 'crossbow', 'dart', 'firearm', 'flail', 'hammer', 'knife', 'pick', 'polearm', 'shield', 'sling', 'spear', 'sword'];
export const SAVES = ['fortitude', 'reflex', 'will'];

/** The choice a feature asks for: { kind: 'weaponGroup' | 'save', ... } or null. */
export function featureChoice(feature) {
  const text = feature.description ?? '';
  if (/choose (?:one|a) weapon group|select one weapon group|in that (?:weapon )?group/i.test(text)) return { kind: 'weaponGroup', options: WEAPON_GROUPS };
  if (/the chosen (?:saving throw|type of save)/i.test(text)) return { kind: 'save', options: SAVES };
  return null;
}

/** The rank a weapon-group feature gives, read from its text: { group ranks by category }. */
function weaponGroupRanks(feature) {
  const text = (feature.description ?? '').replace(/<[^>]+>/g, ' ');
  const top = /(?:increases? to|ranks? to) (master|legendary)/i.exec(text)?.[1]?.toLowerCase();
  const advanced = /to (expert|master) (?:with|for) (?:all )?(?:the )?advanced weapons/i.exec(text)?.[1]?.toLowerCase();
  return { top, advanced };
}

// ---------- Attributes ----------

/**
 * Applies level 5/10/15/20 boosts to level-1 modifiers. A boost to an attribute at +4 or
 * more is a partial boost; two partial boosts to the same attribute make +1 (Remaster).
 * Returns { mods, partial: Set of attributes holding an unpaired partial, sources }.
 */
export function applyLevelBoosts(baseMods, build) {
  const mods = { ...baseMods };
  const partial = new Set();
  const sources = [];
  for (const [level, entry] of reachedEntries(build)) {
    if (!BOOST_LEVELS.includes(level)) continue;
    const boosts = [0, 1, 2, 3].map((i) => entry.boosts?.[i] ?? null);
    sources.push({ id: `level-${level}`, label: `Level ${level} boosts`, level, boosts });
    for (const b of boosts) {
      if (!b) continue;
      if (mods[b] >= 4) {
        if (partial.has(b)) {
          partial.delete(b);
          mods[b] += 1;
        } else partial.add(b);
      } else mods[b] += 1;
    }
  }
  return { mods, partial, sources };
}

// ---------- Skills ----------

/** The highest rank a skill increase can reach at a level: expert from 2nd, master from 7th, legendary from 15th. */
export function maxSkillRank(level) {
  return level >= 15 ? 'legendary' : level >= 7 ? 'master' : 'expert';
}

/**
 * Skill ranks after skill increases, from the level-1 trained set. An increase raises a
 * skill one rank (or trains an untrained one). Returns { ranks: { skill: rank }, errors }.
 */
export function skillRanks(trained, build) {
  const ranks = {};
  for (const s of trained) ranks[s] = 'trained';
  const errors = [];
  for (const [level, entry] of reachedEntries(build)) {
    const s = entry.skillIncrease;
    if (!s) continue;
    const next = RANKS[RANKS.indexOf(ranks[s] ?? 'untrained') + 1];
    if (!next || RANKS.indexOf(next) > RANKS.indexOf(maxSkillRank(level))) {
      errors.push({ level, message: `Level ${level}: ${s} can't go above ${ranks[s] ?? 'untrained'} yet.` });
      continue;
    }
    ranks[s] = next;
  }
  return { ranks, errors };
}

// ---------- Proficiencies ----------

const ARMOR = ['unarmored', 'light', 'medium', 'heavy'];
const WEAPONS = ['unarmed', 'simple', 'martial', 'advanced'];
const best = (a, b) => (RANKS.indexOf(b) > RANKS.indexOf(a ?? 'untrained') ? b : a);

/**
 * Raises a level-1 proficiency set (see proficienciesOf) with every class feature up to
 * the build's level, including the player's choices (weapon group, chosen save).
 */
export function applyAdvancement(p, cls, build) {
  const level = levelOf(build);
  for (const feature of cls?.advancement ?? []) {
    if (feature.level > level) continue;
    for (const [target, rank] of Object.entries(feature.proficiencies ?? {})) {
      if (ARMOR.includes(target)) p.armor[target] = best(p.armor[target], rank);
      else if (WEAPONS.includes(target)) p.weapons[target] = best(p.weapons[target], rank);
      else if (['perception', 'fortitude', 'reflex', 'will', 'classDc', 'spellcasting'].includes(target)) {
        if (target !== 'spellcasting' || p.spellcasting) p[target] = best(p[target], rank);
      } else {
        // "simple-firearms-crossbows" (a gunslinger's): a rank for some groups within a category.
        const m = /^(simple|martial|advanced)-(.+)$/.exec(target);
        if (m) p.weaponGroups = [...(p.weaponGroups ?? []), { groups: m[2].split('-').filter((g) => g !== 'and').map((g) => g.replace(/s$/, '')), categories: [m[1]], rank }];
      }
    }
    const choice = featureChoice(feature);
    const picked = entryFor(build, feature.level).choices?.[feature.slug];
    if (choice?.kind === 'save' && SAVES.includes(picked)) {
      const rank = /legendary/i.test(feature.description) ? 'legendary' : 'master';
      p[picked] = best(p[picked], rank);
    }
    if (choice?.kind === 'weaponGroup' && WEAPON_GROUPS.includes(picked)) {
      const { top, advanced } = weaponGroupRanks(feature);
      if (top) p.weaponGroups = [...(p.weaponGroups ?? []), { groups: [picked], categories: ['unarmed', 'simple', 'martial'], rank: top }];
      if (advanced) p.weaponGroups = [...(p.weaponGroups ?? []), { groups: [picked], categories: ['advanced'], rank: advanced }];
    }
  }
  return p;
}

// ---------- Spells ----------

// How a caster's slots grow. "Full": a new rank brings 2 slots, then 3 (bard, cleric,
// druid, witch, wizard). Sorcerer and oracle get one more of each. Psychic and necromancer
// get one fewer. Wave casters (magus, summoner) keep only their two highest ranks.
const SLOT_PATTERN = { sorcerer: 'plus', oracle: 'plus', psychic: 'minus', necromancer: 'minus', magus: 'wave', summoner: 'wave' };

/** The highest spell rank at a level (1 at 1st, 2 at 3rd, … 9 at 17th). */
export const maxSpellRank = (level) => Math.min(9, Math.ceil(level / 2));

/** Spell slots by rank at a level, { 1: 3, 2: 3, 3: 2, … }; {} for casters without slots. */
export function spellSlots(casting, classSlug, level) {
  if (!casting || casting.kind === 'focus' || !casting.slots) return {};
  const pattern = SLOT_PATTERN[classSlug] ?? 'full';
  const top = maxSpellRank(level);
  const fresh = level % 2 === 1; // the top rank arrived this level
  const slots = {};
  if (pattern === 'wave') {
    // 1 slot of a new top rank, 2 once it's settled, and 2 of the rank below.
    slots[top] = fresh ? 1 : 2;
    if (top > 1) slots[top - 1] = 2;
    return slots;
  }
  const settled = { full: 3, plus: 4, minus: 2 }[pattern];
  for (let r = 1; r <= top; r++) slots[r] = r === top && fresh ? settled - 1 : settled;
  return slots;
}

/** How many spells a caster learns on reaching a level (repertoire: one per new slot; spellbook and familiar: 2). */
export function spellsLearnedAt(casting, classSlug, level) {
  if (!casting || level < 2) return 0;
  if (casting.kind === 'spellbook' || casting.kind === 'familiar') return 2;
  if (casting.kind !== 'repertoire') return 0;
  const total = (l) => Object.values(spellSlots(casting, classSlug, l)).reduce((a, b) => a + b, 0);
  return Math.max(0, total(level) - total(level - 1));
}
