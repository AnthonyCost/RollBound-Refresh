export const ABILITY_SHORT = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

export const cap = (s) => s.replace(/(^|[\s-])(\w)/g, (_m, sep, c) => `${sep === '-' ? ' ' : sep}${c.toUpperCase()}`);

export const sourceTag = (source) => ({ 'Player Core': 'PC', 'Player Core 2': 'PC2' })[source] ?? source;

export const SIZE = { tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large' };

export const abilityList = (list) => list.map((a) => ABILITY_SHORT[a]).join(' or ');

export const boostSlotLabel = (slot) => (slot.length === 6 ? 'free' : abilityList(slot));
