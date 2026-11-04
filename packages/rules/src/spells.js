// Prepared spells for casters who prepare from the spells they know: a wizard, magus or
// necromancer from their spellbook (or dirge), a witch from her familiar. Each day they
// pick spellcasting.prepares.cantrips of their cantrips, and fill each spell slot with a
// spell they know of that rank or lower (the same spell can fill more than one slot).
// It's kept apart from the sheet the builder makes, like the inventory. Shape:
// { cantrips: [spellKey], slots: [spellKey or null] }: slots run in rank order (all the
// rank 1 slots, then rank 2, …; see slotRanks), and a spell's key is its id (or slug, on
// sheets from before spells had ids). A level 1 character's slots are all rank 1.

/** A spell's key in a prepared list. */
export const spellKey = (s) => s.id ?? s.slug;

/**
 * The rank of each spell slot, in order: [1, 1, 1, 2, 2, …]. From the sheet's slots by
 * rank (levels 2-20), or its rank 1 slots for sheets from before leveling.
 */
export function slotRanks(character) {
  const sc = character?.spellcasting;
  if (!sc) return [];
  const byRank = sc.slotsByRank && Object.keys(sc.slotsByRank).length ? sc.slotsByRank : { 1: sc.prepares?.spells ?? sc.slots ?? 0 };
  return Object.entries(byRank)
    .map(([r, n]) => [Number(r), n])
    .sort((a, b) => a[0] - b[0])
    .flatMap(([r, n]) => Array.from({ length: n }, () => r));
}

/** Whether this character prepares spells from the ones they know. */
export const preparesFromKnown = (character) => Boolean(character?.spellcasting?.prepares);

/**
 * What's prepared today: { cantrips, slots, unprepared }, with spells from the sheet.
 * slots has one entry per rank 1 slot (null when empty). Before anything is chosen,
 * the first cantrips and spells the character knows are prepared, which is what a
 * pregenerated hero's sheet prepares. Spells the character no longer knows are dropped.
 * null for characters who don't prepare from known spells.
 */
export function preparedSpells(character, prepared) {
  if (!preparesFromKnown(character)) return null;
  const { cantrips: knownCantrips, spells: known, prepares } = character.spellcasting;
  const byKey = (list) => new Map(list.map((s) => [spellKey(s), s]));
  const cantripsByKey = byKey(knownCantrips);
  const spellsByKey = byKey(known);

  const cantrips = prepared
    ? [...new Set(prepared.cantrips ?? [])].map((k) => cantripsByKey.get(k)).filter(Boolean).slice(0, prepares.cantrips)
    : knownCantrips.slice(0, prepares.cantrips);
  // Each slot holds a spell of its rank or lower; before anything's chosen, fill each
  // with the first known spell of exactly its rank.
  const ranks = slotRanks(character);
  const fits = (s, rank) => s && (s.rank ?? 1) <= rank;
  const defaults = new Map();
  const slots = ranks.map((rank, i) => {
    if (prepared) {
      const s = spellsByKey.get(prepared.slots?.[i]) ?? null;
      return fits(s, rank) ? s : null;
    }
    const pool = known.filter((s) => (s.rank ?? 1) === rank);
    const n = defaults.get(rank) ?? 0;
    defaults.set(rank, n + 1);
    return pool[n] ?? null;
  });
  const inUse = new Set([...cantrips, ...slots].filter(Boolean).map(spellKey));
  return {
    cantrips,
    slots,
    unprepared: {
      cantrips: knownCantrips.filter((s) => !inUse.has(spellKey(s))),
      spells: known.filter((s) => !inUse.has(spellKey(s))),
    },
  };
}

/** The stored form of what preparedSpells returns. */
export const preparedValue = ({ cantrips, slots }) => ({ cantrips: cantrips.map(spellKey), slots: slots.map((s) => (s ? spellKey(s) : null)) });

/** Problems with a prepared list for this character, as messages (empty if fine). */
export function preparedProblems(character, prepared) {
  if (!preparesFromKnown(character)) return [`${character?.name ?? 'This character'} doesn't prepare spells from a spellbook or familiar.`];
  if (!prepared || typeof prepared !== 'object' || !Array.isArray(prepared.cantrips) || !Array.isArray(prepared.slots)) {
    return ['Prepared spells must be { cantrips, slots }.'];
  }
  const { cantrips: knownCantrips, spells: known, prepares } = character.spellcasting;
  const cantripKeys = new Set(knownCantrips.map(spellKey));
  const spellKeys = new Set(known.map(spellKey));
  const errors = [];
  if (prepared.cantrips.length > prepares.cantrips) errors.push(`You can prepare at most ${prepares.cantrips} cantrips.`);
  if (new Set(prepared.cantrips).size !== prepared.cantrips.length) errors.push('A cantrip can only be prepared once.');
  if (prepared.cantrips.some((k) => !cantripKeys.has(k))) errors.push(`You can only prepare cantrips ${character.name} knows.`);
  const ranks = slotRanks(character);
  const rankOf = new Map(known.map((s) => [spellKey(s), s.rank ?? 1]));
  if (prepared.slots.length !== ranks.length) errors.push(`${character.name} has ${ranks.length} spell slots to fill.`);
  if (prepared.slots.some((k) => k !== null && !spellKeys.has(k))) errors.push(`You can only prepare spells ${character.name} knows.`);
  if (prepared.slots.some((k, i) => k !== null && rankOf.get(k) > ranks[i])) errors.push('A slot can only hold a spell of its rank or lower.');
  return errors;
}
