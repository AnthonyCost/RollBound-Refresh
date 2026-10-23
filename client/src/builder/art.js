// Portrait and icon art for the ancestry and class showcases. Files in
// client/src/assets/art/ are found by name, so adding art needs no code:
//   <kind>-<slug>.webp       full-length portrait (the large panel)
//   <kind>-<slug>-icon.webp  round emblem (the selection tile)
// e.g. class-wizard.webp, ancestry-elf-icon.webp. Guide: docs/adding-art.md
const files = import.meta.glob('../assets/art/*.{webp,png,jpg}', { eager: true, query: '?url', import: 'default' });

const ART = {};
const ICONS = {};
let placeholder = null;

for (const [path, url] of Object.entries(files)) {
  const name = path.split('/').pop().replace(/\.(webp|png|jpg)$/, '');
  if (name === 'placeholder-hero') {
    placeholder = url;
    continue;
  }
  const m = /^(ancestry|class)-([a-z0-9-]+?)(-icon)?$/.exec(name);
  if (!m) continue;
  const [, kind, slug, icon] = m;
  const table = icon ? ICONS : ART;
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
export const tileFocusFor = (kind, slug) => TILE_FOCUS[kind]?.[slug] ?? null;
