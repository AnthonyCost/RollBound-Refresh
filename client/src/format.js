export const signed = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

// Skips the letter after an apostrophe ("target's"), and leaves "or" alone.
export const titleCase = (s) => s.replace(/(?<![\w'’])\w/g, (c) => c.toUpperCase()).replace(/ Or /g, ' or ');

/** Capitalizes the first letter only: "touch or 30 feet" to "Touch or 30 feet". */
export const sentenceCase = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A caster's daily slots, "3 rank 1 · 2 rank 2 slots" (sheets from before leveling only have rank 1). */
export const slotsText = (casting) =>
  `${Object.entries(casting.slotsByRank ?? { 1: casting.slots }).map(([r, n]) => `${n} rank ${r}`).join(' · ')} slots`;
