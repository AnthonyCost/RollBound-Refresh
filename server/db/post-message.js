// Posts a message to everyone's inbox: an announcement or patch notes.
//   npm run inbox:post -- --title "New: campaign inbox" --body "Text here"
//   npm run inbox:post -- --kind patch-notes --title "Patch 0.4" --body-file notes.txt
// Line breaks in the body are kept. --kind is announcement (default) or patch-notes.
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pool } from '../src/db.js';

const KINDS = ['announcement', 'patch-notes'];
const { values } = parseArgs({
  options: {
    kind: { type: 'string', default: 'announcement' },
    title: { type: 'string' },
    body: { type: 'string' },
    'body-file': { type: 'string' },
  },
});

try {
  if (!KINDS.includes(values.kind)) throw new Error(`--kind must be ${KINDS.join(' or ')}.`);
  if (!values.title?.trim()) throw new Error('--title is required.');
  const body = values['body-file'] ? await readFile(values['body-file'], 'utf8') : (values.body ?? '');
  const { rows } = await pool.query("INSERT INTO messages (user_id, kind, title, body) VALUES (NULL, $1, $2, $3) RETURNING id", [values.kind, values.title.trim(), body.trim()]);
  console.log(`Posted ${values.kind} #${rows[0].id} to everyone's inbox: ${values.title.trim()}`);
} catch (err) {
  console.error('Posting failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
