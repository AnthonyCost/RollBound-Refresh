// The rules data and its version. The version file is tiny, so any screen can tell
// whether a saved character was built from older data without loading the rules.
import rulesVersion from '@rollbound/rules/data/version.json';
import { api } from '../api.js';
import { DEMO_ID_PREFIX, updateDemoCharacter } from './demoCharacters.js';

export const RULES_VERSION = rulesVersion.version;

/** Loads the full rules data (its own chunk, about 1 MB). */
export const loadRules = () => import('@rollbound/rules/data/pf2e-level1.json').then((m) => m.default);

/** Whether a saved character was built from different rules data than the current one. */
export const isOutdated = (character) => Boolean(character?.build) && character.dataVersion !== RULES_VERSION;

/** Saves a new sheet over an existing character, in demo storage or on the server. */
export async function replaceCharacter(id, data) {
  if (id.startsWith(DEMO_ID_PREFIX)) {
    if (!updateDemoCharacter(id, data)) throw new Error('Your browser is blocking storage, so the demo can’t update this character.');
    return;
  }
  await api.saveCharacter(id, data);
}
