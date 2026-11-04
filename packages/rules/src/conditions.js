// The conditions from Player Core that a creature can have in a fight (not attitudes, which
// are about how someone feels toward you, or broken, which is for items). Each condition is
// stored as { id, value? }. The ones with a fixed number change the sheet's math below
// (status penalties of the same type don't stack: only the worst applies); the rest are
// there so the table knows what they do. Alphabetical, as the tracker lists them.

export const CONDITIONS = {
  blinded: { name: 'Blinded', valued: false, summary: () => "You can't see: normal terrain is difficult terrain, you can't detect anything by sight, and you're immune to visual effects. Overrides dazzled." },
  clumsy: { name: 'Clumsy', valued: true, summary: (v) => `−${v} status penalty to Dexterity-based checks and DCs, including AC and Reflex.` },
  concealed: { name: 'Concealed', valued: false, summary: () => "Hard to see: anyone targeting you must succeed at a DC 5 flat check first. It doesn't hide where you are." },
  confused: { name: 'Confused', valued: false, summary: () => "You're off-guard, treat no one as an ally, can't Delay, Ready or use reactions, and Strike random targets. Taking damage lets you try a DC 11 flat check to recover." },
  controlled: { name: 'Controlled', valued: false, summary: () => 'Someone else decides what you do with your actions.' },
  dazzled: { name: 'Dazzled', valued: false, summary: () => "Your eyes are overwhelmed: everything is concealed to you, so targeting anything by sight takes a DC 5 flat check." },
  deafened: { name: 'Deafened', valued: false, summary: () => "You can't hear: you critically fail checks that need hearing, take −2 to Perception for initiative and checks involving sound, and need a DC 5 flat check for auditory actions." },
  doomed: { name: 'Doomed', valued: true, summary: (v) => `Death is close: you die at dying ${Math.max(1, 4 - v)} instead of 4. Drops by 1 after a full night's rest.` },
  drained: { name: 'Drained', valued: true, summary: (v) => `−${v} status penalty to Constitution-based checks such as Fortitude saves, and you lose ${v} × your level in Hit Points and maximum HP. Drops by 1 after a full night's rest.` },
  dying: { name: 'Dying', valued: true, summary: (v) => `Unconscious and near death: each turn, a recovery check (flat DC ${10 + v}). At dying 4 (less your doomed value) you die.` },
  encumbered: { name: 'Encumbered', valued: false, summary: () => "Carrying too much: you're clumsy 1 and take a −10-foot penalty to all your Speeds." },
  enfeebled: { name: 'Enfeebled', valued: true, summary: (v) => `−${v} status penalty to Strength-based rolls and DCs, including melee attacks and damage.` },
  fascinated: { name: 'Fascinated', valued: false, summary: () => "−2 status penalty to Perception and skill checks, and you can't use concentrate actions unrelated to what fascinated you. Ends if anyone is hostile to you or your allies." },
  fatigued: { name: 'Fatigued', valued: false, summary: () => "−1 status penalty to AC and saving throws, and no exploration activities while you travel. Ends after a full night's rest." },
  fleeing: { name: 'Fleeing', valued: false, summary: () => "You must spend your actions getting away from the source as fast as you can, and can't Delay or Ready." },
  frightened: { name: 'Frightened', valued: true, summary: (v) => `−${v} status penalty to all your checks and DCs. Drops by 1 at the end of your turn.` },
  grabbed: { name: 'Grabbed', valued: false, summary: () => "You're off-guard and immobilized, and manipulate actions need a DC 5 flat check or they're lost." },
  hidden: { name: 'Hidden', valued: false, summary: () => "Others know which space you're in but can't see you: targeting you takes a DC 11 flat check." },
  immobilized: { name: 'Immobilized', valued: false, summary: () => "You can't use any action with the move trait." },
  invisible: { name: 'Invisible', valued: false, summary: () => "No one can see you: you're undetected to everyone (hidden to those who know your space), and immune to visual effects." },
  'off-guard': { name: 'Off-Guard', valued: false, summary: () => '−2 circumstance penalty to AC.' },
  paralyzed: { name: 'Paralyzed', valued: false, summary: () => "You're frozen in place: off-guard, and you can't act except to Recall Knowledge and other purely mental actions." },
  petrified: { name: 'Petrified', valued: false, summary: () => "You've been turned to stone: you can't act or sense anything, and you're an object (AC 9, Hardness 8)." },
  prone: { name: 'Prone', valued: false, summary: () => "You're on the ground: off-guard, −2 circumstance penalty to attack rolls, and the only move actions you can use are Crawl and Stand." },
  quickened: { name: 'Quickened', valued: false, summary: () => 'You gain 1 extra action at the start of each turn, used only as the effect that quickened you allows.' },
  restrained: { name: 'Restrained', valued: false, summary: () => "You're tied up: off-guard and immobilized, and the only attack or manipulate actions you can use are to Escape or Force Open." },
  sickened: { name: 'Sickened', valued: true, summary: (v) => `−${v} status penalty to all your checks and DCs. Spend an action to retch and try to recover.` },
  slowed: { name: 'Slowed', valued: true, summary: (v) => `You lose ${v} action${v === 1 ? '' : 's'} at the start of each turn.` },
  stunned: { name: 'Stunned', valued: true, summary: (v) => `You lose ${v} action${v === 1 ? '' : 's'} as you regain them, and stunned drops by as many. Overrides slowed.` },
  stupefied: { name: 'Stupefied', valued: true, summary: (v) => `−${v} status penalty to Intelligence-, Wisdom- and Charisma-based checks and DCs, including Will saves, Perception and spells; casting a spell takes a DC ${5 + v} flat check.` },
  unconscious: { name: 'Unconscious', valued: false, summary: () => "Asleep or knocked out: blinded and off-guard, −4 status penalty to AC, Perception and Reflex saves, and you can't act." },
  undetected: { name: 'Undetected', valued: false, summary: () => "No one knows where you are: they have to guess your space and pass a DC 11 flat check to target you." },
  wounded: { name: 'Wounded', valued: true, summary: (v) => `Each time you gain dying, it's ${v} higher. Ends when you're restored to full HP and rest 10 minutes, or by Treat Wounds.` },
};

/** Conditions that make you off-guard as well as their own effects. */
const OFF_GUARD_FROM = ['off-guard', 'prone', 'grabbed', 'restrained', 'paralyzed', 'unconscious', 'confused'];

export function describeCondition(condition) {
  const def = CONDITIONS[condition.id];
  if (!def) throw new Error(`Unknown condition: ${condition.id}`);
  const name = def.valued ? `${def.name} ${condition.value}` : def.name;
  return { name, summary: def.summary(condition.value) };
}

function valueOf(conditions, id) {
  const c = conditions.find((x) => x.id === id);
  return c ? (c.value ?? 1) : 0;
}

/**
 * The status penalty that applies to a check or DC: the worst one, as they don't stack.
 * @param {Array} conditions
 * @param {'str'|'dex'|'con'|'int'|'wis'|'cha'|null} ability the attribute the check is based on
 * @param {'ac'|'fortitude'|'reflex'|'will'|'perception'|null} kind which number it is, for the
 *   conditions that only touch some (fatigued: AC and saves; unconscious: AC, Perception, Reflex)
 * @returns {{ value: number, source: string|null }} value is 0 or negative
 */
export function statusPenalty(conditions, ability = null, kind = null) {
  const has = (id) => conditions.some((c) => c.id === id);
  const candidates = [
    ['frightened', valueOf(conditions, 'frightened')],
    ['sickened', valueOf(conditions, 'sickened')],
  ];
  if (ability === 'dex') candidates.push(['clumsy', valueOf(conditions, 'clumsy')]);
  if (ability === 'str') candidates.push(['enfeebled', valueOf(conditions, 'enfeebled')]);
  if (ability === 'con') candidates.push(['drained', valueOf(conditions, 'drained')]);
  if (['int', 'wis', 'cha'].includes(ability)) candidates.push(['stupefied', valueOf(conditions, 'stupefied')]);
  if (has('fatigued') && ['ac', 'fortitude', 'reflex', 'will'].includes(kind)) candidates.push(['fatigued', 1]);
  if (has('unconscious') && ['ac', 'perception', 'reflex'].includes(kind)) candidates.push(['unconscious', 4]);

  let worst = { value: 0, source: null };
  for (const [id, v] of candidates) {
    if (v > -worst.value) worst = { value: -v, source: describeCondition({ id, value: v }).name };
  }
  return worst;
}

/** −2 to AC when off-guard, from the condition itself or one that includes it (prone, grabbed…). */
export function circumstancePenaltyToAC(conditions) {
  return conditions.some((c) => OFF_GUARD_FROM.includes(c.id)) ? -2 : 0;
}

/** Prone: −2 circumstance penalty to attack rolls. */
export const circumstancePenaltyToAttacks = (conditions) => (conditions.some((c) => c.id === 'prone') ? -2 : 0);

/** The highest value a valued condition goes to here (then the next tap clears it). */
export const MAX_CONDITION_VALUE = 4;

/**
 * Tapping a condition: adds it (at 1 if it has a value), raises a valued one by 1 up to
 * MAX_CONDITION_VALUE, and clears it after that (an unvalued one clears on the next tap).
 */
export function cycleCondition(conditions, id) {
  const def = CONDITIONS[id];
  if (!def) return conditions;
  const current = conditions.find((c) => c.id === id);
  if (!current) return [...conditions, def.valued ? { id, value: 1 } : { id }];
  if (!def.valued || current.value >= MAX_CONDITION_VALUE) return conditions.filter((c) => c.id !== id);
  return conditions.map((c) => (c.id === id ? { ...c, value: c.value + 1 } : c));
}

/** End-of-turn upkeep: frightened ticks down by 1 and is removed at 0. */
export function endOfTurn(conditions) {
  return conditions
    .map((c) => (c.id === 'frightened' ? { ...c, value: c.value - 1 } : c))
    .filter((c) => !(CONDITIONS[c.id]?.valued && c.value <= 0));
}
