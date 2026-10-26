// Portrait and icon art for the ancestry and class showcases. Files in
// client/src/assets/art/ are found by name, so adding art needs no code:
//   <kind>-<slug>.webp       full-length portrait (the large panel)
//   <kind>-<slug>-icon.webp  round emblem (the selection tile)
//   class-<slug>-banner.webp background for the character sheet (1920x1080)
//   class-<slug>-card.webp   closer crop of the banner for character cards
// e.g. class-wizard.webp, ancestry-elf-icon.webp. Guide: docs/adding-art.md
const files = import.meta.glob('../assets/art/*.{webp,png,jpg}', { eager: true, query: '?url', import: 'default' });

const ART = {};
const ICONS = {};
const BANNERS = {};
const CARDS = {};
let placeholder = null;

for (const [path, url] of Object.entries(files)) {
  const name = path.split('/').pop().replace(/\.(webp|png|jpg)$/, '');
  if (name === 'placeholder-hero') {
    placeholder = url;
    continue;
  }
  const m = /^(ancestry|class)-([a-z0-9-]+?)(-icon|-banner|-card)?$/.exec(name);
  if (!m) continue;
  const [, kind, slug, extra] = m;
  const table = { '-icon': ICONS, '-banner': BANNERS, '-card': CARDS }[extra] ?? ART;
  (table[kind] ??= {})[slug] = url;
}

// Stand-ins until an option has its own portrait: borrow another image by file name.
// Anything with its own file ignores its entry here.
const BORROWED = {
  ancestry: {
    dwarf: 'class-gunslinger', // Nhalmika
    elf: 'class-rogue', // Merisiel
    gnome: 'class-druid', // Lini
    goblin: 'class-alchemist', // Fumbus
    halfling: 'class-bard', // Lem
    human: 'class-fighter', // Valeros
    orc: 'class-inventor', // Droven
    tengu: 'class-oracle', // Korakai
  },
};

for (const [kind, entries] of Object.entries(BORROWED)) {
  for (const [slug, file] of Object.entries(entries)) {
    const [fromKind, ...rest] = file.split('-');
    const url = ART[fromKind]?.[rest.join('-')];
    if (url) (ART[kind] ??= {})[slug] ??= url;
  }
}

// Optional tile framing for portraits used as tile images when an option has no
// icon: x/y is the point (in % of the image) to center on, zoom is how many
// tile-widths wide the image is drawn.
const TILE_FOCUS = {
  ancestry: {
    human: { x: 45, y: 10, zoom: 2.6 },
  },
};

/** Gitignored local placeholder; null when it isn't present (the showcase then shows a letter). */
export const PLACEHOLDER_ART = placeholder;

export const artFor = (kind, slug) => ART[kind]?.[slug] ?? PLACEHOLDER_ART;
export const hasOwnArt = (kind, slug) => Boolean(ART[kind]?.[slug]);
export const iconFor = (kind, slug) => ICONS[kind]?.[slug] ?? null;

// Ancestry icons are plain artwork; the app clips them to a circle and draws the
// ring, so every tile matches whatever shape the source image is. Class icons are
// finished emblems with their own painted ring, so they're shown as-is.
const FRAMED_ICONS = { ancestry: true, class: false };
export const iconIsFramed = (kind) => Boolean(FRAMED_ICONS[kind]);
export const tileFocusFor = (kind, slug) => TILE_FOCUS[kind]?.[slug] ?? null;

/** A class's wide banner for character cards, or null when it has none. */
export const bannerFor = (slug) => BANNERS.class?.[slug] ?? null;

/** The closer crop of a class's banner for character cards, or its full banner until one is made. */
export const cardArtFor = (slug) => CARDS.class?.[slug] ?? bannerFor(slug);

/**
 * A character's class slug, for its art. Older characters (the seeded sample) have
 * no classSlug, so it's worked out from the class name.
 */
export const classSlugOf = (character) =>
  character?.classSlug ?? (character?.className ? character.className.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null);
