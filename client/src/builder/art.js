// Portrait art for the ancestry and class showcases, keyed by slug. Drop files in
// client/public/art/ and list them here, e.g. class: { wizard: '/art/class-wizard.png' }.
// Anything without its own art uses the placeholder. Full guide: docs/adding-art.md
const ART = {
  // Borrowed from the class iconics until ancestry art arrives. Where possible these
  // use classes the builder doesn't show yet, so no character appears on both steps.
  ancestry: {
    dwarf: '/art/class-gunslinger.webp', // Nhalmika
    elf: '/art/class-rogue.webp', // Merisiel
    gnome: '/art/class-druid.webp', // Lini
    goblin: '/art/class-alchemist.webp', // Fumbus
    halfling: '/art/class-bard.webp', // Lem
    human: '/art/class-fighter.webp', // Valeros
    orc: '/art/class-inventor.webp', // Droven
    tengu: '/art/class-oracle.webp', // Korakai
  },
  // Paizo's Remaster iconics, one per class.
  class: {
    alchemist: '/art/class-alchemist.webp',
    barbarian: '/art/class-barbarian.webp',
    bard: '/art/class-bard.webp',
    champion: '/art/class-champion.webp',
    cleric: '/art/class-cleric.webp',
    druid: '/art/class-druid.webp',
    fighter: '/art/class-fighter.webp',
    investigator: '/art/class-investigator.webp',
    monk: '/art/class-monk.webp',
    oracle: '/art/class-oracle.webp',
    ranger: '/art/class-ranger.webp',
    rogue: '/art/class-rogue.webp',
    sorcerer: '/art/class-sorcerer.webp',
    swashbuckler: '/art/class-swashbuckler.webp',
    witch: '/art/class-witch.webp',
    wizard: '/art/class-wizard.webp',
    // Not in the imported books yet; picked up automatically once these classes are added.
    animist: '/art/class-animist.webp',
    commander: '/art/class-commander.webp',
    exemplar: '/art/class-exemplar.webp',
    guardian: '/art/class-guardian.webp',
    gunslinger: '/art/class-gunslinger.webp',
    inventor: '/art/class-inventor.webp',
    kineticist: '/art/class-kineticist.webp',
  },
};

// Round emblems shown on the selection tiles. Classes without one fall back to a
// crop of the portrait.
const ICONS = {
  class: Object.fromEntries(
    ['alchemist', 'barbarian', 'bard', 'champion', 'cleric', 'druid', 'fighter', 'investigator', 'monk', 'oracle', 'ranger', 'rogue', 'sorcerer', 'swashbuckler', 'witch', 'wizard',
      // Not in the imported books yet.
      'gunslinger', 'magus', 'summoner',
    ].map((slug) => [slug, `/art/class-${slug}-icon.webp`]),
  ),
};

export const iconFor = (kind, slug) => ICONS[kind]?.[slug] ?? null;

// Optional tile framing for portraits whose default crop misses the face:
// x/y is the point (in % of the image) to center on, zoom is how many tile-widths
// wide the image is drawn.
const TILE_FOCUS = {
  ancestry: {
    human: { x: 45, y: 10, zoom: 2.6 },
  },
};

export const tileFocusFor = (kind, slug) => TILE_FOCUS[kind]?.[slug] ?? null;

export const PLACEHOLDER_ART = '/art/placeholder-hero.png';

export const artFor = (kind, slug) => ART[kind]?.[slug] ?? PLACEHOLDER_ART;
export const hasOwnArt = (kind, slug) => Boolean(ART[kind]?.[slug]);
