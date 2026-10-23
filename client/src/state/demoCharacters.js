// Characters built in demo mode live only in this browser tab, like the rest of the demo.
const KEY = 'rollbound:demo-characters';
export const DEMO_ID_PREFIX = 'demo-';

function read() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    if (list.length) sessionStorage.setItem(KEY, JSON.stringify(list));
    else sessionStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export const listDemoCharacters = read;

export function getDemoCharacter(id) {
  return read().find((c) => c.id === id) ?? null;
}

/** Returns the new id, or null if the browser blocks storage. */
export function saveDemoCharacter(data) {
  const id = `${DEMO_ID_PREFIX}${Date.now()}`;
  return write([...read(), { id, data }]) ? id : null;
}

export function clearDemoCharacters() {
  write([]);
}
