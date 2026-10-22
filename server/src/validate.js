import { RANKS } from '@rollbound/rules';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Returns a list of problems with a character payload (empty when valid). */
export function validateCharacter(c) {
  const errors = [];
  if (!c || typeof c !== 'object') return ['Body must be a character object.'];

  if (typeof c.name !== 'string' || !c.name.trim()) errors.push('name is required.');
  if (!Number.isInteger(c.level) || c.level < 1 || c.level > 20) errors.push('level must be an integer from 1 to 20.');
  if (!c.ancestry || !Number.isInteger(c.ancestry.hp)) errors.push('ancestry.hp is required.');
  if (!Number.isInteger(c.classHp)) errors.push('classHp is required.');

  for (const a of ABILITIES) {
    const v = c.abilities?.[a];
    if (!Number.isInteger(v) || v < -5 || v > 7) errors.push(`abilities.${a} must be an integer modifier from −5 to +7.`);
  }

  for (const key of ['perception', 'fortitude', 'reflex', 'will']) {
    if (!RANKS.includes(c.proficiencies?.[key])) errors.push(`proficiencies.${key} must be one of: ${RANKS.join(', ')}.`);
  }

  return errors;
}
