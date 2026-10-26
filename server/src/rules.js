// The rules data, loaded on first use, for checks the server makes itself (which books
// a character's choices come from) and for the demo's sample characters. About 1 MB in
// memory. It reloads when the data is re-imported (index.json changes), so a running
// server never stamps new characters with an older rules version than the client's.
import { statSync } from 'node:fs';
import { loadRulesData } from '@rollbound/rules/load';

const INDEX = new URL('../data/index.json', import.meta.resolve('@rollbound/rules/load'));
let data = null;
let loadedAt = 0;

export function rulesData() {
  const changed = statSync(INDEX).mtimeMs;
  if (!data || changed !== loadedAt) {
    try {
      data = loadRulesData();
      loadedAt = changed;
    } catch (err) {
      // Mid-import, a file can be half written: keep the last good data and try again next time.
      if (!data) throw err;
    }
  }
  return data;
}
