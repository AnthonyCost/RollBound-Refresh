// Running an encounter (Player Core, "Encounter Mode"): everyone rolls initiative (usually
// Perception), acts in that order, and when everyone has acted a new round begins. Pure
// functions over the encounter's live state, which the GM's tracker saves:
//
//   { round, current: combatant key or null, combatants: [{ key, kind: 'creature' | 'pc',
//     name, perception, initiative, hp, maxHp, ac, defeated, characterId?, creatureId? }] }

import { rollDie } from './combat.js';

/** An initiative roll: d20 + Perception. */
export const rollInitiative = (perception, rng = Math.random) => rollDie(20, rng) + perception;

/**
 * The turn order: highest initiative first. On a tie, creatures act before characters
 * (Player Core's tie rule for foes and PCs), then the higher Perception, then by name.
 */
export function initiativeOrder(combatants) {
  return [...combatants].sort(
    (a, b) =>
      (b.initiative ?? -Infinity) - (a.initiative ?? -Infinity) ||
      (a.kind === b.kind ? 0 : a.kind === 'creature' ? -1 : 1) ||
      (b.perception ?? 0) - (a.perception ?? 0) ||
      a.name.localeCompare(b.name),
  );
}

/** A new encounter: everyone rolls initiative, round 1, the first in the order to act. */
export function startEncounter(combatants, rng = Math.random) {
  const rolled = initiativeOrder(combatants.map((c) => ({ ...c, initiative: rollInitiative(c.perception ?? 0, rng), defeated: false })));
  return { round: 1, current: rolled[0]?.key ?? null, combatants: rolled };
}

/** Whose turn it is, or null. */
export const currentCombatant = (state) => state.combatants.find((c) => c.key === state.current) ?? null;

/**
 * The next (step 1) or previous (step -1) turn, skipping the defeated. Going past the last
 * starts a new round; going back before the first returns to the previous one (not below 1).
 */
export function advanceTurn(state, step = 1) {
  const order = initiativeOrder(state.combatants);
  if (!order.some((c) => !c.defeated)) return { ...state, current: null };
  // From where the current combatant sits (even if just defeated); from before the first if nobody's up.
  const from = order.findIndex((c) => c.key === state.current);
  for (let i = 1; i <= order.length; i++) {
    const raw = from + step * i;
    const c = order[((raw % order.length) + order.length) % order.length];
    if (c.defeated) continue;
    // Wrapping past the end (or back past the start) changes the round.
    const round = raw >= order.length ? state.round + 1 : raw < 0 ? Math.max(1, state.round - 1) : state.round;
    return { ...state, round, current: c.key };
  }
  return state;
}
