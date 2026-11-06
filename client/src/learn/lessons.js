// The Learning the Game page: one tab per part of the game, each a few short lessons.
// Rules follow the Pathfinder Second Edition Remaster (Player Core, GM Core).
// A lesson has a title and paragraphs, and optionally:
//   list   short points          table { head, rows }   a small table
//   tip    { text, to, label }   where RollBound helps with it
//   more   a link to the full rules on Archives of Nethys
const AON = 'https://2e.aonprd.com';
const search = (q) => `${AON}/Search.aspx?q=${encodeURIComponent(q)}`;

export const TOPICS = [
  {
    slug: 'overview',
    label: 'Overview',
    icon: 'compass',
    blurb: 'What Pathfinder is, and the one roll nearly everything comes down to.',
    lessons: [
      {
        title: 'What is Pathfinder?',
        body: [
          'Pathfinder is a tabletop roleplaying game. Each player creates one hero and decides what they say and do. One person, the Game Master (GM), describes the world, plays every monster and stranger, and decides how the rules apply.',
          'There is no winning or losing. The group tells a story together, and the dice decide whether risky things work. A session usually runs three to four hours, and a campaign can last from a few sessions to a few years.',
        ],
      },
      {
        title: 'The core roll',
        body: [
          'When the outcome is uncertain, you roll a 20-sided die (a d20) and add a modifier. The total is compared with a Difficulty Class (DC). Meet or beat the DC and you succeed.',
          'Your modifier is usually an attribute modifier plus your proficiency bonus, and sometimes an item bonus.',
        ],
        list: ['Attack rolls use the target’s Armor Class (AC) as the DC.', 'Saving throws (Fortitude, Reflex, Will) resist harm aimed at you.', 'Skill checks cover everything else: climbing, lying, recalling lore.'],
        more: search('checks'),
      },
      {
        title: 'Four degrees of success',
        body: ['Most checks have four outcomes, not two. How far you beat or miss the DC matters.'],
        table: {
          head: ['Your total', 'Result'],
          rows: [
            ['DC + 10 or more', 'Critical success'],
            ['DC or more', 'Success'],
            ['Below the DC', 'Failure'],
            ['DC − 10 or less', 'Critical failure'],
          ],
        },
        list: ['A natural 20 on the die makes the result one step better.', 'A natural 1 makes it one step worse.'],
        more: search('degree of success'),
      },
      {
        title: 'Proficiency',
        body: ['Your proficiency rank in a skill, weapon, armor, save or spellcasting tradition sets your bonus. Trained or better adds your level, so heroes keep pace with the dangers they face.'],
        table: {
          head: ['Rank', 'Bonus'],
          rows: [
            ['Untrained', '+0'],
            ['Trained', 'Level + 2'],
            ['Expert', 'Level + 4'],
            ['Master', 'Level + 6'],
            ['Legendary', 'Level + 8'],
          ],
        },
      },
      {
        title: 'Bonuses and penalties',
        body: ['Bonuses and penalties come in three types: circumstance, status and item. Only the highest bonus and the worst penalty of each type count, so two status bonuses don’t stack. Untyped penalties, like the multiple attack penalty, all apply.'],
        more: search('bonuses and penalties'),
      },
      {
        title: 'Three modes of play',
        body: ['The game moves between three paces, and the GM says which one you are in.'],
        list: [
          'Encounters: fights and tense moments, played in rounds of about 6 seconds.',
          'Exploration: traveling, searching and talking, measured in minutes and hours.',
          'Downtime: days or weeks between adventures, for crafting, earning money and training.',
        ],
      },
      {
        title: 'What you need',
        body: ['A set of polyhedral dice (d4, d6, d8, d10, d12, d20), a character sheet, and the rules. The full rules are free to read on Archives of Nethys, Paizo’s official online reference.'],
        tip: { text: 'RollBound keeps your character sheet and does the math for you.', to: '/create', label: 'Create a character' },
      },
    ],
  },
  {
    slug: 'characters',
    label: 'Character Creation',
    icon: 'shield',
    blurb: 'Building a level 1 hero, one choice at a time.',
    lessons: [
      {
        title: 'Start with a concept',
        body: ['Before any numbers, picture your hero: a curious gnome who hoards spell scrolls, a disgraced knight looking for redemption. A concept makes every later choice easier. Talk with your group so your heroes have a reason to travel together.'],
      },
      {
        title: 'Ancestry and heritage',
        body: [
          'Your ancestry is your people: human, elf, dwarf, goblin, orc and more. It sets your starting Hit Points, size, Speed, languages and some attribute boosts. Your heritage narrows it further, like a cavern elf or a skilled human.',
          'You also pick an ancestry feat, a small talent from your people.',
        ],
        more: `${AON}/Ancestries.aspx`,
      },
      {
        title: 'Background',
        body: ['Your background is what you did before adventuring: acolyte, criminal, farmhand, scholar. It gives two attribute boosts, training in a skill and a Lore skill, and a skill feat.'],
        more: `${AON}/Backgrounds.aspx`,
      },
      {
        title: 'Class',
        body: ['Your class is the biggest choice: it decides how you fight, cast and help. Fighters master weapons, clerics channel a god’s power, rogues excel at skills and sneak attacks, wizards study spells. Your class sets your key attribute, Hit Points per level, proficiencies and features.'],
        more: `${AON}/Classes.aspx`,
      },
      {
        title: 'Attributes',
        body: [
          'Six attributes describe your hero: Strength, Dexterity, Constitution, Intelligence, Wisdom and Charisma. Each starts at +0. Boosts from your ancestry, background and class add +1 each, then you get four more boosts to place freely.',
          'You can’t boost the same attribute twice from one source, and no attribute can be higher than +4 at level 1. Put your class’s key attribute first.',
        ],
        list: ['Strength: melee damage, Athletics, carrying.', 'Dexterity: AC, ranged attacks, Reflex, Acrobatics, Stealth.', 'Constitution: Hit Points and Fortitude.', 'Intelligence: extra trained skills and languages.', 'Wisdom: Perception and Will.', 'Charisma: social skills and some spellcasting.'],
      },
      {
        title: 'Hit Points, skills and gear',
        body: ['At level 1, your maximum Hit Points are your ancestry’s HP plus your class’s HP plus your Constitution modifier. Your class trains you in some skills, plus one more for each point of your Intelligence modifier. You start with 15 gold pieces for weapons, armor and an adventurer’s pack.'],
      },
      {
        title: 'Leveling up',
        body: ['Heroes level up every 1,000 experience points, or when the GM decides (milestones). Each level brings more Hit Points and new feats. At levels 5, 10, 15 and 20 you boost four attributes.'],
      },
      {
        title: 'Let RollBound do it',
        body: ['The character builder walks through these steps in order, explains each choice, and checks the rules as you go.'],
        tip: { text: 'Build your first hero step by step.', to: '/create', label: 'Open the builder' },
      },
    ],
  },
  {
    slug: 'combat',
    label: 'Combat',
    icon: 'swords',
    blurb: 'Initiative, three actions a turn, and staying alive.',
    lessons: [
      {
        title: 'Initiative',
        body: ['When a fight starts, everyone rolls initiative, usually a Perception check. A hero sneaking up might roll Stealth instead. Turns go from highest to lowest, and each full cycle is a round of about 6 seconds.'],
      },
      {
        title: 'Three actions and a reaction',
        body: ['On your turn you get three actions. Most things cost one; some powerful abilities cost two or three. You also get one reaction per round, which you use on someone else’s turn when its trigger happens, like raising a shield as a blow lands.'],
        list: ['Stride: move up to your Speed.', 'Strike: attack with a weapon or unarmed.', 'Step: move 5 feet without provoking reactions.', 'Interact: draw a weapon, open a door, drink a potion.', 'Raise a Shield: +2 AC until your next turn.', 'Seek: look for hidden creatures or things.'],
        more: `${AON}/Actions.aspx`,
      },
      {
        title: 'Attacking',
        body: [
          'A Strike is an attack roll against the target’s AC: d20 + Strength for melee (or Dexterity with a finesse weapon), or Dexterity for ranged, plus your proficiency bonus. Hit and you roll the weapon’s damage. A critical hit doubles it.',
          'Each attack after the first on your turn takes the multiple attack penalty: −5 for the second and −10 for the rest. Agile weapons lower it to −4 and −8. That third Strike is rarely worth it, so moving or helping is often better.',
        ],
        more: search('multiple attack penalty'),
      },
      {
        title: 'Teamwork and positioning',
        body: ['If you and an ally are on opposite sides of an enemy, it is flanked and off-guard to both of you: −2 to its AC. Cover makes you harder to hit, and helping an ally with Aid can give them a bonus.'],
      },
      {
        title: 'Conditions',
        body: ['Conditions are lasting effects, many with a value that counts down. A few you’ll see often:'],
        list: ['Frightened: a penalty to every check and DC, which drops by 1 at the end of each of your turns.', 'Off-guard: −2 to AC.', 'Prone: off-guard, and attacks are harder. Standing up costs an action.', 'Slowed and stunned: you lose actions.', 'Clumsy, enfeebled, stupefied, drained: penalties tied to an attribute.'],
        more: `${AON}/Conditions.aspx`,
      },
      {
        title: 'Dying and Hero Points',
        body: [
          'At 0 Hit Points you fall unconscious and are dying 1, or dying 2 if a critical hit dropped you. At the start of each turn you make a flat check against DC 10 + your dying value to recover. Reach dying 4 and your hero dies.',
          'When you recover, you become wounded, which makes the next fall more dangerous. Healing from an ally gets you back up right away.',
          'Hero Points are your safety net. You usually start each session with 1. Spend one to reroll a check, or spend them all when you would die to stabilize at 0 HP instead.',
        ],
        more: search('dying'),
      },
    ],
  },
  {
    slug: 'exploration',
    label: 'Skills & Exploration',
    icon: 'map',
    blurb: 'Skills, traveling between fights, resting and downtime.',
    lessons: [
      {
        title: 'Skills',
        body: ['Sixteen skills cover what heroes do outside combat, plus Lore skills for narrow topics like Sailing Lore or Academia Lore. Some favorites:'],
        list: ['Recall Knowledge: Arcana, Nature, Religion or Society to learn a creature’s weaknesses.', 'Demoralize: Intimidation to make a foe frightened.', 'Treat Wounds: Medicine to heal an ally over 10 minutes.', 'Climb, Swim, Force Open: Athletics.', 'Hide and Sneak: Stealth.'],
        more: `${AON}/Skills.aspx`,
      },
      {
        title: 'Exploration activities',
        body: ['While the party travels, each hero picks an activity. It decides what happens when trouble appears, including which skill you roll for initiative.'],
        list: ['Avoid Notice: move stealthily, and roll Stealth for initiative.', 'Search: look for traps and secret doors.', 'Scout: go ahead, giving everyone +1 to initiative.', 'Defend: travel with your shield already raised.', 'Detect Magic: sense magic as you go.'],
        more: search('exploration activities'),
      },
      {
        title: 'Resting',
        body: ['A full night’s rest (8 hours) restores Hit Points equal to your Constitution modifier (minimum 1) times your level. Daily preparations afterward refresh your spells and other daily abilities.'],
      },
      {
        title: 'Downtime',
        body: ['Between adventures, heroes can Earn Income with a skill, Craft items, Retrain a feat or skill, or chase their own goals. The GM decides how much time passes.'],
      },
      {
        title: 'Lore and backstory',
        body: ['The things your hero knows and cares about give the GM hooks to build stories around. Write down where they came from and what they want.'],
        tip: { text: 'Every character has a Lore tab for backstory and notes.', to: '/characters', label: 'Your characters' },
      },
    ],
  },
  {
    slug: 'spells',
    label: 'Spells',
    icon: 'spark',
    blurb: 'Traditions, ranks, cantrips and how to resist magic.',
    lessons: [
      {
        title: 'Four traditions',
        body: ['Every spell belongs to one or more traditions, and each caster draws on one of them.'],
        list: ['Arcane: the logic of the universe. Wizards, magi.', 'Divine: the power of the gods. Clerics, champions.', 'Occult: the mysteries of mind and soul. Bards, psychics.', 'Primal: the forces of nature. Druids, rangers.'],
      },
      {
        title: 'Ranks and spell slots',
        body: [
          'Spells have ranks from 1 to 10. You cast them with spell slots, which refresh after your daily preparations. Many spells can be heightened: cast in a higher-rank slot, they grow stronger.',
          'Prepared casters, like wizards and clerics, choose which spells fill their slots each morning. Spontaneous casters, like sorcerers and bards, know a set list and decide as they cast.',
        ],
        more: search('heightened spells'),
      },
      {
        title: 'Cantrips and focus spells',
        body: ['Cantrips cost no slot, so you can cast them as often as you like. They automatically heighten to half your level, rounded up. Focus spells are your class’s special magic. They cost Focus Points, you have up to 3, and you get one back after 10 minutes of Refocusing.'],
      },
      {
        title: 'Spell attacks and saves',
        body: [
          'Some spells use a spell attack roll against AC. Others ask the target for a saving throw against your spell DC, which is 10 + the same modifier.',
          'Many damaging spells use a basic save: critical success takes no damage, success half, failure full, and critical failure double.',
        ],
      },
      {
        title: 'Rituals',
        body: ['Rituals are long, costly spells cast by a group over hours, like raising the dead or binding a guardian. Anyone with the right skill can help, not only spellcasters.'],
      },
      {
        title: 'Look any spell up',
        body: ['The Spell Book has every spell, with filters for tradition, rank and traits.'],
        tip: { text: 'Search all the spells in the Remaster.', to: '/spells', label: 'Open the Spell Book' },
      },
    ],
  },
  {
    slug: 'game-mastering',
    label: 'Game Mastering',
    icon: 'crown',
    blurb: 'Running the table: DCs, encounters and rewards.',
    lessons: [
      {
        title: 'The GM’s job',
        body: ['You describe the world, play everyone the heroes meet, and decide how the rules apply when something unexpected happens. You don’t have to know every rule. Make a fair call, keep the game moving, and look it up after the session.'],
        list: ['Before you start, hold a session zero: agree on tone, topics to avoid, and how often you’ll play.', 'Prepare situations, not plots. The players will surprise you.', 'Share the spotlight so every hero gets moments.'],
      },
      {
        title: 'Setting DCs',
        body: ['For a task anyone could try, use a simple DC by how skilled someone would need to be. For a challenge tied to a level, like a creature or a lock, use the level-based DCs in GM Core.'],
        table: {
          head: ['Who could do it', 'DC'],
          rows: [
            ['Untrained', '10'],
            ['Trained', '15'],
            ['Expert', '20'],
            ['Master', '30'],
            ['Legendary', '40'],
          ],
        },
        more: search('difficulty class'),
      },
      {
        title: 'Building encounters',
        body: ['Encounters use an experience-point budget. For four heroes, a moderate fight costs 80 XP. Each creature costs XP based on its level compared with the party’s: a creature of the party’s level costs 40, two levels higher costs 80, two lower costs 20.'],
        table: {
          head: ['Threat', 'Budget for 4 heroes', 'Each extra hero'],
          rows: [
            ['Trivial', '40', '+10'],
            ['Low', '60', '+20'],
            ['Moderate', '80', '+20'],
            ['Severe', '120', '+30'],
            ['Extreme', '160', '+40'],
          ],
        },
        tip: { text: 'The encounter builder in each campaign does this math from your party and the Bestiary.', to: '/campaigns', label: 'Your campaigns' },
        more: `${AON}/Rules.aspx?ID=2716`,
      },
      {
        title: 'Monsters',
        body: ['A creature’s level is the best guide to how dangerous it is. Read its abilities before the session, and have it act like a living thing: a cornered goblin runs, a hungry beast goes for the weakest prey.'],
        tip: { text: 'Every creature in Monster Core and Monster Core 2, with full stat blocks.', to: '/bestiary', label: 'Open the Bestiary' },
      },
      {
        title: 'Rewards',
        body: ['Award experience points for encounters and story goals, or level the party up at milestones. Heroes need treasure too: GM Core suggests how much gold and how many items to give each level.'],
      },
      {
        title: 'Keep notes',
        body: ['Write down names, promises and loose threads after each session. Your players will remember the innkeeper you invented on the spot.'],
        tip: { text: 'Each campaign has session logs for recaps the party can read.', to: '/campaigns', label: 'Your campaigns' },
      },
    ],
  },
];

export const topicBySlug = (slug) => TOPICS.find((t) => t.slug === slug) ?? null;
