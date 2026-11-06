// The site's color themes. Each is a set of color tokens in theme.css, picked with
// data-theme on <html>. People choose one in Account settings; it's saved to their
// account (users.theme on the server) and remembered on this device, so the page can
// start in it before anyone has signed in (see the script in index.html).

export const THEMES = [
  {
    id: 'infernal',
    name: 'Infernal',
    blurb: 'Red and gold by firelight: the original.',
    // Shown in the browser's own toolbar on phones.
    browser: '#0b0908',
  },
  {
    id: 'mirage',
    name: 'Mirage',
    blurb: 'Plum and wine under a magenta haze, with fire-orange and gold.',
    browser: '#0f040f',
  },
  {
    id: 'gothic',
    name: 'Gothic',
    blurb: 'Ash and fog over cold stone, bone-white, moonlight and old blood.',
    browser: '#0d0e10',
  },
  {
    id: 'cosmic',
    name: 'Cosmic',
    blurb: 'Deep space under a nebula: magenta and violet clouds, cyan starlight and a sky of stars.',
    browser: '#06040f',
  },
  {
    id: 'obscure',
    name: 'Obscure',
    blurb: 'The sky at dusk: twilight violet, lavender mist, peach and gold.',
    browser: '#0e0c16',
  },
  {
    id: 'luminary',
    name: 'Luminary',
    blurb: 'A hero’s colors: gold and orange, lettering blue, a violet swoosh and magenta smoke.',
    browser: '#0a0d1f',
  },
  {
    id: 'radiant',
    name: 'Radiant',
    blurb: 'A paladin in the noon sun: burnt-orange sky, scorched rock and white-hot light.',
    browser: '#140a05',
  },
  {
    id: 'tunic',
    name: 'Tunic',
    blurb: 'Forest canopy over bark brown: Kokiri green everywhere, gold buttons and diamonds.',
    browser: '#0f0d08',
  },
  {
    id: 'ethereal',
    name: 'Ethereal',
    blurb: 'Art-deco grime: teal-black, cream and brass, lit by glowing souls.',
    browser: '#0b0f0e',
  },
  {
    id: 'badge',
    name: 'Badge',
    blurb: 'A black-and-white picture: charcoal, ivory and silver, and a brass detective’s badge.',
    browser: '#0c0c0d',
  },
  {
    id: 'traveler',
    name: 'Traveler',
    blurb: 'An array of espresso browns: dark roast, mocha, latte, crema and caramel.',
    browser: '#140d09',
  },
  {
    id: 'judgement',
    name: 'Judgment',
    blurb: 'Black plate and gold filigree, electric-blue and red gems, white light.',
    browser: '#07080b',
  },
  {
    id: 'atrophy',
    name: 'Atrophy',
    blurb: 'Obsidian black, deep indigo and white.',
    browser: '#08080b',
  },
  {
    id: 'emblem',
    name: 'Emblem',
    blurb: 'Dusk indigo and ivory, crimson-magenta cloaks and a sunburst of gold.',
    browser: '#0e0c18',
  },
  {
    id: 'tarnished',
    name: 'Tarnished',
    blurb: 'A teal night and mist over the Lands Between, lit by the Erdtree’s gold.',
    browser: '#081210',
  },
  {
    id: 'briar',
    name: 'Briar',
    blurb: 'A sleeping kingdom’s briar-rose keep: rosewood, dusty rose, antique silver and bone.',
    browser: '#140c0f',
  },
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'The northern lights over a polar night: aurora green, teal, violet and a pink fringe.',
    browser: '#050a14',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    blurb: 'Easter eggs: bright bubblegum, mint, lemon, sky blue and lilac on a grape dusk.',
    browser: '#1d1730',
  },
];

export const DEFAULT_THEME = 'infernal';
const STORAGE_KEY = 'rollbound:theme';

const known = (id) => THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME);

/** Puts a theme on the page and remembers it on this device. */
export function applyTheme(id) {
  const theme = known(id);
  document.documentElement.dataset.theme = theme.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.browser);
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // Storage blocked: the theme just won't be remembered before sign-in.
  }
  return theme.id;
}

/** The theme this device last used, for pages before sign-in. */
export function rememberedTheme() {
  try {
    return known(localStorage.getItem(STORAGE_KEY)).id;
  } catch {
    return DEFAULT_THEME;
  }
}
