import { Router } from 'express';
import { armorClass, maxHp } from '@rollbound/rules';
import { pool } from '../db.js';
import { storage } from '../storage/index.js';
import { isShareId } from '../shareId.js';
import { currentHp } from './characters.js';

// Shared character sheets: anyone with a character's share link can view it, signed
// in or not. Read-only, and only what the sheet shows (no owner or campaign ids).
export const sheets = Router();

sheets.get('/:shareId', async (req, res) => {
  if (!isShareId(req.params.shareId)) return res.status(404).json({ error: 'Sheet not found' });
  const { rows } = await pool.query(
    `SELECT ch.*, c.name AS campaign_name
     FROM characters ch
     LEFT JOIN campaigns c ON c.id = ch.campaign_id
     WHERE ch.share_id = $1`,
    [req.params.shareId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Sheet not found' });
  const row = rows[0];
  res.json({
    name: row.name,
    level: row.level,
    campaignName: row.campaign_name ?? null,
    portraitUrl: storage.publicUrl(row.portrait_key),
    data: row.data,
    summary: { maxHp: maxHp(row.data), ac: armorClass(row.data).total },
    currentHp: currentHp(row),
    inventory: row.inventory ?? null,
    backstory: row.backstory ?? '',
  });
});
