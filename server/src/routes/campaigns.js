import { Router } from 'express';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';

export const campaigns = Router();
campaigns.use(requireUser);

const toJson = (row) => ({
  id: row.id,
  name: row.name,
  partyLevel: row.party_level,
  characterCount: row.character_count,
  createdAt: row.created_at,
});

// Campaigns the signed-in user runs as GM.
campaigns.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, COUNT(ch.id)::int AS character_count
     FROM campaigns c
     LEFT JOIN characters ch ON ch.campaign_id = c.id
     WHERE c.gm_user_id = $1
     GROUP BY c.id
     ORDER BY c.name`,
    [req.user.id],
  );
  res.json(rows.map(toJson));
});
