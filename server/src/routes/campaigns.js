import { Router } from 'express';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { generateInviteCode, normalizeInviteCode } from '../inviteCode.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';
import { COMBAT_ACTIONS, adventurePath, applyCombatAction, bookIssues, campaignBooks, maxHp, migrateBuild } from '@rollbound/rules';
import { rulesData } from '../rules.js';
import { sheetJson } from './sheets.js';
import { currentHp, shieldOf } from './characters.js';
import { requestJoin } from '../joinRequests.js';
import { canJoin } from '../demo.js';
import { logJson, sessionLogs } from './sessionLogs.js';
import { encounters } from './encounters.js';

export const campaigns = Router();
campaigns.use(requireUser);
campaigns.use('/:id/logs', sessionLogs);
campaigns.use('/:id/encounters', encounters);

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
    // An Adventure Path's slug, or null for homebrew.
    adventurePath: row.adventure_path ?? null,
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
  const path = body?.adventurePath ?? null;
  if (path !== null && !adventurePath(path)) errors.push("That isn't an Adventure Path RollBound knows.");
  return { errors, name, backstory, partyLevel, coverKey, books, adventurePath: path };
}

/** Inserts with a fresh invite code, retrying in the (astronomically rare) case of a collision. */
async function insertCampaign({ name, backstory, partyLevel, coverKey, books, adventurePath: path }, userId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO campaigns (name, backstory, party_level, cover_key, gm_user_id, invite_code, books, adventure_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [name, backstory, partyLevel, coverKey ?? null, userId, generateInviteCode(), books, path],
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
  // Each campaign's party, for the portraits on its card.
  const { rows: members } = await pool.query(
    `SELECT id, name, level, portrait_key, campaign_id, owner_id FROM characters WHERE campaign_id = ANY($1::int[]) ORDER BY name`,
    [rows.map((r) => r.id)],
  );
  const all = rows.map((r) => ({
    ...toJson(r, req.user.id),
    party: members
      .filter((m) => m.campaign_id === r.id)
      .map((m) => ({ id: m.id, name: m.name, level: m.level, portraitUrl: storage.publicUrl(m.portrait_key), mine: m.owner_id === req.user.id })),
  }));
  res.json({ running: all.filter((c) => c.isGm), playing: all.filter((c) => !c.isGm) });
});

// The newest session log from any campaign you run or play in, for Home: by the day it
// was played (or written, without a date). { log: null } if there isn't one yet.
campaigns.get('/latest-log', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT l.*, c.name AS campaign_name, c.cover_key,
              ROW_NUMBER() OVER (PARTITION BY l.campaign_id ORDER BY l.played_on NULLS LAST, l.created_at) AS number
       FROM session_logs l JOIN campaigns c ON c.id = l.campaign_id
       WHERE c.gm_user_id = $1
          OR EXISTS (SELECT 1 FROM characters ch WHERE ch.campaign_id = c.id AND ch.owner_id = $1)
     ) x
     ORDER BY COALESCE(x.played_on, x.created_at::date) DESC, x.created_at DESC
     LIMIT 1`,
    [req.user.id],
  );
  const r = rows[0];
  res.json({
    log: r ? { ...logJson(r, { full: false }), campaignId: r.campaign_id, campaignName: r.campaign_name, coverUrl: storage.publicUrl(r.cover_key) } : null,
  });
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
  // isGm tells the GM their own characters can't join; the code itself stays hidden.
  const { inviteCode: _hidden, ...preview } = toJson(rows[0], req.user.id);
  res.json(preview);
});

const GM_CANT_JOIN = (name) => `You run ${name}, so your own characters can't join it. Share the invite code with your players instead.`;

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
// or reject (see joinRequests.js). A GM runs their campaign, so their own characters
// can't join it. A character is in one campaign at a time.
campaigns.post('/join', async (req, res) => {
  const code = normalizeInviteCode(req.body?.code);
  const characterId = String(req.body?.characterId ?? '');
  if (!code) return res.status(400).json({ errors: ["That doesn't look like an invite code."] });
  if (!isId(characterId)) return res.status(400).json({ errors: ['Choose one of your characters.'] });

  const { rows: found } = await pool.query('SELECT id, name, books, gm_user_id FROM campaigns WHERE invite_code = $1', [code]);
  if (!found.length || !(await canJoin(req.user.id, found[0].gm_user_id))) return res.status(404).json({ errors: ['No campaign uses that invite code.'] });
  const campaign = found[0];
  if (campaign.gm_user_id === req.user.id) return res.status(400).json({ errors: [GM_CANT_JOIN(campaign.name)] });

  // A character can only join if everything they picked comes from the campaign's books.
  const { rows: mine } = await pool.query('SELECT id, name, data, campaign_id FROM characters WHERE id = $1 AND owner_id = $2', [characterId, req.user.id]);
  if (!mine.length) return res.status(404).json({ errors: ['Character not found.'] });
  const character = mine[0];
  if (character.campaign_id === campaign.id) return res.status(400).json({ errors: [`${character.name} is already in ${campaign.name}.`] });
  const errors = outsideBooks(character, campaign);
  if (errors.length) return res.status(400).json({ errors });

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

// The campaign's running encounter, for its players' Combat tabs (they check every few
// seconds; Express's ETag turns an unchanged one into a 304). Players see the order (as the
// GM has it), the round and whose turn it is, never a creature's HP, AC or Perception: those
// stay the GM's. creatureId is only for its portrait; the bestiary is public anyway.
campaigns.get('/:id/encounter', async (req, res) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const { rows: member } = await pool.query(
    `SELECT 1 FROM campaigns c WHERE c.id = $1
       AND (c.gm_user_id = $2 OR EXISTS (SELECT 1 FROM characters ch WHERE ch.campaign_id = c.id AND ch.owner_id = $2))`,
    [req.params.id, req.user.id],
  );
  if (!member.length) return res.status(404).json({ errors: ['Campaign not found.'] });
  const { rows } = await pool.query('SELECT id, name, state FROM encounters WHERE campaign_id = $1 AND state IS NOT NULL ORDER BY id DESC LIMIT 1', [req.params.id]);
  const e = rows[0];
  if (!e) return res.json({ encounter: null });
  // Characters' Hit Points and shields as they are now (the party can see each other's sheets anyway).
  const { rows: party } = await pool.query('SELECT id, data, current_hp, inventory FROM characters WHERE campaign_id = $1', [req.params.id]);
  const vitals = new Map(party.map((r) => [r.id, { hp: currentHp(r), maxHp: maxHp(r.data), shield: shieldOf(r) }]));
  res.json({
    encounter: {
      id: e.id,
      name: e.name,
      round: e.state.round,
      current: e.state.current,
      combatants: (e.state.combatants ?? []).map((c) => ({
        key: c.key, kind: c.kind, name: c.name, initiative: c.initiative, defeated: c.defeated, characterId: c.characterId ?? null, creatureId: c.creatureId ?? null,
        // A character's conditions, as the GM set them; a creature's stay the GM's.
        ...(c.kind === 'pc' && { ...vitals.get(c.characterId), conditions: c.conditions ?? [] }),
      })),
    },
  });
});

// The GM changes a character in the fight (the initiative tracker's drawer): { action, amount },
// where action is damage, heal, block (Shield Block) or repair (their shield). Worked out here,
// in a transaction, so a change the player makes at the same moment isn't lost. The player's
// sheet picks it up from the encounter feed.
campaigns.post('/:id/characters/:characterId/combat', async (req, res) => {
  const { id, characterId } = req.params;
  if (!isId(id) || !isId(characterId)) return res.status(404).json({ errors: ['Character not found.'] });
  const { action, amount } = req.body ?? {};
  if (!COMBAT_ACTIONS.includes(action)) return res.status(400).json({ errors: [`Action must be one of: ${COMBAT_ACTIONS.join(', ')}.`] });
  if (!Number.isInteger(amount) || amount < 1 || amount > 9999) return res.status(400).json({ errors: ['Amount must be a whole number from 1 to 9,999.'] });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT ch.* FROM characters ch JOIN campaigns c ON c.id = ch.campaign_id
       WHERE ch.id = $1 AND c.id = $2 AND c.gm_user_id = $3 FOR UPDATE OF ch`,
      [characterId, id, req.user.id],
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ errors: ['Character not found.'] });
    }
    const row = rows[0];
    const result = applyCombatAction({ character: row.data, hp: currentHp(row), inventory: row.inventory }, action, amount, rulesData());
    if (result.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ errors: [result.error] });
    }
    const max = maxHp(row.data);
    const shieldChanged = action === 'block' || action === 'repair';
    await client.query(
      `UPDATE characters SET current_hp = $1${shieldChanged ? ', inventory = $3' : ''} WHERE id = $2`,
      shieldChanged ? [result.hp === max ? null : result.hp, characterId, result.inventory] : [result.hp === max ? null : result.hp, characterId],
    );
    await client.query('COMMIT');
    res.json({ currentHp: result.hp, maxHp: max, shield: result.shield, stopped: result.stopped, through: result.through });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
