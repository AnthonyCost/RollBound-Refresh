import { Router } from 'express';
import { armorClass, maxHp } from '@rollbound/rules';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';
import { validateCharacter } from '../validate.js';

export const characters = Router();
characters.use(requireUser);

const toJson = (row) => ({
  id: row.id,
  name: row.name,
  level: row.level,
  campaignId: row.campaign_id,
  campaignName: row.campaign_name ?? null,
  portraitUrl: storage.publicUrl(row.portrait_key),
  data: row.data,
  // Derived on the way out so every client sees the same math.
  summary: { maxHp: maxHp(row.data), ac: armorClass(row.data).total },
  updatedAt: row.updated_at,
});

const SELECT_WITH_CAMPAIGN = `
  SELECT ch.*, c.name AS campaign_name
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
    'INSERT INTO characters (owner_id, name, level, data) VALUES ($1, $2, $3, $4) RETURNING *',
    [req.user.id, c.name.trim(), c.level, c],
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
