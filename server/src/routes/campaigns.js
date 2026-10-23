import { Router } from 'express';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { generateInviteCode, normalizeInviteCode } from '../inviteCode.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';

export const campaigns = Router();
campaigns.use(requireUser);

const NAME_MAX = 80;
const BACKSTORY_MAX = 5000;

const toJson = (row, userId) => {
  const isGm = row.gm_user_id === userId;
  return {
    id: row.id,
    name: row.name,
    backstory: row.backstory,
    coverUrl: storage.publicUrl(row.cover_key),
    partyLevel: row.party_level,
    characterCount: row.character_count ?? undefined,
    gmName: row.gm_name ?? undefined,
    gmAvatarUrl: storage.publicUrl(row.gm_avatar_key ?? null),
    isGm,
    // Only the GM sees the code; players share it by asking the GM.
    ...(isGm && { inviteCode: row.invite_code }),
    createdAt: row.created_at,
  };
};

const SELECT_CAMPAIGN = `
  SELECT c.*, u.display_name AS gm_name, u.avatar_key AS gm_avatar_key,
         (SELECT COUNT(*)::int FROM characters ch WHERE ch.campaign_id = c.id) AS character_count
  FROM campaigns c
  LEFT JOIN users u ON u.id = c.gm_user_id`;

const isId = (s) => /^\d{1,9}$/.test(s);

/**
 * Validates a campaign body. coverKey: undefined keeps the current cover (on edit),
 * null means no cover, and a string must be a finished upload by this same user.
 */
async function validCampaign(body, userId) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const backstory = typeof body?.backstory === 'string' ? body.backstory.trim() : '';
  const partyLevel = body?.partyLevel ?? 1;
  const coverKey = body?.coverKey;
  if (!name || name.length > NAME_MAX) errors.push(`Title must be 1–${NAME_MAX} characters.`);
  if (backstory.length > BACKSTORY_MAX) errors.push(`Backstory must be ${BACKSTORY_MAX} characters or fewer.`);
  if (!Number.isInteger(partyLevel) || partyLevel < 1 || partyLevel > 20) errors.push('Party level must be from 1 to 20.');
  if (coverKey !== undefined) {
    const checked = await checkImageKey(coverKey, 'cover', userId);
    if (checked.error) errors.push(checked.error);
  }
  return { errors, name, backstory, partyLevel, coverKey };
}

/** Inserts with a fresh invite code, retrying in the (astronomically rare) case of a collision. */
async function insertCampaign({ name, backstory, partyLevel, coverKey }, userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO campaigns (name, backstory, party_level, cover_key, gm_user_id, invite_code)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [name, backstory, partyLevel, coverKey ?? null, userId, generateInviteCode()],
      );
      return rows[0];
    } catch (err) {
      if (err.code !== '23505' || err.constraint !== 'campaigns_invite_code_idx') throw err;
    }
  }
  throw new Error('Could not generate a unique invite code');
}

// Campaigns you run, and campaigns your characters have joined.
campaigns.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_CAMPAIGN}
     WHERE c.gm_user_id = $1
        OR EXISTS (SELECT 1 FROM characters ch WHERE ch.campaign_id = c.id AND ch.owner_id = $1)
     ORDER BY c.name`,
    [req.user.id],
  );
  const all = rows.map((r) => toJson(r, req.user.id));
  res.json({ running: all.filter((c) => c.isGm), playing: all.filter((c) => !c.isGm) });
});

campaigns.post('/', async (req, res) => {
  const input = await validCampaign(req.body, req.user.id);
  if (input.errors.length) return res.status(400).json({ errors: input.errors });
  const row = await insertCampaign(input, req.user.id);
  await swapImages(null, input.coverKey ?? null);
  res.status(201).json(toJson({ ...row, character_count: 0, gm_name: req.user.display_name, gm_avatar_key: req.user.avatar_key }, req.user.id));
});

// Preview a campaign from its invite code before joining.
campaigns.get('/invites/:code', async (req, res) => {
  const code = normalizeInviteCode(req.params.code);
  if (!code) return res.status(404).json({ errors: ["That doesn't look like an invite code."] });
  const { rows } = await pool.query(`${SELECT_CAMPAIGN} WHERE c.invite_code = $1`, [code]);
  if (!rows.length) return res.status(404).json({ errors: ['No campaign uses that invite code.'] });
  const { inviteCode: _hidden, ...preview } = toJson(rows[0], null);
  res.json(preview);
});

// Join with one of your characters. A character is in one campaign at a time.
campaigns.post('/join', async (req, res) => {
  const code = normalizeInviteCode(req.body?.code);
  const characterId = String(req.body?.characterId ?? '');
  if (!code) return res.status(400).json({ errors: ["That doesn't look like an invite code."] });
  if (!isId(characterId)) return res.status(400).json({ errors: ['Choose one of your characters.'] });

  const { rows: found } = await pool.query('SELECT id FROM campaigns WHERE invite_code = $1', [code]);
  if (!found.length) return res.status(404).json({ errors: ['No campaign uses that invite code.'] });

  const { rowCount } = await pool.query(
    'UPDATE characters SET campaign_id = $1, updated_at = now() WHERE id = $2 AND owner_id = $3',
    [found[0].id, characterId, req.user.id],
  );
  if (!rowCount) return res.status(404).json({ errors: ['Character not found.'] });
  res.json({ campaignId: found[0].id });
});

campaigns.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const { rows } = await pool.query(`${SELECT_CAMPAIGN} WHERE c.id = $1`, [req.params.id]);
  const row = rows[0];
  const { rows: roster } = await pool.query(
    `SELECT ch.id, ch.name, ch.level, ch.data->>'className' AS class_name, ch.data->'ancestry'->>'name' AS ancestry,
            ch.owner_id, ch.portrait_key, u.display_name AS player, u.avatar_key AS player_avatar_key
     FROM characters ch JOIN users u ON u.id = ch.owner_id
     WHERE ch.campaign_id = $1 ORDER BY ch.name`,
    [req.params.id],
  );
  const member = row && (row.gm_user_id === req.user.id || roster.some((r) => r.owner_id === req.user.id));
  if (!member) return res.status(404).json({ errors: ['Campaign not found.'] });

  res.json({
    ...toJson(row, req.user.id),
    characters: roster.map((r) => ({
      id: r.id,
      name: r.name,
      level: r.level,
      className: r.class_name,
      ancestry: r.ancestry,
      player: r.player,
      playerAvatarUrl: storage.publicUrl(r.player_avatar_key),
      portraitUrl: storage.publicUrl(r.portrait_key),
      mine: r.owner_id === req.user.id,
    })),
  });
});

// The GM edits the campaign. Send coverKey: null to remove the cover, omit it to keep it.
campaigns.patch('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const input = await validCampaign(req.body, req.user.id);
  if (input.errors.length) return res.status(400).json({ errors: input.errors });

  const { rows: before } = await pool.query('SELECT cover_key FROM campaigns WHERE id = $1 AND gm_user_id = $2', [req.params.id, req.user.id]);
  if (!before.length) return res.status(404).json({ errors: ['Campaign not found.'] });
  const oldCover = before[0].cover_key;
  const newCover = input.coverKey === undefined ? oldCover : input.coverKey;

  await pool.query(
    'UPDATE campaigns SET name = $1, backstory = $2, party_level = $3, cover_key = $4 WHERE id = $5',
    [input.name, input.backstory, input.partyLevel, newCover, req.params.id],
  );
  await swapImages(oldCover, newCover);

  const { rows } = await pool.query(`${SELECT_CAMPAIGN} WHERE c.id = $1`, [req.params.id]);
  res.json(toJson(rows[0], req.user.id));
});

// The GM can replace a leaked code; the old one stops working immediately.
campaigns.post('/:id/invite-code', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        'UPDATE campaigns SET invite_code = $1 WHERE id = $2 AND gm_user_id = $3 RETURNING invite_code',
        [generateInviteCode(), req.params.id, req.user.id],
      );
      if (!rows.length) return res.status(404).json({ errors: ['Campaign not found.'] });
      return res.json({ inviteCode: rows[0].invite_code });
    } catch (err) {
      if (err.code !== '23505') throw err;
    }
  }
  throw new Error('Could not generate a unique invite code');
});

// A player removes their own character from a campaign.
campaigns.post('/:id/leave', async (req, res) => {
  const characterId = String(req.body?.characterId ?? '');
  if (!isId(req.params.id) || !isId(characterId)) return res.status(404).json({ errors: ['Character not found.'] });
  const { rowCount } = await pool.query(
    'UPDATE characters SET campaign_id = NULL, updated_at = now() WHERE id = $1 AND owner_id = $2 AND campaign_id = $3',
    [characterId, req.user.id, req.params.id],
  );
  if (!rowCount) return res.status(404).json({ errors: ['Character not found.'] });
  res.status(204).end();
});
