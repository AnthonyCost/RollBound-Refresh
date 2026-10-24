// Join requests: entering a campaign's invite code asks its GM to let a character
// in. The GM gets an inbox message to accept or reject, and the player gets one
// back with the answer.
import { pool } from './db.js';

/** "a level 1 Human Psychic", from a character's saved sheet. */
const describe = (data) => `a level ${data.level} ${[data.ancestry?.name, data.className].filter(Boolean).join(' ')}`;

/**
 * Asks the campaign's GM to let a character join. Asking again for the same
 * campaign changes nothing; asking for another withdraws the earlier request.
 */
export async function requestJoin({ campaign, character, player }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: pending } = await client.query("SELECT id, campaign_id FROM join_requests WHERE character_id = $1 AND status = 'pending' FOR UPDATE", [character.id]);
    if (pending[0]?.campaign_id === campaign.id) {
      await client.query('COMMIT');
      return pending[0].id;
    }
    if (pending.length) {
      await client.query("UPDATE join_requests SET status = 'withdrawn', decided_at = now() WHERE id = $1", [pending[0].id]);
    }
    const { rows } = await client.query('INSERT INTO join_requests (campaign_id, character_id) VALUES ($1, $2) RETURNING id', [campaign.id, character.id]);
    await client.query(
      `INSERT INTO messages (user_id, kind, title, body, join_request_id) VALUES ($1, 'join-request', $2, $3, $4)`,
      [
        campaign.gm_user_id,
        `${character.name} would like to join ${campaign.name}`,
        `${player} entered your invite code to bring ${character.name}, ${describe(character.data)}, into ${campaign.name}. Accept to add them to the party.`,
        rows[0].id,
      ],
    );
    await client.query('COMMIT');
    return rows[0].id;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Withdraws a character's pending request, if any (it joined somewhere directly). */
export const withdrawRequests = (characterId) =>
  pool.query("UPDATE join_requests SET status = 'withdrawn', decided_at = now() WHERE character_id = $1 AND status = 'pending'", [characterId]);

/**
 * The GM accepts or rejects a request. check(character, campaign) can refuse an
 * accept with error messages (the campaign's books changed since they asked).
 * Returns { errors } or { status }.
 */
export async function decide({ requestId, gmUserId, accept, check }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT jr.id, jr.status, jr.character_id, c.id AS campaign_id, c.name AS campaign_name, c.books,
              ch.name AS character_name, ch.data, ch.owner_id
       FROM join_requests jr
       JOIN campaigns c ON c.id = jr.campaign_id
       JOIN characters ch ON ch.id = jr.character_id
       WHERE jr.id = $1 AND c.gm_user_id = $2
       FOR UPDATE OF jr`,
      [requestId, gmUserId],
    );
    const r = rows[0];
    if (!r) {
      await client.query('ROLLBACK');
      return { notFound: true };
    }
    if (r.status !== 'pending') {
      await client.query('ROLLBACK');
      return { errors: [`This request was already ${r.status}.`], status: r.status };
    }
    if (accept) {
      const errors = check({ name: r.character_name, data: r.data }, { name: r.campaign_name, books: r.books });
      if (errors.length) {
        await client.query('ROLLBACK');
        return { errors };
      }
      await client.query('UPDATE characters SET campaign_id = $1, updated_at = now() WHERE id = $2', [r.campaign_id, r.character_id]);
    }
    const status = accept ? 'accepted' : 'rejected';
    await client.query('UPDATE join_requests SET status = $1, decided_at = now() WHERE id = $2', [status, r.id]);
    await client.query(
      `INSERT INTO messages (user_id, kind, title, body, join_request_id) VALUES ($1, $2, $3, $4, $5)`,
      accept
        ? [r.owner_id, 'join-accepted', `${r.character_name} joined ${r.campaign_name}`, `The GM of ${r.campaign_name} accepted your request. ${r.character_name} is now in the party.`, r.id]
        : [r.owner_id, 'join-rejected', `${r.character_name} wasn't accepted into ${r.campaign_name}`, `The GM of ${r.campaign_name} declined your request for ${r.character_name}.`, r.id],
    );
    // The GM has dealt with it, so their request message counts as read.
    await client.query(
      `INSERT INTO message_reads (user_id, message_id)
       SELECT $1, id FROM messages WHERE join_request_id = $2 AND kind = 'join-request' ON CONFLICT DO NOTHING`,
      [gmUserId, r.id],
    );
    await client.query('COMMIT');
    return { status, campaignId: r.campaign_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
