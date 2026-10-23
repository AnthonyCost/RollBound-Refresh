// Upgrades the build stored inside each saved character to the current version
// (version 2 refers to rules items by Foundry ID instead of slug). Safe to re-run:
// already-current builds are skipped. Runs as part of `npm run db:setup`, or alone
// with `npm run db:migrate-builds`.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { BUILD_VERSION, migrateBuild } from '@rollbound/rules';
import { pool } from '../src/db.js';

export async function migrateBuilds() {
  const dataPath = createRequire(import.meta.url).resolve('@rollbound/rules/data/pf2e-level1.json');
  const rules = JSON.parse(await readFile(dataPath, 'utf8'));
  const { rows } = await pool.query("SELECT id, data FROM characters WHERE data ? 'build'");
  let upgraded = 0;
  for (const { id, data } of rows) {
    const version = data.build?.v ?? 1;
    if (version >= BUILD_VERSION) continue;
    const build = migrateBuild({ ...data.build, v: version }, rules);
    await pool.query('UPDATE characters SET data = $1 WHERE id = $2', [{ ...data, build }, id]);
    upgraded++;
  }
  return { checked: rows.length, upgraded };
}

// Run directly: `node db/migrate-builds.js`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { checked, upgraded } = await migrateBuilds();
    console.log(`Checked ${checked} saved build(s), upgraded ${upgraded}.`);
  } catch (err) {
    console.error('Build migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
