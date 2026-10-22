// Creates the tables and loads demo data: `npm run db:setup`
import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';

const here = new URL('.', import.meta.url);

try {
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = await readFile(new URL(file, here), 'utf8');
    await pool.query(sql);
    console.log(`Ran ${file}`);
  }
} catch (err) {
  console.error('Database setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
