// Derived character statistics, each returned as { total, parts } so the UI can
// show the math. Uses Remaster ability modifiers directly (no ability scores).

import { proficiencyPart } from './proficiency.js';
import { statusPenalty, circumstancePenaltyToAC } from './conditions.js';

const SAVE_ABILITY = { fortitude: 'con', reflex: 'dex', will: 'wis' };
const ABILITY_NAME = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma',
};

function sum(parts) {
  return parts.reduce((t, p) => t + p.value, 0);
}

function withPenalty(parts, conditions, ability) {
  const p = statusPenalty(conditions, ability);
  if (p.value) parts.push({ label: p.source, value: p.value, note: 'Status penalty from a condition.' });
  return parts;
}

export function maxHp(character) {
  const { ancestry, classHp, level, abilities } = character;
  return ancestry.hp + (classHp + abilities.con) * level;
}

export function armorClass(character, { conditions = [], shieldRaised = false } = {}) {
  const { abilities, armor, level, proficiencies } = character;
  const dexCap = armor?.dexCap ?? Infinity;
  const dex = Math.min(abilities.dex, dexCap);
  const rank = proficiencies.armor[armor?.category ?? 'unarmored'];

  const dexPart = { label: 'Dexterity', value: dex };
  if (abilities.dex > dexCap) {
    dexPart.note = `Your Dex is +${abilities.dex}, but ${armor.name.toLowerCase()} caps it at +${dexCap}.`;
  }

  const parts = [
    { label: 'Base', value: 10 },
    dexPart,
    proficiencyPart(rank, level),
  ];
  if (armor) parts.push({ label: armor.name, value: armor.acBonus, note: 'Item bonus from your armor.' });
  if (shieldRaised) parts.push({ label: 'Raised shield', value: 2, note: 'Circumstance bonus until your next turn.' });

  const offGuard = circumstancePenaltyToAC(conditions);
  if (offGuard) parts.push({ label: 'Off-Guard', value: offGuard, note: 'Circumstance penalty to AC.' });

  withPenalty(parts, conditions, 'dex');
  return { total: sum(parts), parts };
}

export function savingThrow(character, save, { conditions = [] } = {}) {
  const ability = SAVE_ABILITY[save];
  if (!ability) throw new Error(`Unknown save: ${save}`);
  const parts = [
    { label: ABILITY_NAME[ability], value: character.abilities[ability] },
    proficiencyPart(character.proficiencies[save], character.level),
  ];
  withPenalty(parts, conditions, ability);
  return { total: sum(parts), parts };
}

export function perception(character, { conditions = [] } = {}) {
  const parts = [
    { label: 'Wisdom', value: character.abilities.wis },
    proficiencyPart(character.proficiencies.perception, character.level),
  ];
  withPenalty(parts, conditions, 'wis');
  return { total: sum(parts), parts };
}

export const SKILL_ABILITY = {
  acrobatics: 'dex',
  arcana: 'int',
  athletics: 'str',
  crafting: 'int',
  deception: 'cha',
  diplomacy: 'cha',
  intimidation: 'cha',
  medicine: 'wis',
  nature: 'wis',
  occultism: 'int',
  performance: 'cha',
  religion: 'wis',
  society: 'int',
  stealth: 'dex',
  survival: 'wis',
  thievery: 'dex',
};

/** A skill check, or a Lore check when `skill` isn't one of the 16 skills (Lore uses Int unless noted). */
export function skillCheck(character, skill, { conditions = [] } = {}) {
  const ability = SKILL_ABILITY[skill] ?? character.loreAbilities?.[skill] ?? 'int';
  const rank = SKILL_ABILITY[skill]
    ? (character.skills?.[skill] ?? 'untrained')
    : character.lores?.includes(skill) ? 'trained' : 'untrained';
  const parts = [
    { label: ABILITY_NAME[ability], value: character.abilities[ability] },
    proficiencyPart(rank, character.level),
  ];

  // Armor's check penalty hits Str and Dex skills unless you meet its Strength
  // requirement; flexible armor spares Acrobatics and Athletics, and noisy armor
  // penalizes Stealth regardless.
  const armor = character.armor;
  if (armor?.checkPenalty && (ability === 'str' || ability === 'dex')) {
    const traits = armor.traits ?? [];
    const meetsStrength = armor.strength != null && character.abilities.str >= armor.strength;
    const flexibleExempt = traits.includes('flexible') && (skill === 'acrobatics' || skill === 'athletics');
    const noisyStealth = traits.includes('noisy') && skill === 'stealth';
    if (!flexibleExempt && (!meetsStrength || noisyStealth)) {
      parts.push({ label: `${armor.name} check penalty`, value: armor.checkPenalty, note: 'Armor hampers Strength- and Dexterity-based skills.' });
    }
  }

  withPenalty(parts, conditions, ability);
  return { total: sum(parts), parts, rank, ability };
}

/** Spell attack modifier: key attribute + spellcasting proficiency. */
export function spellAttack(character, { conditions = [] } = {}) {
  const ability = character.spellcasting?.ability ?? character.keyAbility;
  const parts = [
    { label: ABILITY_NAME[ability], value: character.abilities[ability] },
    proficiencyPart(character.proficiencies.spellcasting ?? 'untrained', character.level),
  ];
  withPenalty(parts, conditions, ability);
  return { total: sum(parts), parts };
}

/** Spell DC: 10 + the same parts as your spell attack. */
export function spellDc(character, opts) {
  const attack = spellAttack(character, opts);
  return { total: 10 + attack.total, parts: [{ label: 'Base', value: 10 }, ...attack.parts] };
}

/** Class DC: 10 + key attribute + class DC proficiency. */
export function classDc(character) {
  const ability = character.keyAbility;
  const parts = [
    { label: 'Base', value: 10 },
    { label: ABILITY_NAME[ability], value: character.abilities[ability] },
    proficiencyPart(character.proficiencies.classDc ?? 'trained', character.level),
  ];
  return { total: sum(parts), parts };
}

export function abilityName(key) {
  return ABILITY_NAME[key];
}
