// Strikes, the multiple attack penalty, and the four degrees of success.

import { proficiencyPart } from './proficiency.js';
import { statusPenalty } from './conditions.js';

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

/** Attack bonus for a Strike, as { total, parts }. */
export function strikeBonus(character, weapon, { attacksSoFar = 0, conditions = [] } = {}) {
  const ability = strikeAbility(weapon, character.abilities);
  const rank = character.proficiencies.weapons[weapon.category];
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

  return { total: parts.reduce((t, x) => t + x.value, 0), parts };
}

/**
 * Degree of success for a check against a DC.
 * Beat the DC by 10+ = critical success; meet it = success; miss by less than
 * 10 = failure; miss by 10+ = critical failure. A natural 20 raises the result
 * one step and a natural 1 lowers it one step.
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
