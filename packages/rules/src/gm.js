// GM helpers: encounter XP budgets (GM Core) and DCs by level.

// XP for a single creature, keyed by (creature level − party level).
const CREATURE_XP = { '-4': 10, '-3': 15, '-2': 20, '-1': 30, 0: 40, 1: 60, 2: 80, 3: 120, 4: 160 };

// Budget for a party of four, plus the adjustment per character above/below four.
export const THREATS = [
  { name: 'trivial', budget: 40, perCharacter: 10 },
  { name: 'low', budget: 60, perCharacter: 15 },
  { name: 'moderate', budget: 80, perCharacter: 20 },
  { name: 'severe', budget: 120, perCharacter: 30 },
  { name: 'extreme', budget: 160, perCharacter: 40 },
];

export function creatureXp(creatureLevel, partyLevel) {
  const diff = creatureLevel - partyLevel;
  if (diff < -4) return 0;
  if (diff > 4) return null; // too dangerous to price: beyond the table
  return CREATURE_XP[diff];
}

export function budgets(partySize = 4) {
  return THREATS.map((t) => ({ ...t, budget: t.budget + (partySize - 4) * t.perCharacter }));
}

/**
 * Rate an encounter. Creatures: [{ level, count? }].
 * Threat is the lowest tier whose budget covers the XP spent.
 */
export function rateEncounter(creatures, partyLevel, partySize = 4) {
  let xp = 0;
  for (const c of creatures) {
    const each = creatureXp(c.level, partyLevel);
    if (each === null) return { xp: null, threat: 'beyond extreme', budgets: budgets(partySize) };
    xp += each * (c.count ?? 1);
  }
  const table = budgets(partySize);
  const tier = table.find((t) => xp <= t.budget);
  return { xp, threat: tier ? tier.name : 'beyond extreme', budgets: table };
}

const DC_BY_LEVEL = [14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];

export function dcByLevel(level) {
  if (level < 0 || level >= DC_BY_LEVEL.length) throw new Error(`No DC for level ${level}`);
  return DC_BY_LEVEL[level];
}
