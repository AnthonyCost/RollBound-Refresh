// Creates the tables and loads demo data: `npm run db:setup` (safe to re-run).
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';
import { generateInviteCode } from '../src/inviteCode.js';

const here = new URL('.', import.meta.url);

try {
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = await readFile(new URL(file, here), 'utf8');
    await pool.query(sql);
    console.log(`Ran ${file}`);
  }

  // Campaigns created before invite codes existed (or by the seed) get one now.
  const { rows } = await pool.query('SELECT id FROM campaigns WHERE invite_code IS NULL');
  for (const { id } of rows) {
    await pool.query('UPDATE campaigns SET invite_code = $1 WHERE id = $2', [generateInviteCode(), id]);
  }
  await pool.query('ALTER TABLE campaigns ALTER COLUMN invite_code SET NOT NULL');
  if (rows.length) console.log(`Gave ${rows.length} campaign(s) an invite code`);
} catch (err) {
  console.error('Database setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
