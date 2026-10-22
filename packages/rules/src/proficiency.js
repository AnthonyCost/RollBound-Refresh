// Proficiency ranks (Player Core). Untrained adds nothing; every other rank
// adds its bonus plus your level.

export const RANKS = ['untrained', 'trained', 'expert', 'master', 'legendary'];

export const RANK_BONUS = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8,
};

export function proficiencyBonus(rank, level) {
  if (!(rank in RANK_BONUS)) throw new Error(`Unknown proficiency rank: ${rank}`);
  if (rank === 'untrained') return 0;
  return RANK_BONUS[rank] + level;
}

/** A labeled breakdown part that the UI can explain. */
export function proficiencyPart(rank, level) {
  const value = proficiencyBonus(rank, level);
  const label = `Proficiency (${rank[0].toUpperCase()}${rank.slice(1)})`;
  const note =
    rank === 'untrained'
      ? 'Untrained adds nothing, not even your level.'
      : `${rank[0].toUpperCase()}${rank.slice(1)} gives +${RANK_BONUS[rank]}, plus your level (${level}).`;
  return { label, value, note };
}
