// What the character sheet's details drawer says about each number: the Pathfinder
// rules behind it (Player Core, in our own words). The numbers themselves come from
// @rollbound/rules; this file is only the explanation.
//
// A skill's `uses` are [name, cost, trainedOnly]. Cost is 1, 2 or 3 actions, or a word
// for activities that take longer: 'exploration', 'downtime' or 'varies'.

export const DEGREES =
  'Roll a d20 and add the modifier, then compare the total to the DC. Meet it to succeed; beat it by 10 or more for a critical success. Miss it to fail, or by 10 or more to critically fail. A natural 20 moves the result up one step and a natural 1 moves it down one.';

export const ATTRIBUTES = {
  str: {
    icon: 'statStr',
    rules: [
      'Strength measures physical power. You add it to Athletics checks, melee attack rolls, and damage with melee and thrown weapons.',
      'It also sets how much you can carry. You become encumbered when you carry more than 5 plus your Strength modifier in Bulk, and you can carry at most 10 plus your Strength modifier.',
    ],
  },
  dex: {
    icon: 'statDex',
    rules: [
      "Dexterity measures agility, balance and reflexes. It adds to your AC (up to your armor's Dex cap), Reflex saves, and ranged attack rolls.",
      'Finesse weapons let you use it for melee attack rolls instead of Strength.',
    ],
  },
  con: {
    icon: 'statCon',
    rules: ['Constitution measures health and stamina. It adds to your Hit Points at every level and to your Fortitude saves.'],
  },
  int: {
    icon: 'statInt',
    rules: [
      'Intelligence measures reasoning and memory.',
      'At 1st level, each point of a positive modifier gives you one more trained skill and one more language.',
    ],
  },
  wis: {
    icon: 'statWis',
    rules: ['Wisdom measures awareness and intuition. It adds to Perception and to your Will saves.'],
  },
  cha: {
    icon: 'statCha',
    rules: ['Charisma measures force of personality, persuasiveness and presence.'],
  },
};

export const KEY_ATTRIBUTE =
  'This is your key attribute. Your class chose it, and it adds to your class DC (and, for most spellcasters, to your spell attacks and spell DC).';

export const BASIC_SAVE =
  'Many damaging effects call for a basic save: no damage on a critical success, half on a success, full damage on a failure and double on a critical failure.';

export const DEFENSES = {
  ac: {
    kind: 'Defense',
    name: 'Armor Class',
    icon: 'shield',
    rules: [
      'Armor Class is the DC for attacks against you. An attack hits if its roll meets or beats your AC, and it critically hits if it beats your AC by 10 or more.',
      "It's 10, plus your Dexterity modifier up to your armor's Dex cap, plus your proficiency bonus with that armor, plus the armor's item bonus. Raising a shield adds its circumstance bonus until the start of your next turn.",
    ],
  },
  fortitude: {
    kind: 'Saving throw',
    name: 'Fortitude',
    icon: 'statFortitude',
    rules: ['Fortitude saves resist effects that attack your body, such as poison, disease and exhaustion. They use your Constitution modifier.', DEGREES, BASIC_SAVE],
  },
  reflex: {
    kind: 'Saving throw',
    name: 'Reflex',
    icon: 'statReflex',
    rules: ['Reflex saves get you out of the way of things like a fireball, a collapsing ceiling or a springing trap. They use your Dexterity modifier.', DEGREES, BASIC_SAVE],
  },
  will: {
    kind: 'Saving throw',
    name: 'Will',
    icon: 'statWill',
    rules: ['Will saves resist effects aimed at your mind, such as fear, charms and illusions. They use your Wisdom modifier.', DEGREES, BASIC_SAVE],
  },
  perception: {
    kind: 'Perception',
    name: 'Perception',
    icon: 'statPerception',
    rules: [
      'Perception is how well you notice things. You usually roll it for initiative, and you use it to Seek hidden creatures and objects and to Sense Motive.',
      'Your Perception DC is 10 plus this modifier. Others roll against it when they try to Hide, Sneak or lie to you.',
    ],
  },
  speed: {
    kind: 'Movement',
    name: 'Speed',
    icon: 'statSpeed',
    rules: [
      'Your Speed is how many feet you move with one Stride action. Your ancestry sets it.',
      'Some armor lowers it. Meeting the armor’s Strength entry reduces that penalty by 5 feet.',
    ],
  },
  shield: {
    kind: 'Shield',
    icon: 'shield',
    rules: [
      'Raise a Shield (one action) adds its circumstance bonus to your AC until the start of your next turn.',
      'With the Shield Block reaction, a raised shield takes a hit for you: the damage is reduced by its Hardness, and you and the shield each take whatever is left.',
      'At its Broken Threshold (half its Hit Points) it’s broken and gives no bonus until it’s repaired. At 0 Hit Points it’s destroyed.',
    ],
  },
  classDc: {
    kind: 'Class DC',
    name: 'Class DC',
    icon: 'statClassDc',
    rules: [
      'Your class DC is what others roll against when you use your class’s abilities, such as a runesmith’s runes or a kineticist’s impulses.',
      "It's 10, plus your key attribute modifier, plus your class DC proficiency bonus.",
    ],
  },
  spellAttack: {
    kind: 'Spellcasting',
    name: 'Spell attack',
    icon: 'statSpellAttack',
    rules: [
      'Roll this for spells that make an attack, against the target’s AC. Spell attacks count toward your multiple attack penalty like any other attack.',
      DEGREES,
    ],
  },
  spellDc: {
    kind: 'Spellcasting',
    name: 'Spell DC',
    icon: 'statSpellDc',
    rules: [
      'When your spell calls for a saving throw, the target rolls against your spell DC.',
      "It's 10, plus your spellcasting attribute modifier, plus your spellcasting proficiency bonus.",
    ],
  },
};

const RECALL = 'Recall Knowledge';

export const SKILLS = {
  acrobatics: {
    icon: 'skillAcrobatics',
    rules: ['Acrobatics covers balance and agility: crossing narrow or slippery ground, tumbling past foes, and later flying and squeezing through tight gaps.'],
    uses: [['Balance', 1], ['Tumble Through', 1], ['Maneuver in Flight', 1, true], ['Squeeze', 'exploration', true]],
  },
  arcana: {
    icon: 'skillArcana',
    rules: ['Arcana is knowledge of arcane magic and theory. Recall Knowledge with Arcana covers beasts, constructs, dragons and elementals.'],
    uses: [[RECALL, 1], ['Borrow an Arcane Spell', 'exploration', true], ['Decipher Writing', 'exploration', true], ['Identify Magic', 'exploration', true], ['Learn a Spell', 'exploration', true]],
  },
  athletics: {
    icon: 'skillAthletics',
    rules: [
      'Athletics covers physical feats: climbing, swimming, jumping, and grabbing or shoving a foe.',
      'Grapple, Reposition and Shove target a creature’s Fortitude DC; Trip and Disarm target its Reflex DC. All of them have the attack trait, so the multiple attack penalty applies.',
    ],
    uses: [['Climb', 1], ['Force Open', 1], ['Grapple', 1], ['High Jump', 2], ['Long Jump', 2], ['Reposition', 1], ['Shove', 1], ['Swim', 1], ['Trip', 1], ['Disarm', 1, true]],
  },
  crafting: {
    icon: 'skillCrafting',
    rules: ['Crafting is making and mending things. Recall Knowledge with Crafting covers constructs and how items and alchemy work.'],
    uses: [[RECALL, 1], ['Repair', 'exploration'], ['Craft', 'downtime', true], ['Earn Income', 'downtime', true], ['Identify Alchemy', 'exploration', true]],
  },
  deception: {
    icon: 'skillDeception',
    rules: ['Deception is lying, disguises and misdirection. Most uses are rolled against the target’s Perception DC.'],
    uses: [['Create a Diversion', 1], ['Impersonate', 'exploration'], ['Lie', 'varies'], ['Feint', 1, true]],
  },
  diplomacy: {
    icon: 'skillDiplomacy',
    rules: ['Diplomacy is persuasion and etiquette: making a good impression, asking for help and finding things out by talking to people.'],
    uses: [['Gather Information', 'exploration'], ['Make an Impression', 'exploration'], ['Request', 1]],
  },
  intimidation: {
    icon: 'skillIntimidation',
    rules: ['Intimidation bends others to your will with threats. Demoralize is rolled against the target’s Will DC and can leave it frightened.'],
    uses: [['Coerce', 'exploration'], ['Demoralize', 1]],
  },
  medicine: {
    icon: 'skillMedicine',
    rules: ['Medicine is first aid and healing. Treat Wounds, once you’re trained, is how most parties recover Hit Points between fights.'],
    uses: [[RECALL, 1], ['Administer First Aid', 2], ['Treat Poison', 1, true], ['Treat Wounds', 'exploration', true], ['Treat Disease', 'downtime', true]],
  },
  nature: {
    icon: 'skillNature',
    rules: ['Nature is knowledge of the natural world: animals, plants, terrain and weather. Recall Knowledge with Nature covers animals, beasts, elementals, fey, fungi and plants.'],
    uses: [['Command an Animal', 1], [RECALL, 1], ['Identify Magic', 'exploration', true], ['Learn a Spell', 'exploration', true]],
  },
  occultism: {
    icon: 'skillOccultism',
    rules: ['Occultism is knowledge of the strange and esoteric. Recall Knowledge with Occultism covers aberrations, astral and ethereal creatures, dreams, oozes and spirits.'],
    uses: [[RECALL, 1], ['Decipher Writing', 'exploration', true], ['Identify Magic', 'exploration', true], ['Learn a Spell', 'exploration', true]],
  },
  performance: {
    icon: 'skillPerformance',
    rules: ['Performance is acting, music, dance and oratory: anything done to impress a crowd.'],
    uses: [['Perform', 1], ['Earn Income', 'downtime', true]],
  },
  religion: {
    icon: 'skillReligion',
    rules: ['Religion is knowledge of the gods and the divine. Recall Knowledge with Religion covers celestials, fiends, monitors and undead.'],
    uses: [[RECALL, 1], ['Decipher Writing', 'exploration', true], ['Identify Magic', 'exploration', true], ['Learn a Spell', 'exploration', true]],
  },
  society: {
    icon: 'skillSociety',
    rules: ['Society is knowledge of people and civilization: history, law, customs and languages. Recall Knowledge with Society covers humanoids and giants.'],
    uses: [[RECALL, 1], ['Subsist', 'downtime'], ['Create Forgery', 'downtime', true], ['Decipher Writing', 'exploration', true]],
  },
  stealth: {
    icon: 'skillStealth',
    rules: [
      'Stealth keeps you unnoticed: hiding, sneaking past guards, and staying hidden while you travel with Avoid Notice. You roll against observers’ Perception DCs.',
      'Noisy armor applies its check penalty to Stealth even if you meet its Strength entry.',
    ],
    uses: [['Conceal an Object', 1], ['Hide', 1], ['Sneak', 1], ['Avoid Notice', 'exploration']],
  },
  survival: {
    icon: 'skillSurvival',
    rules: ['Survival is living off the land: finding your way, foraging, and following or hiding tracks.'],
    uses: [['Sense Direction', 'exploration'], ['Subsist', 'downtime'], ['Cover Tracks', 'exploration', true], ['Track', 'exploration', true]],
  },
  thievery: {
    icon: 'skillThievery',
    rules: ['Thievery is sleight of hand: palming and stealing objects, disabling traps and picking locks.'],
    uses: [['Palm an Object', 1], ['Steal', 1], ['Disable a Device', 2, true], ['Pick a Lock', 2, true]],
  },
};

export const LORE = {
  icon: 'skillLore',
  rules: ['A Lore is narrow knowledge of one subject, such as a city, a profession or a creature. It uses Intelligence unless something says otherwise.'],
  uses: [[RECALL, 1], ['Earn Income', 'downtime', true]],
};

export const UNTRAINED_NOTE = 'You’re untrained, so you add no proficiency bonus, and you can’t use the trained-only actions.';

export const STRIKE = {
  melee: 'Make a melee attack roll against the target’s AC. On a success you deal the weapon’s damage; on a critical success you deal double damage.',
  ranged:
    'Make a ranged attack roll against the target’s AC. On a success you deal the weapon’s damage; on a critical success you deal double damage. Each range increment past the first gives a −2 penalty.',
  map: 'Every attack after your first in a turn takes the multiple attack penalty: −5 on the second and −10 after that (−4 and −8 with an agile weapon).',
};

/** Weapon traits worth explaining on the sheet, by the trait's first word. */
export const WEAPON_TRAITS = {
  agile: 'Your multiple attack penalty with it is −4 and −8 instead of −5 and −10.',
  backstabber: 'Deals 1 extra precision damage to an off-guard target.',
  deadly: 'On a critical hit, add one extra weapon damage die of the listed size.',
  disarm: 'You can use it to Disarm with Athletics.',
  fatal: 'On a critical hit, the weapon’s damage die becomes the listed size, and you add one extra die of that size.',
  finesse: 'You can use Dexterity instead of Strength on attack rolls with it.',
  forceful: 'Each attack with it after the first in a turn deals more damage: +1 per damage die on the second, +2 per die after that.',
  free: 'You can use it while that hand also holds something else.',
  grapple: 'You can use it to Grapple with Athletics.',
  nonlethal: 'Attacks with it knock foes out instead of killing them.',
  parry: 'Spend an action to gain a +1 circumstance bonus to AC until the start of your next turn.',
  propulsive: 'Adds half your Strength modifier to damage (all of it if negative).',
  reach: 'You can attack creatures up to 10 feet away.',
  shove: 'You can use it to Shove with Athletics.',
  sweep: 'Gain +1 to attack if you already attacked a different creature this turn.',
  thrown: 'You can throw it as a ranged attack with the listed range increment, adding your Strength modifier to damage.',
  trip: 'You can use it to Trip with Athletics.',
  'two-hand': 'Wielded in two hands, its damage die becomes the listed size.',
  versatile: 'You can choose to deal the listed damage type instead of its usual type (B bludgeoning, P piercing, S slashing).',
  volley: 'Attacks against creatures within the listed distance take a −2 penalty.',
};

export function traitRule(trait) {
  const key = String(trait).toLowerCase().trim();
  // "two-hand d10", "versatile P", "thrown 20 ft": drop the size or type after the name.
  const name = key.replace(/\s+\S+(\s+ft\.?)?$/, '');
  const slug = key.replace(/-(d\d+|[a-z]|\d+)$/, ''); // the data's slugs: "two-hand-d12", "versatile-p", "thrown-10"
  return WEAPON_TRAITS[key] ?? WEAPON_TRAITS[name] ?? WEAPON_TRAITS[slug] ?? WEAPON_TRAITS[key.split(/[\s-]/)[0]] ?? null;
}

/** A trait slug as people write it: "versatile-p" -> "Versatile P", "two-hand-d12" -> "Two-hand d12", "thrown-10" -> "Thrown 10 ft". */
export function traitLabel(trait) {
  const t = String(trait)
    .replace(/-(d\d+)$/, ' $1')
    .replace(/-([a-z])$/, (_, l) => ` ${l.toUpperCase()}`)
    .replace(/-(\d+)$/, ' $1 ft');
  return t[0].toUpperCase() + t.slice(1);
}
