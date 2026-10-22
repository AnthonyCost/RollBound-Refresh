// A small, explainable subset of PF2e conditions. Each condition is stored as
// { id, value? }. Penalties of the same type don't stack: only the worst applies.

export const CONDITIONS = {
  frightened: {
    name: 'Frightened',
    valued: true,
    summary: (v) => `−${v} status penalty to all your checks and DCs. Drops by 1 at the end of your turn.`,
  },
  sickened: {
    name: 'Sickened',
    valued: true,
    summary: (v) => `−${v} status penalty to all your checks and DCs. Spend an action to retch and try to recover.`,
  },
  clumsy: {
    name: 'Clumsy',
    valued: true,
    summary: (v) => `−${v} status penalty to Dexterity-based checks and DCs, including AC and Reflex.`,
  },
  enfeebled: {
    name: 'Enfeebled',
    valued: true,
    summary: (v) => `−${v} status penalty to Strength-based rolls and DCs, including melee attacks and damage.`,
  },
  'off-guard': {
    name: 'Off-Guard',
    valued: false,
    summary: () => '−2 circumstance penalty to AC.',
  },
};

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
 * The status penalty that applies to a check or DC.
 * @param {Array} conditions
 * @param {'str'|'dex'|'con'|'int'|'wis'|'cha'|null} ability the ability the check is based on
 * @returns {{ value: number, source: string|null }} value is 0 or negative
 */
export function statusPenalty(conditions, ability = null) {
  const candidates = [
    ['frightened', valueOf(conditions, 'frightened')],
    ['sickened', valueOf(conditions, 'sickened')],
  ];
  if (ability === 'dex') candidates.push(['clumsy', valueOf(conditions, 'clumsy')]);
  if (ability === 'str') candidates.push(['enfeebled', valueOf(conditions, 'enfeebled')]);

  let worst = { value: 0, source: null };
  for (const [id, v] of candidates) {
    if (v > -worst.value) worst = { value: -v, source: describeCondition({ id, value: v }).name };
  }
  return worst;
}

export function circumstancePenaltyToAC(conditions) {
  return conditions.some((c) => c.id === 'off-guard') ? -2 : 0;
}

/** End-of-turn upkeep: frightened ticks down by 1 and is removed at 0. */
export function endOfTurn(conditions) {
  return conditions
    .map((c) => (c.id === 'frightened' ? { ...c, value: c.value - 1 } : c))
    .filter((c) => !(CONDITIONS[c.id]?.valued && c.value <= 0));
}
