// Portrait art for the ancestry and class showcases, keyed by slug. Drop files in
// client/public/art/ and list them here, e.g. class: { wizard: '/art/class-wizard.png' }.
// Anything without its own art uses the placeholder.
const ART = {
  ancestry: {},
  class: {},
};

export const PLACEHOLDER_ART = '/art/placeholder-hero.png';

export const artFor = (kind, slug) => ART[kind]?.[slug] ?? PLACEHOLDER_ART;
export const hasOwnArt = (kind, slug) => Boolean(ART[kind]?.[slug]);
