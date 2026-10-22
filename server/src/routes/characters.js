import { Router } from 'express';
import { armorClass, maxHp } from '@rollbound/rules';
import { pool } from '../db.js';
import { validateCharacter } from '../validate.js';

export const characters = Router();

const toJson = (row) => ({
  id: row.id,
  name: row.name,
  level: row.level,
  campaignId: row.campaign_id,
  data: row.data,
  // Derived on the way out so every client sees the same math.
  summary: { maxHp: maxHp(row.data), ac: armorClass(row.data).total },
  updatedAt: row.updated_at,
});

characters.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM characters ORDER BY id');
  res.json(rows.map(toJson));
});

characters.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM characters WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  res.json(toJson(rows[0]));
});

characters.post('/', async (req, res) => {
  const errors = validateCharacter(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const c = req.body;
  const { rows } = await pool.query(
    'INSERT INTO characters (name, level, data) VALUES ($1, $2, $3) RETURNING *',
    [c.name.trim(), c.level, c],
  );
  res.status(201).json(toJson(rows[0]));
});

characters.put('/:id', async (req, res) => {
  const errors = validateCharacter(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const c = req.body;
  const { rows } = await pool.query(
    'UPDATE characters SET name = $1, level = $2, data = $3, updated_at = now() WHERE id = $4 RETURNING *',
    [c.name.trim(), c.level, c, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ error: 'Character not found' });
  res.json(toJson(rows[0]));
});

characters.delete('/:id', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM characters WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Character not found' });
  res.status(204).end();
});
