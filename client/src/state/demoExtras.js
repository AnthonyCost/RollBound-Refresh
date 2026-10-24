// What players change on a demo character's sheet (hit points, inventory,
// backstory), kept for this tab like the rest of the demo.
const KEY = 'rollbound:demo-extras';

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export const demoExtras = (id) => read()[id] ?? {};

/** Merges changes into a demo character's extras; false if storage is blocked. */
export function saveDemoExtras(id, changes) {
  const all = read();
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...all, [id]: { ...all[id], ...changes } }));
    return true;
  } catch {
    return false;
  }
}
