import { Router } from 'express';
import { armorClass, maxHp } from '@rollbound/rules';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';
import { validateCharacter } from '../validate.js';
import { generateShareId } from '../shareId.js';

export const characters = Router();
characters.use(requireUser);

/** Hit points right now: stored damage, kept within the sheet's current maximum. */
export const currentHp = (row) => Math.min(row.current_hp ?? Infinity, maxHp(row.data));

const toJson = (row) => ({
  id: row.id,
  shareId: row.share_id,
  name: row.name,
  level: row.level,
  campaignId: row.campaign_id,
  campaignName: row.campaign_name ?? null,
  // The campaign's books (null: all), so the builder offers only those when editing.
  campaignBooks: row.campaign_books ?? null,
  portraitUrl: storage.publicUrl(row.portrait_key),
  data: row.data,
  // Derived on the way out so every client sees the same math.
  summary: { maxHp: maxHp(row.data), ac: armorClass(row.data).total },
  currentHp: currentHp(row),
  updatedAt: row.updated_at,
});

const SELECT_WITH_CAMPAIGN = `
  SELECT ch.*, c.name AS campaign_name, c.books AS campaign_books
  FROM characters ch
  LEFT JOIN campaigns c ON c.id = ch.campaign_id`;

const isId = (s) => /^\d{1,9}$/.test(s);

characters.get('/', async (req, res) => {
  const { rows } = await pool.query(`${SELECT_WITH_CAMPAIGN} WHERE ch.owner_id = $1 ORDER BY ch.name`, [req.user.id]);
  res.json(rows.map(toJson));
});

characters.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Character not found' });
  const { rows } = await pool.query(`${SELECT_WITH_CAMPAIGN} WHERE ch.id = $1 AND ch.owner_id = $2`, [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  res.json(toJson(rows[0]));
});

characters.post('/', async (req, res) => {
  const errors = validateCharacter(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const c = req.body;
  const { rows } = await pool.query(
    'INSERT INTO characters (owner_id, name, level, data, share_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [req.user.id, c.name.trim(), c.level, c, generateShareId()],
  );
  res.status(201).json(toJson(rows[0]));
});

characters.put('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Character not found' });
  const errors = validateCharacter(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const c = req.body;
  const { rows } = await pool.query(
    `UPDATE characters SET name = $1, level = $2, data = $3, updated_at = now()
     WHERE id = $4 AND owner_id = $5 RETURNING *`,
    [c.name.trim(), c.level, c, req.params.id, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  res.json(toJson(rows[0]));
});

characters.delete('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ error: 'Character not found' });
  const { rows } = await pool.query('DELETE FROM characters WHERE id = $1 AND owner_id = $2 RETURNING portrait_key', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  await swapImages(rows[0].portrait_key, null);
  res.status(204).end();
});

// Set or remove a character's portrait. portraitKey: null removes it.
characters.put('/:id/portrait', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Character not found.'] });
  const { rows: before } = await pool.query('SELECT portrait_key FROM characters WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
  if (!before.length) return res.status(404).json({ errors: ['Character not found.'] });
  if (req.body?.portraitKey === undefined) return res.status(400).json({ errors: ['Send portraitKey (or null to remove it).'] });

  const checked = await checkImageKey(req.body.portraitKey, 'portrait', req.user.id);
  if (checked.error) return res.status(400).json({ errors: [checked.error] });

  await pool.query('UPDATE characters SET portrait_key = $1, updated_at = now() WHERE id = $2', [checked.key, req.params.id]);
  await swapImages(before[0].portrait_key, checked.key);
  const { rows } = await pool.query(`${SELECT_WITH_CAMPAIGN} WHERE ch.id = $1`, [req.params.id]);
  res.json(toJson(rows[0]));
});

// Set hit points right now: { currentHp } from 0 to the character's maximum.
characters.put('/:id/hp', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Character not found.'] });
  const { rows: found } = await pool.query('SELECT data FROM characters WHERE id = $1 AND owner_id = $2', [req.params.id, req.user.id]);
  if (!found.length) return res.status(404).json({ errors: ['Character not found.'] });
  const max = maxHp(found[0].data);
  const hp = req.body?.currentHp;
  if (!Number.isInteger(hp) || hp < 0 || hp > max) return res.status(400).json({ errors: [`Hit points must be a whole number from 0 to ${max}.`] });
  await pool.query('UPDATE characters SET current_hp = $1 WHERE id = $2', [hp === max ? null : hp, req.params.id]);
  res.json({ currentHp: hp });
});

// Replace the share link, so the old one stops working.
characters.post('/:id/share-link', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Character not found.'] });
  const { rows } = await pool.query('UPDATE characters SET share_id = $1 WHERE id = $2 AND owner_id = $3 RETURNING share_id', [generateShareId(), req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ errors: ['Character not found.'] });
  res.json({ shareId: rows[0].share_id });
});
