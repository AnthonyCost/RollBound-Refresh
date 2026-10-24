import { Router } from 'express';
import { pool } from '../db.js';

// Session logs: a campaign's GM writes, edits and deletes them; everyone in the
// campaign (the GM and players with a character in it) reads them. Mounted under
// /api/campaigns/:id/logs, after requireUser.
export const sessionLogs = Router({ mergeParams: true });

export const LOG_LIMITS = { title: 120, body: 50_000 };
const isId = (s) => /^\d{1,9}$/.test(String(s));
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const toJson = (row, { full = true } = {}) => ({
  id: row.id,
  title: row.title,
  // "2026-10-24" as written (db.js keeps DATE columns as text), so time zones can't shift the day.
  playedOn: row.played_on ?? null,
  ...(full ? { body: row.body } : { excerpt: row.body.slice(0, 280) }),
  // Numbered in the order they were played (or written, without a date).
  number: Number(row.number),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Who you are in this campaign: 'gm', 'player', or null if you're not in it. */
async function roleIn(campaignId, userId) {
  const { rows } = await pool.query(
    `SELECT c.gm_user_id = $2 AS gm,
            EXISTS (SELECT 1 FROM characters ch WHERE ch.campaign_id = c.id AND ch.owner_id = $2) AS player
     FROM campaigns c WHERE c.id = $1`,
    [campaignId, userId],
  );
  const r = rows[0];
  return r?.gm ? 'gm' : r?.player ? 'player' : null;
}

/** Checks a log from the client. Returns { errors } or { title, playedOn, body }. */
function validLog(body) {
  const errors = [];
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const text = typeof body?.body === 'string' ? body.body.replace(/\s+$/, '') : '';
  const playedOn = body?.playedOn || null;
  if (!title || title.length > LOG_LIMITS.title) errors.push(`Title must be 1–${LOG_LIMITS.title} characters.`);
  if (typeof body?.body !== 'string' || text.length > LOG_LIMITS.body) errors.push(`The log must be ${LOG_LIMITS.body.toLocaleString('en-US')} characters or fewer.`);
  if (playedOn !== null && !isDate(playedOn)) errors.push('The session date must be a date.');
  return errors.length ? { errors } : { title, body: text, playedOn };
}

const SELECT_LOGS = `
  SELECT l.*, ROW_NUMBER() OVER (ORDER BY l.played_on NULLS LAST, l.created_at) AS number
  FROM session_logs l WHERE l.campaign_id = $1`;

sessionLogs.param('logId', (req, res, next, value) => (isId(value) ? next() : res.status(404).json({ errors: ['Session log not found.'] })));

// Before each route: 404 unless you're in the campaign; writing needs the GM.
sessionLogs.use(async (req, res, next) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  req.role = await roleIn(req.params.id, req.user.id);
  if (!req.role) return res.status(404).json({ errors: ['Campaign not found.'] });
  if (req.method !== 'GET' && req.role !== 'gm') return res.status(403).json({ errors: ['Only the GM can write session logs.'] });
  next();
});

// Newest first.
sessionLogs.get('/', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM (${SELECT_LOGS}) x ORDER BY number DESC`, [req.params.id]);
  res.json(rows.map((r) => toJson(r, { full: false })));
});

sessionLogs.get('/:logId', async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM (${SELECT_LOGS}) x WHERE id = $2`, [req.params.id, req.params.logId]);
  if (!rows.length) return res.status(404).json({ errors: ['Session log not found.'] });
  res.json(toJson(rows[0]));
});

sessionLogs.post('/', async (req, res) => {
  const log = validLog(req.body);
  if (log.errors) return res.status(400).json({ errors: log.errors });
  const { rows } = await pool.query('INSERT INTO session_logs (campaign_id, title, played_on, body) VALUES ($1, $2, $3, $4) RETURNING id', [
    req.params.id,
    log.title,
    log.playedOn,
    log.body,
  ]);
  const { rows: made } = await pool.query(`SELECT * FROM (${SELECT_LOGS}) x WHERE id = $2`, [req.params.id, rows[0].id]);
  res.status(201).json(toJson(made[0]));
});

sessionLogs.put('/:logId', async (req, res) => {
  const log = validLog(req.body);
  if (log.errors) return res.status(400).json({ errors: log.errors });
  const { rowCount } = await pool.query(
    'UPDATE session_logs SET title = $1, played_on = $2, body = $3, updated_at = now() WHERE id = $4 AND campaign_id = $5',
    [log.title, log.playedOn, log.body, req.params.logId, req.params.id],
  );
  if (!rowCount) return res.status(404).json({ errors: ['Session log not found.'] });
  const { rows } = await pool.query(`SELECT * FROM (${SELECT_LOGS}) x WHERE id = $2`, [req.params.id, req.params.logId]);
  res.json(toJson(rows[0]));
});

sessionLogs.delete('/:logId', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM session_logs WHERE id = $1 AND campaign_id = $2', [req.params.logId, req.params.id]);
  if (!rowCount) return res.status(404).json({ errors: ['Session log not found.'] });
  res.status(204).end();
});
