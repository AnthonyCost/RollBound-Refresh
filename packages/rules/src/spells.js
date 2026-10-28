// Prepared spells for casters who prepare from the spells they know: a wizard, magus or
// necromancer from their spellbook (or dirge), a witch from her familiar. Each day they
// pick spellcasting.prepares.cantrips of their cantrips, and fill each of their
// prepares.spells rank 1 slots with one of their rank 1 spells (the same spell can fill
// more than one slot). It's kept apart from the sheet the builder makes, like the
// inventory. Shape: { cantrips: [spellKey], slots: [spellKey or null] }, where a
// spell's key is its id (or slug, on sheets from before spells had ids).

/** A spell's key in a prepared list. */
export const spellKey = (s) => s.id ?? s.slug;

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
  const slots = Array.from({ length: prepares.spells }, (_, i) =>
    prepared ? spellsByKey.get(prepared.slots?.[i]) ?? null : known[i] ?? null,
  );
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
  if (prepared.slots.length !== prepares.spells) errors.push(`${character.name} has ${prepares.spells} rank 1 slots to fill.`);
  if (prepared.slots.some((k) => k !== null && !spellKeys.has(k))) errors.push(`You can only prepare rank 1 spells ${character.name} knows.`);
  return errors;
}
