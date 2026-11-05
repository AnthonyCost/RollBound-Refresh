// Strikes, the multiple attack penalty, and the four degrees of success.

import { RANKS, proficiencyPart } from './proficiency.js';
import { circumstancePenaltyToAttacks, statusPenalty } from './conditions.js';

export const DEGREES = ['critical failure', 'failure', 'success', 'critical success'];

/**
 * Multiple attack penalty for the Nth attack this turn (0-based count of
 * attacks already made). Agile weapons use −4/−8 instead of −5/−10.
 */
export function multipleAttackPenalty(attacksSoFar, { agile = false } = {}) {
  if (attacksSoFar <= 0) return 0;
  const step = agile ? 4 : 5;
  return attacksSoFar === 1 ? -step : -2 * step;
}

export function strikeAbility(weapon, abilities) {
  const traits = weapon.traits ?? [];
  if (weapon.ranged) return 'dex';
  if (traits.includes('finesse') && abilities.dex > abilities.str) return 'dex';
  return 'str';
}

/** Strength to damage: full for melee and thrown, half (if positive) for propulsive, none for other ranged. */
export function damageModifier(weapon, abilities) {
  const traits = weapon.traits ?? [];
  if (!weapon.ranged || traits.some((t) => t.startsWith('thrown'))) return abilities.str;
  if (traits.includes('propulsive')) return abilities.str > 0 ? Math.floor(abilities.str / 2) : abilities.str;
  return 0;
}

/** Your proficiency with a weapon: its category, or your deity's favored weapon if that's better. */
export function weaponRank(character, weapon) {
  let byCategory = character.proficiencies.weapons[weapon.category] ?? 'untrained';
  for (const g of character.proficiencies.weaponGroups ?? []) {
    if (g.groups.includes(weapon.group) && g.categories.includes(weapon.category) && RANKS.indexOf(g.rank) > RANKS.indexOf(byCategory)) byCategory = g.rank;
  }
  const favored = character.proficiencies.favoredWeapons?.includes(weapon.slug);
  if (!favored) return byCategory;
  const favoredRank = character.proficiencies.favoredWeaponRank ?? 'trained';
  return RANKS.indexOf(favoredRank) > RANKS.indexOf(byCategory) ? favoredRank : byCategory;
}

/** Attack bonus for a Strike, as { total, parts }. */
export function strikeBonus(character, weapon, { attacksSoFar = 0, conditions = [] } = {}) {
  const ability = strikeAbility(weapon, character.abilities);
  const rank = weaponRank(character, weapon);
  const parts = [
    { label: ability === 'dex' ? 'Dexterity' : 'Strength', value: character.abilities[ability] },
    proficiencyPart(rank, character.level),
  ];
  if (weapon.itemBonus) parts.push({ label: 'Potency rune', value: weapon.itemBonus });

  const agile = (weapon.traits ?? []).includes('agile');
  const map = multipleAttackPenalty(attacksSoFar, { agile });
  if (map) {
    parts.push({
      label: 'Multiple attack penalty',
      value: map,
      note: `Attack #${attacksSoFar + 1} this turn${agile ? ' (agile weapon)' : ''}.`,
    });
  }

  const p = statusPenalty(conditions, ability);
  if (p.value) parts.push({ label: p.source, value: p.value, note: 'Status penalty from a condition.' });
  const prone = circumstancePenaltyToAttacks(conditions);
  if (prone) parts.push({ label: 'Prone', value: prone, note: 'Circumstance penalty to attack rolls while prone.' });

  return { total: parts.reduce((t, x) => t + x.value, 0), parts };
}

/**
 * Degree of success for a check against a DC.
 * Beat the DC by 10+ = critical success; meet it = success; miss by less than
 * 10 = failure; miss by 10+ = critical failure. A natural 20 raises the result
 * one step and a natural 1 lowers it one step. A negative total is always a
 * critical failure (a house rule, not the Core Rulebook's).
 */
export function degreeOfSuccess(total, dc, natural = null) {
  const diff = total - dc;
  let index;
  if (diff >= 10) index = 3;
  else if (diff >= 0) index = 2;
  else if (diff > -10) index = 1;
  else index = 0;

  if (natural === 20) index = Math.min(3, index + 1);
  if (natural === 1) index = Math.max(0, index - 1);
  if (total < 0) index = 0;

  return { index, name: DEGREES[index], margin: diff };
}

/** Total ranges (before nat 20/1 adjustments) for each degree vs. a DC. */
export function degreeRanges(dc) {
  return [
    { name: 'critical success', min: dc + 10, max: null },
    { name: 'success', min: dc, max: dc + 9 },
    { name: 'failure', min: dc - 9, max: dc - 1 },
    { name: 'critical failure', min: null, max: dc - 10 },
  ];
}

/** Strike damage: doubled on a critical success, nothing on a miss. */
export function strikeDamage(rolled, modifier, degree) {
  const base = Math.max(1, rolled + modifier);
  if (degree === 'critical success') return base * 2;
  if (degree === 'success') return base;
  return 0;
}

export function rollDie(sides, rng = Math.random) {
  return 1 + Math.floor(rng() * sides);
}

export const DIE_SIZES = [4, 6, 8, 10, 12, 20, 100];

/** A dice expression ("2d6+3", "1d8 + 4", "1d4−1", "d6") as { count, sides, mod }, or null. */
export function parseDice(expr) {
  const m = /^\s*(\d*)d(\d+)\s*(?:([+\-−])\s*(\d+))?\s*$/i.exec(String(expr ?? ''));
  if (!m) return null;
  const count = m[1] === '' ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  if (count < 1 || count > 50 || !DIE_SIZES.includes(sides)) return null;
  const mod = m[3] ? (m[3] === '+' ? 1 : -1) * Number(m[4]) : 0;
  return { count, sides, mod };
}

/**
 * Rolls a damage expression: each die, the modifier, and the total. Damage is never less
 * than 1 (Player Core: after penalties, a hit deals at least 1). Returns null if the
 * expression can't be read.
 */
export function rollDice(expr, rng = Math.random) {
  const p = parseDice(expr);
  if (!p) return null;
  const dice = Array.from({ length: p.count }, () => ({ sides: p.sides, value: rollDie(p.sides, rng) }));
  return { ...p, dice, total: Math.max(1, dice.reduce((t, d) => t + d.value, 0) + p.mod) };
}
