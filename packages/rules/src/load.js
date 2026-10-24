// Loads the rules data from disk, for Node (server scripts, tests, build tools).
// Import it as '@rollbound/rules/load'; the browser loads files itself (client/src/state/rulesData.js).
import { readFileSync } from 'node:fs';
import { assembleData, dataFiles } from './data.js';

const DATA_DIR = new URL('../data/', import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, DATA_DIR), 'utf8'));

/** The rules data, optionally only some types or books: loadRulesData({ types: ['feats'] }). */
export function loadRulesData(filter) {
  const index = read('index.json');
  return assembleData(index, Object.fromEntries(dataFiles(index, filter).map((f) => [f.path, read(f.path)])));
}
