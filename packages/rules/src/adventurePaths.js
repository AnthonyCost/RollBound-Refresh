// Every Pathfinder Second Edition Adventure Path, for starting a campaign from one:
// the Remastered ones (2024 on, plus the remastered Gatewalkers and Season of Ghosts
// hardcovers, which stand in for their original volumes) and those written for the
// original rules before it (preRemaster, 2019-2023).
// Facts (levels, setting, dates) are from PathfinderWiki and the Archives of Nethys.
// The synopses are our own spoiler-free premises, since players see a campaign's
// backstory; they're a starting point the GM can rewrite. Covers aren't included:
// see client/src/assets/adventure-paths/README.md.
// status: 'released', or 'upcoming' with released as the announced date. released is
// the first volume's date (or the hardcover's, for one-book editions). Newest first.
// themes: what kind of campaign it is, from THEMES. Beginner friendly is only for the
// paths Paizo itself points new players to.

/** Themes a path can have, with what each means, in the order they're shown. */
export const THEMES = {
  beginner: { label: 'Beginner friendly', about: 'Paizo recommends it for new players and new GMs.' },
  'dungeon-crawl': { label: 'Dungeon crawl', about: 'Most of the campaign is exploring one great dungeon, room by room.' },
  horror: { label: 'Horror', about: 'Curses, hauntings, and things that go bump in the night.' },
  mystery: { label: 'Mystery', about: 'The heroes uncover what is really going on.' },
  war: { label: 'War', about: 'Armies, battles, and a conflict bigger than the party.' },
  rebellion: { label: 'Rebellion', about: 'The heroes fight back against a tyrannical power.' },
  diplomacy: { label: 'Diplomacy', about: 'Summits, alliances, and talking as much as fighting.' },
  intrigue: { label: 'Intrigue', about: 'Politics, high society, and schemes behind the scenes.' },
  wilderness: { label: 'Wilderness', about: 'Forests, wild places, and the creatures that live there.' },
  exploration: { label: 'Exploration', about: 'Journeys into strange and uncharted places.' },
  'small-town': { label: 'Small town', about: 'A home base whose people the heroes come to know and protect.' },
  urban: { label: 'City', about: 'Most of the adventure happens in one great city.' },
  kingdom: { label: 'Kingdom building', about: 'The heroes found and rule a nation of their own.' },
  heist: { label: 'Heist', about: 'Outlaws, schemes, and big scores.' },
  school: { label: 'Magic school', about: 'The heroes are students at an academy of magic.' },
  tournament: { label: 'Tournament', about: 'Teams fight their way through a grand competition.' },
  mythology: { label: 'Mythology', about: 'Gods, legends, and heroes of myth.' },
  'high-level': { label: 'High level', about: 'It starts at level 10 or higher.' },
};

/** A path's themes, adding High level for paths that start at level 10 or above. */
export const pathThemes = (path) => [...(path.themes ?? []), ...(path.levels[0] >= 10 ? ['high-level'] : [])];

export const ADVENTURE_PATHS = [
  {
    slug: 'vaultlines',
    themes: ['exploration'],
    name: 'Vaultlines',
    levels: [11, 20],
    released: '2026-11-04',
    status: 'upcoming',
    setting: 'The Darklands',
    synopsis:
      "Villains have laid hands on magic strong enough to remake a whole region of the Darklands, the vast world beneath Golarion's surface. The heroes give chase through cramped tunnels, monster-haunted caverns, and hidden jungles that have never seen the sun, and the deeper they go, the older the evil behind it all appears.",
  },
  {
    slug: 'bastion-of-blasphemies',
    themes: ['dungeon-crawl', 'horror', 'mystery'],
    name: 'Bastion of Blasphemies',
    levels: [5, 13],
    released: '2026-07-30',
    status: 'released',
    setting: 'Bastardhall, Ustalav',
    synopsis:
      "On an island in Ustalav's Lake Laroba stands Bastardhall, a ruined castle said to swallow everyone who walks its halls. When the Black Coach comes for Florin Kindler's parents and they vanish, the heroes agree to help him find them, and step into a castle bound by a curse centuries old. Breaking it may be the only way back out.",
  },
  {
    slug: 'hells-destiny',
    themes: ['rebellion', 'war', 'intrigue'],
    name: "Hell's Destiny",
    levels: [10, 20],
    released: '2026-07-01',
    status: 'released',
    setting: 'Cheliax',
    sequelTo: 'hellbreakers',
    synopsis:
      "As Cheliax goes to war with Andoran, the infernal empire declares martial law and seals its borders, trapping the heroes inside. Escaping isn't enough. To break Cheliax's grip they must rally its long-oppressed people and its many enemies, then take the fight to the empire on land, at sea, and finally into Hell itself.",
  },
  {
    slug: 'hellbreakers',
    themes: ['rebellion', 'war'],
    name: 'Hellbreakers',
    levels: [1, 10],
    released: '2026-03-04',
    status: 'released',
    setting: 'Isger',
    synopsis:
      "Isger has lived under the thumb of infernal Cheliax for generations. The heroes join the Hellbreakers League, rebels sworn to set their nation free, striking at Chelaxian strongholds, standing against the Hellknights, and facing the devils behind the throne. Their fight continues in Hell's Destiny.",
  },
  {
    slug: 'season-of-ghosts',
    themes: ['beginner', 'horror', 'mystery', 'small-town'],
    name: 'Season of Ghosts',
    levels: [1, 12],
    released: '2026-02-04',
    status: 'released',
    setting: 'Willowshore, Tian Xia',
    edition: 'Remastered hardcover',
    synopsis:
      "Willowshore is a quiet river town in the haunted Specterwood. After a festival night, its young heroes wake alone in the woods to find their home under a strange curse that began on the first day of summer. They must help the town weather the lean times ahead while searching for the curse's source, a trail that leads past the eerie Wall of Ghosts.",
  },
  {
    slug: 'revenge-of-the-runelords',
    themes: ['intrigue'],
    name: 'Revenge of the Runelords',
    levels: [12, 20],
    released: '2025-10-08',
    status: 'released',
    setting: 'The Saga Lands',
    mythic: true,
    synopsis:
      "The heroes are mythic champions helping Queen Sorshen bring New Thassilon onto the world stage when a three-tailed star falls on the Saga Lands. An ancient runelord thought long dead has returned for revenge, and his cult means to set off one apocalypse after another unless the heroes can stop it.",
  },
  {
    slug: 'myth-speaker',
    themes: ['mythology'],
    name: 'Myth-Speaker',
    levels: [1, 10],
    released: '2025-07-02',
    status: 'released',
    setting: 'Iblydos',
    mythic: true,
    synopsis:
      "In the port of Bailax on the islands of Iblydos, funeral games for a fallen hero are cut short by an omen. A god's death has woken a mythic power that slept for ages, and the heroes become the first new hero-gods in living memory. That power is hard to master, the city is sliding into wild revelry and fire, and something mythic stirs beneath the islands.",
  },
  {
    slug: 'gatewalkers',
    themes: ['mystery', 'exploration'],
    name: 'Gatewalkers',
    levels: [1, 10],
    released: '2025-07-02',
    status: 'released',
    setting: 'Across Golarion',
    edition: 'Remastered hardcover',
    synopsis:
      "For one night no one can remember, thousands of people across Golarion were pulled through strange portals and returned changed, with odd new powers and no memory of where they went. The heroes are among them. They set out to uncover the truth of this Missing Moment before the power that marked them consumes them.",
  },
  {
    slug: 'shades-of-blood',
    themes: ['horror', 'mystery'],
    name: 'Shades of Blood',
    levels: [1, 10],
    released: '2025-04-02',
    status: 'released',
    setting: 'Azlant',
    synopsis:
      "The heroes are research assistants hired to study a rare stellar eclipse from a remote island in old Azlant. When a column of shadow bursts from the sea and looses shadowy creatures on the settlement of Talmandor's Bounty, their research trip becomes a fight to learn what lies buried beneath the waves.",
  },
  {
    slug: 'spore-war',
    themes: ['war', 'diplomacy', 'wilderness'],
    name: 'Spore War',
    levels: [11, 20],
    released: '2025-01-08',
    status: 'released',
    setting: 'Kyonin',
    synopsis:
      "Queen Telandia Edasseril calls on the heroes, Kyonin's newest champions, to represent the elven nation at a diplomatic summit. But the demon Treerazer, whose blight has festered in the Tanglebriar for ages, is poised to strike at the heart of Kyonin, and the war to come will decide the forest's fate.",
  },
  {
    slug: 'triumph-of-the-tusk',
    themes: ['diplomacy', 'war'],
    name: 'Triumph of the Tusk',
    levels: [3, 11],
    released: '2024-10-30',
    status: 'released',
    setting: 'Belkzen',
    synopsis:
      "Ardax the White-Hair has called for peace and new alliances in Belkzen, the homeland of the orcs, and the heroes answer as envoys of orc holds and foreign powers alike. Their mission soon faces wild storms, betrayal, and the restless dead, and Belkzen's survival may come to rest on their shoulders.",
  },
  {
    slug: 'curtain-call',
    themes: ['intrigue', 'mystery', 'urban'],
    name: 'Curtain Call',
    levels: [11, 20],
    released: '2024-08-01',
    status: 'released',
    setting: 'Kintargo',
    synopsis:
      "The heroes' past deeds are so legendary that a famous director is turning them into an opera, and they're invited to Kintargo to help bring it to the stage. But rumors say an old foe has returned for revenge, the production is plagued by sinister trouble, and before opening night the heroes must become adventurers once more.",
  },
  {
    slug: 'wardens-of-wildwood',
    themes: ['wilderness', 'intrigue'],
    name: 'Wardens of Wildwood',
    levels: [5, 13],
    released: '2024-04-24',
    status: 'released',
    setting: 'The Verduran Forest, Taldor',
    synopsis:
      "The heroes keep the peace at the Greenwood Gala, the yearly gathering of the druids of the Wildwood Lodge in the Verduran Forest. When saboteurs assassinate leaders from across the region, the Lodge's new leadership turns to violence, and the heroes are drawn into a struggle over primal relics and the future of the forest itself.",
  },
  {
    slug: 'seven-dooms-for-sandpoint',
    themes: ['small-town'],
    name: 'Seven Dooms for Sandpoint',
    levels: [4, 11],
    released: '2024-03-27',
    status: 'released',
    setting: 'Sandpoint, Varisia',
    synopsis:
      "Sandpoint has weathered fires, murders, goblin raids, and attacks by giants and dragons. Now its new heroes discover that something has been guiding those disasters all along, and the little town on the Lost Coast faces seven dooms at once.",
  },
  {
    slug: 'sky-kings-tomb',
    themes: ['mystery', 'exploration'],
    name: "Sky King's Tomb",
    levels: [1, 11],
    released: '2023-08-02',
    status: 'released',
    setting: 'Highhelm',
    preRemaster: true,
    synopsis:
      "The heroes come to Highhelm, greatest of the dwarven cities, as guests of a festival of storytelling. There they find a relic tied to one of dwarvenkind's greatest heroes, and it draws them into a mystery as old as the city, one whose trail leads down into the Darklands.",
  },
  {
    slug: 'stolen-fate',
    themes: ['mystery', 'exploration'],
    name: 'Stolen Fate',
    levels: [11, 20],
    released: '2023-04-26',
    status: 'released',
    setting: 'Across Golarion',
    preRemaster: true,
    synopsis:
      "Strange cards from a magical harrow deck turn up among the belongings of a band of seasoned adventurers, with no explanation of how they got there. The cards belong to a scattered artifact bound up with the destinies of everyone on Golarion, and the heroes are drawn into a race to gather them before anyone else can.",
  },
  {
    slug: 'kingmaker',
    themes: ['kingdom', 'wilderness', 'exploration'],
    name: 'Kingmaker',
    levels: [1, 20],
    released: '2022-10-26',
    status: 'released',
    setting: 'The Stolen Lands',
    edition: 'Hardcover',
    preRemaster: true,
    synopsis:
      "The nobles of Brevoy grant the heroes a charter to explore the Stolen Lands, a stretch of wilderness overrun by bandits and beasts. Clearing it is only the beginning: in the land they tame, the heroes will found a kingdom of their own and learn what it takes to rule it.",
  },
  {
    slug: 'blood-lords',
    themes: ['horror', 'intrigue'],
    name: 'Blood Lords',
    levels: [1, 20],
    released: '2022-07-27',
    status: 'released',
    setting: 'Geb',
    preRemaster: true,
    synopsis:
      "In Geb, a nation ruled by the undead, the living are troubleshooters for the powers that be. The heroes are sent to look into strange happenings at a farm worked by zombies, a small job that turns out to be the first sign of a far greater threat to the nation of the dead.",
  },
  {
    slug: 'outlaws-of-alkenstar',
    themes: ['heist', 'urban'],
    name: 'Outlaws of Alkenstar',
    levels: [1, 11],
    released: '2022-04-27',
    status: 'released',
    setting: 'Alkenstar',
    preRemaster: true,
    synopsis:
      "In Alkenstar, a smog-choked city of steam and gunpowder, a powerful mogul has ruined the heroes and left them with nothing. Now they're outlaws, and they mean to get even, one daring score at a time.",
  },
  {
    slug: 'quest-for-the-frozen-flame',
    themes: ['wilderness', 'exploration'],
    name: 'Quest for the Frozen Flame',
    levels: [1, 11],
    released: '2022-01-26',
    status: 'released',
    setting: 'The Realm of the Mammoth Lords',
    preRemaster: true,
    synopsis:
      "The Broken Tusk clan has survived another hard winter on the tundra, but the signs say this new year will be unlike any before. The heroes, the clan's newest scouts, must find a safe road through wilderness full of dangerous beasts, rival groups, and the threat of natural disaster.",
  },
  {
    slug: 'strength-of-thousands',
    themes: ['school', 'mystery'],
    name: 'Strength of Thousands',
    levels: [1, 20],
    released: '2021-08-04',
    status: 'released',
    setting: 'The Magaambya, Nantambu',
    preRemaster: true,
    synopsis:
      "The heroes are new students at the Magaambya, the ancient academy of magic in Nantambu. Between entrance tests of skill and wit and their studies, they find themselves looking into strange infestations and supernatural intruders in the school's oldest halls, and their education is only beginning.",
  },
  {
    slug: 'fists-of-the-ruby-phoenix',
    themes: ['tournament'],
    name: 'Fists of the Ruby Phoenix',
    levels: [11, 20],
    released: '2021-07-07',
    status: 'released',
    setting: 'Goka, Tian Xia',
    edition: 'Hardcover',
    preRemaster: true,
    synopsis:
      "The sorcerer Hao Jin invites martial artists, adventurers, and fortune seekers to the legendary Ruby Phoenix Tournament, where the champions win glory and a fabled prize. First, though, the heroes' team must earn its place by surviving the perils of Danger Island.",
  },
  {
    slug: 'abomination-vaults',
    themes: ['beginner', 'dungeon-crawl', 'horror', 'small-town'],
    name: 'Abomination Vaults',
    levels: [1, 10],
    released: '2021-01-27',
    status: 'released',
    setting: 'Otari, Isle of Kortos',
    edition: 'Hardcover',
    preRemaster: true,
    synopsis:
      "On a hill above the seaside town of Otari stands Gauntlight, a ruined lighthouse that has stood dark for as long as anyone can remember. When it begins to glow with an eerie light, the townsfolk take it as an omen of trouble, and Otari's newest heroes set out to explore the ruins around it and the dungeon that lies far beneath.",
  },
  {
    slug: 'agents-of-edgewatch',
    themes: ['mystery', 'urban'],
    name: 'Agents of Edgewatch',
    levels: [1, 20],
    released: '2020-07-30',
    status: 'released',
    setting: 'Absalom',
    preRemaster: true,
    synopsis:
      "The heroes are rookie officers of the Edgewatch, the city watch of Absalom, just as the once-in-a-century Radiant Festival fills the city with visitors. When tourists start vanishing around the edges of the fairgrounds, it falls to the newest members of the watch to find out why.",
  },
  {
    slug: 'extinction-curse',
    themes: ['mystery', 'exploration'],
    name: 'Extinction Curse',
    levels: [1, 20],
    released: '2020-01-29',
    status: 'released',
    setting: 'The Isle of Kortos',
    preRemaster: true,
    synopsis:
      "The heroes are performers in the Circus of Wayward Wonders, and its ringmaster has been found dead moments before the troupe's debut. The show must go on, and the heroes must win over a crowd while hunting for whoever killed their ringmaster.",
  },
  {
    slug: 'age-of-ashes',
    themes: ['small-town', 'exploration'],
    name: 'Age of Ashes',
    levels: [1, 20],
    released: '2019-08-01',
    status: 'released',
    setting: 'Breachill and beyond',
    preRemaster: true,
    synopsis:
      "Fires burn atop the ruined citadel on Hellknight Hill, above the town of Breachill, and the red smoke may be a call for help. The heroes climb the hill to find out who lit them, the first step in an adventure that will carry them far beyond the little town.",
  },
];

/** The Adventure Path with this slug, or null. */
export const adventurePath = (slug) => ADVENTURE_PATHS.find((p) => p.slug === slug) ?? null;
