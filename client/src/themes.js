// The site's colour themes. Each is a set of colour tokens in theme.css, picked with
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
    id: 'frigid',
    name: 'Frigid',
    blurb: 'Polar night under the aurora: ice-white, frost blue and northern-lights green.',
    browser: '#080d16',
  },
  {
    id: 'obscure',
    name: 'Obscure',
    blurb: 'The sky at dusk: twilight violet, lavender mist, amethyst and gold.',
    browser: '#0e0c16',
  },
  {
    id: 'luminary',
    name: 'Luminary',
    blurb: 'A hero’s colours: royal blue, parchment and the Luminary’s gold.',
    browser: '#0a0d1f',
  },
  {
    id: 'radiant',
    name: 'Radiant',
    blurb: 'Holy light on burnished armour: gold, amber and deep umber.',
    browser: '#14120d',
  },
  {
    id: 'tunic',
    name: 'Tunic',
    blurb: 'Forest canopy over bark brown, Kokiri green and gold lettering.',
    browser: '#120d08',
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
