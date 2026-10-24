import { Router } from 'express';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { generateInviteCode, normalizeInviteCode } from '../inviteCode.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';
import { bookIssues, campaignBooks, migrateBuild } from '@rollbound/rules';
import { rulesData } from '../rules.js';
import { sheetJson } from './sheets.js';
import { requestJoin, withdrawRequests } from '../joinRequests.js';
import { canJoin } from '../demo.js';

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
    books: row.books ?? null,
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
 * books: null (or omitted) allows every book; otherwise a list of book titles.
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
  const allBooks = rulesData().meta.books;
  const rawBooks = body?.books ?? null;
  if (rawBooks !== null && (!Array.isArray(rawBooks) || rawBooks.some((b) => !allBooks.includes(b)))) {
    errors.push(`Books must be a list of: ${allBooks.join(', ')}.`);
  }
  const books = errors.length ? null : campaignBooks(rawBooks, allBooks);
  return { errors, name, backstory, partyLevel, coverKey, books };
}

/** Inserts with a fresh invite code, retrying in the (astronomically rare) case of a collision. */
async function insertCampaign({ name, backstory, partyLevel, coverKey, books }, userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO campaigns (name, backstory, party_level, cover_key, gm_user_id, invite_code, books)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [name, backstory, partyLevel, coverKey ?? null, userId, generateInviteCode(), books],
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
  // Demo accounts and real ones never meet: each only finds its own world's campaigns.
  if (!rows.length || !(await canJoin(req.user.id, rows[0].gm_user_id))) return res.status(404).json({ errors: ['No campaign uses that invite code.'] });
  // isGm tells the GM their own characters join straight away; the code itself stays hidden.
  const { inviteCode: _hidden, ...preview } = toJson(rows[0], req.user.id);
  res.json(preview);
});

/** Messages for a character's choices from books the campaign doesn't allow (empty if none). */
export function outsideBooks(character, campaign) {
  const build = character.data?.build;
  if (!campaign.books || !build) return [];
  const data = rulesData();
  const issues = bookIssues(migrateBuild(build, data), data, campaign.books);
  if (!issues.length) return [];
  const list = issues.map((i) => `${i.name} (${i.book})`).join(', ');
  return [`${campaign.name} uses only ${campaign.books.join(', ')}. ${character.name} has ${list}. Edit the character to choose something else first.`];
}

// Ask to join with one of your characters: the GM gets an inbox message to accept
// or reject (see joinRequests.js). A GM's own characters join their campaign
// straight away. A character is in one campaign at a time.
campaigns.post('/join', async (req, res) => {
  const code = normalizeInviteCode(req.body?.code);
  const characterId = String(req.body?.characterId ?? '');
  if (!code) return res.status(400).json({ errors: ["That doesn't look like an invite code."] });
  if (!isId(characterId)) return res.status(400).json({ errors: ['Choose one of your characters.'] });

  const { rows: found } = await pool.query('SELECT id, name, books, gm_user_id FROM campaigns WHERE invite_code = $1', [code]);
  if (!found.length || !(await canJoin(req.user.id, found[0].gm_user_id))) return res.status(404).json({ errors: ['No campaign uses that invite code.'] });
  const campaign = found[0];

  // A character can only join if everything they picked comes from the campaign's books.
  const { rows: mine } = await pool.query('SELECT id, name, data, campaign_id FROM characters WHERE id = $1 AND owner_id = $2', [characterId, req.user.id]);
  if (!mine.length) return res.status(404).json({ errors: ['Character not found.'] });
  const character = mine[0];
  if (character.campaign_id === campaign.id) return res.status(400).json({ errors: [`${character.name} is already in ${campaign.name}.`] });
  const errors = outsideBooks(character, campaign);
  if (errors.length) return res.status(400).json({ errors });

  if (campaign.gm_user_id === req.user.id) {
    await pool.query('UPDATE characters SET campaign_id = $1, updated_at = now() WHERE id = $2', [campaign.id, character.id]);
    await withdrawRequests(character.id);
    return res.json({ status: 'joined', campaignId: campaign.id, campaignName: campaign.name });
  }
  await requestJoin({ campaign, character, player: req.user.display_name });
  res.status(202).json({ status: 'pending', campaignId: campaign.id, campaignName: campaign.name });
});

campaigns.get('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const { rows } = await pool.query(`${SELECT_CAMPAIGN} WHERE c.id = $1`, [req.params.id]);
  const row = rows[0];
  const { rows: roster } = await pool.query(
    `SELECT ch.id, ch.name, ch.level, ch.data->>'className' AS class_name, ch.data->'ancestry'->>'name' AS ancestry, ch.data->'build' AS build,
            ch.owner_id, ch.portrait_key, u.display_name AS player, u.avatar_key AS player_avatar_key
     FROM characters ch JOIN users u ON u.id = ch.owner_id
     WHERE ch.campaign_id = $1 ORDER BY ch.name`,
    [req.params.id],
  );
  const member = row && (row.gm_user_id === req.user.id || roster.some((r) => r.owner_id === req.user.id));
  if (!member) return res.status(404).json({ errors: ['Campaign not found.'] });

  // The GM also sees who's waiting to join.
  const { rows: waiting } = row.gm_user_id === req.user.id
    ? await pool.query(
        `SELECT jr.id, jr.created_at, ch.name, ch.level, ch.data->>'className' AS class_name, ch.data->'ancestry'->>'name' AS ancestry,
                ch.portrait_key, u.display_name AS player, u.avatar_key AS player_avatar_key
         FROM join_requests jr JOIN characters ch ON ch.id = jr.character_id JOIN users u ON u.id = ch.owner_id
         WHERE jr.campaign_id = $1 AND jr.status = 'pending' ORDER BY jr.created_at`,
        [req.params.id],
      )
    : { rows: [] };

  res.json({
    ...toJson(row, req.user.id),
    requests: waiting.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      character: { name: r.name, level: r.level, className: r.class_name, ancestry: r.ancestry, portraitUrl: storage.publicUrl(r.portrait_key) },
      player: r.player,
      playerAvatarUrl: storage.publicUrl(r.player_avatar_key),
    })),
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
      // Choices from books the campaign doesn't allow (it can change after they joined).
      outsideBooks: bookIssues(migrateBuild(r.build, rulesData()), rulesData(), row.books).map((i) => `${i.name} (${i.book})`),
    })),
  });
});

// The GM edits the campaign. Send coverKey: null to remove the cover, omit it to keep it.
campaigns.patch('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const input = await validCampaign(req.body, req.user.id);
  if (input.errors.length) return res.status(400).json({ errors: input.errors });

  const { rows: before } = await pool.query('SELECT cover_key, books FROM campaigns WHERE id = $1 AND gm_user_id = $2', [req.params.id, req.user.id]);
  if (!before.length) return res.status(404).json({ errors: ['Campaign not found.'] });
  const oldCover = before[0].cover_key;
  const newCover = input.coverKey === undefined ? oldCover : input.coverKey;

  // books: omitted keeps the current list, so older clients can't erase it.
  const books = req.body?.books === undefined ? before[0].books : input.books;
  await pool.query(
    'UPDATE campaigns SET name = $1, backstory = $2, party_level = $3, cover_key = $4, books = $5 WHERE id = $6',
    [input.name, input.backstory, input.partyLevel, newCover, books, req.params.id],
  );
  await swapImages(oldCover, newCover);

  const { rows } = await pool.query(`${SELECT_CAMPAIGN} WHERE c.id = $1`, [req.params.id]);
  res.json(toJson(rows[0], req.user.id));
});

// Invite codes are permanent: there's no route to change one.

// The GM deletes the campaign. Its characters stay with their players, in no campaign
// (characters.campaign_id is ON DELETE SET NULL).
campaigns.delete('/:id', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const { rows } = await pool.query('DELETE FROM campaigns WHERE id = $1 AND gm_user_id = $2 RETURNING cover_key', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ errors: ['Campaign not found.'] });
  await swapImages(rows[0].cover_key, null);
  res.status(204).end();
});

// The GM removes any character from the campaign; it stays with its player.
campaigns.post('/:id/remove', async (req, res) => {
  const characterId = String(req.body?.characterId ?? '');
  if (!isId(req.params.id) || !isId(characterId)) return res.status(404).json({ errors: ['Character not found.'] });
  const { rowCount } = await pool.query(
    `UPDATE characters SET campaign_id = NULL, updated_at = now()
     WHERE id = $1 AND campaign_id = $2 AND campaign_id IN (SELECT id FROM campaigns WHERE gm_user_id = $3)`,
    [characterId, req.params.id, req.user.id],
  );
  if (!rowCount) return res.status(404).json({ errors: ['Character not found.'] });
  res.status(204).end();
});

// A party member's sheet, read-only. Only the GM and players with a character in
// the campaign can see it (which includes the character's own player).
campaigns.get('/:id/characters/:characterId', async (req, res) => {
  const { id, characterId } = req.params;
  if (!isId(id) || !isId(characterId)) return res.status(404).json({ errors: ['Character not found.'] });
  const { rows } = await pool.query(
    `SELECT ch.*, c.name AS campaign_name
     FROM characters ch JOIN campaigns c ON c.id = ch.campaign_id
     WHERE ch.id = $1 AND c.id = $2
       AND (c.gm_user_id = $3 OR EXISTS (SELECT 1 FROM characters mine WHERE mine.campaign_id = c.id AND mine.owner_id = $3))`,
    [characterId, id, req.user.id],
  );
  if (!rows.length) return res.status(404).json({ errors: ['Character not found.'] });
  res.json({ ...sheetJson(rows[0]), mine: rows[0].owner_id === req.user.id });
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
