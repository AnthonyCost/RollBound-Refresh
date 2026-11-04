// Running an encounter (Player Core, "Encounter Mode"): everyone rolls initiative (usually
// Perception), acts in that order, and when everyone has acted a new round begins. Pure
// functions over the encounter's live state, which the GM's tracker saves. The combatants
// list is the turn order: sorted by initiative at the start, then the GM can move anyone
// (a creature that Delays, say) without changing the numbers they rolled.
//
//   { round, current: combatant key or null, combatants: [{ key, kind: 'creature' | 'pc',
//     name, perception, initiative, hp, maxHp, ac, defeated, characterId?, creatureId? }] }

import { rollDie } from './combat.js';
import { maxHp } from './character.js';
import { endOfTurn } from './conditions.js';
import { setItemDamage, shieldState, startingInventory } from './inventory.js';

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

/** Moves a combatant to a new place in the turn order (index in the list after the move). */
export function moveCombatant(state, key, toIndex) {
  const from = state.combatants.findIndex((c) => c.key === key);
  if (from < 0) return state;
  const list = state.combatants.filter((c) => c.key !== key);
  const to = Math.max(0, Math.min(list.length, toIndex));
  list.splice(to, 0, state.combatants[from]);
  return { ...state, combatants: list };
}

/**
 * Puts one combatant where their initiative now belongs (after its value was edited),
 * leaving everyone else where they are: before the first with a lower initiative.
 */
export function placeByInitiative(state, key) {
  const c = state.combatants.find((x) => x.key === key);
  if (!c) return state;
  const rest = state.combatants.filter((x) => x.key !== key);
  const at = rest.findIndex((x) => (x.initiative ?? -Infinity) < (c.initiative ?? -Infinity));
  return moveCombatant(state, key, at < 0 ? rest.length : at);
}

/**
 * The GM's Next turn: whoever was acting does their end-of-turn upkeep (frightened drops by 1;
 * see endOfTurn), then the next one is up.
 */
export function endTurn(state) {
  const combatants = state.combatants.map((c) => (c.key === state.current && c.conditions?.length ? { ...c, conditions: endOfTurn(c.conditions) } : c));
  return advanceTurn({ ...state, combatants });
}

/** Whose turn it is, or null. */
export const currentCombatant = (state) => state.combatants.find((c) => c.key === state.current) ?? null;

/**
 * The next (step 1) or previous (step -1) turn, skipping the defeated. Going past the last
 * starts a new round; going back before the first returns to the previous one (not below 1).
 */
export function advanceTurn(state, step = 1) {
  const order = state.combatants;
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

export const COMBAT_ACTIONS = ['damage', 'heal', 'block', 'repair'];

/**
 * What the GM's tracker does to a character: damage or heal their Hit Points, Shield Block
 * (the shield's Hardness stops part of the hit, and the shield and the character each take
 * the rest; a broken shield can't block), or repair their shield. hp is their current Hit
 * Points; inventory null means the builder's starting gear. Returns { hp, inventory, shield,
 * stopped, through } or { error }.
 */
export function applyCombatAction({ character, hp, inventory }, action, amount, data) {
  const n = Math.max(0, Math.floor(Number(amount) || 0));
  const inv = inventory ?? startingInventory(character, data);
  const shield = shieldState(inv, data);
  const shieldDamage = shield ? shield.max - shield.current : 0;
  let next = { hp, inventory: inv, stopped: 0, through: 0 };
  if (action === 'damage') next.hp = Math.max(0, hp - n);
  else if (action === 'heal') next.hp = Math.min(maxHp(character), hp + n);
  else if (action === 'block') {
    if (!shield) return { error: 'They have no shield to block with.' };
    if (shield.broken) return { error: `${shield.name} is broken and can't block until it's repaired.` };
    const through = Math.max(0, n - shield.hardness);
    next = { hp: Math.max(0, hp - through), inventory: setItemDamage(inv, shield.key, Math.min(shield.max, shieldDamage + through)), stopped: n - through, through };
  } else if (action === 'repair') {
    if (!shield) return { error: 'They have no shield to repair.' };
    if (shield.destroyed) return { error: `${shield.name} is destroyed and can't be repaired.` };
    next.inventory = setItemDamage(inv, shield.key, Math.max(0, shieldDamage - n));
  } else return { error: 'Unknown action.' };
  return { ...next, shield: shieldState(next.inventory, data) };
}
