// Sample level 1 character used for demos, seeding and tests.
export const mira = {
  name: 'Mira Ashvale',
  level: 1,
  ancestry: { name: 'Human', hp: 8, speed: 25 },
  heritage: 'Versatile Human',
  background: 'Guard',
  className: 'Fighter',
  classHp: 10,
  abilities: { str: 4, dex: 2, con: 2, int: 0, wis: 1, cha: 0 },
  proficiencies: {
    perception: 'expert',
    fortitude: 'expert',
    reflex: 'expert',
    will: 'trained',
    armor: { unarmored: 'trained', light: 'trained', medium: 'trained', heavy: 'trained' },
    weapons: { unarmed: 'expert', simple: 'expert', martial: 'expert', advanced: 'trained' },
  },
  armor: { name: 'Chain mail', category: 'medium', acBonus: 4, dexCap: 1 },
  weapons: [
    { name: 'Longsword', category: 'martial', die: 8, damageType: 'slashing', traits: ['versatile P'] },
  ],
  heroPoints: 1,
};
