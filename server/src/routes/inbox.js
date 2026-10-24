import { Router } from 'express';
import { pool } from '../db.js';
import { requireUser } from '../auth.js';
import { storage } from '../storage/index.js';
import { decide } from '../joinRequests.js';
import { answerBotRequests } from '../demo.js';
import { outsideBooks } from './campaigns.js';

// Your inbox: messages for everyone (announcements, patch notes) and for you
// (join requests to your campaigns, and the answers to yours).
export const inbox = Router();
inbox.use(requireUser);

const isId = (s) => /^\d{1,9}$/.test(String(s));
const MAX_SHOWN = 100;

inbox.get('/', async (req, res) => {
  // In a demo, Sam answers requests to his campaign before you see the inbox.
  if (req.user.is_demo) await answerBotRequests(req.user.id);
  const { rows } = await pool.query(
    `SELECT m.*,
            -- Messages for everyone from before you signed up count as read.
            (r.message_id IS NOT NULL OR (m.user_id IS NULL AND m.created_at < u.created_at)) AS read,
            jr.status AS request_status, jr.campaign_id, c.name AS campaign_name,
            ch.id AS character_id, ch.name AS character_name, ch.level AS character_level,
            ch.data->>'className' AS class_name, ch.data->'ancestry'->>'name' AS ancestry, ch.portrait_key,
            p.display_name AS player, p.avatar_key AS player_avatar_key
     FROM messages m
     JOIN users u ON u.id = $1
     LEFT JOIN message_reads r ON r.message_id = m.id AND r.user_id = $1
     LEFT JOIN join_requests jr ON jr.id = m.join_request_id
     LEFT JOIN campaigns c ON c.id = jr.campaign_id
     LEFT JOIN characters ch ON ch.id = jr.character_id
     LEFT JOIN users p ON p.id = ch.owner_id
     WHERE m.user_id = $1 OR m.user_id IS NULL
     ORDER BY m.created_at DESC, m.id DESC
     LIMIT ${MAX_SHOWN}`,
    [req.user.id],
  );
  const messages = rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    body: m.body,
    createdAt: m.created_at,
    read: m.read,
    ...(m.join_request_id && {
      request: {
        id: m.join_request_id,
        status: m.request_status,
        campaign: { id: m.campaign_id, name: m.campaign_name },
        // The GM sees who's asking; the player already knows their own character.
        ...(m.kind === 'join-request' && {
          character: {
            name: m.character_name,
            level: m.character_level,
            className: m.class_name,
            ancestry: m.ancestry,
            portraitUrl: storage.publicUrl(m.portrait_key),
            player: m.player,
            playerAvatarUrl: storage.publicUrl(m.player_avatar_key),
          },
        }),
      },
    }),
  }));
  res.json({ messages, unread: messages.filter((m) => !m.read).length });
});

// Mark messages read: { ids: [...] }. Only your own and everyone's messages count.
inbox.post('/read', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(isId).slice(0, MAX_SHOWN).map(Number) : [];
  if (ids.length) {
    await pool.query(
      `INSERT INTO message_reads (user_id, message_id)
       SELECT $1, id FROM messages WHERE id = ANY($2::int[]) AND (user_id = $1 OR user_id IS NULL)
       ON CONFLICT DO NOTHING`,
      [req.user.id, ids],
    );
  }
  res.status(204).end();
});

// The GM answers a join request.
export const joinRequests = Router();
joinRequests.use(requireUser);

for (const [action, accept] of [['accept', true], ['reject', false]]) {
  joinRequests.post(`/:id/${action}`, async (req, res) => {
    if (!isId(req.params.id)) return res.status(404).json({ errors: ['Request not found.'] });
    const result = await decide({ requestId: req.params.id, gmUserId: req.user.id, accept, check: outsideBooks });
    if (result.notFound) return res.status(404).json({ errors: ['Request not found.'] });
    if (result.errors) return res.status(result.status ? 409 : 400).json({ errors: result.errors, status: result.status });
    res.json({ status: result.status, campaignId: result.campaignId });
  });
}
