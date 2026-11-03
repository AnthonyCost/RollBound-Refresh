// Demo accounts. "Try the demo" makes a real, temporary account for each visitor,
// so the demo runs the same code as everyone else. It comes with a character of every
// class (DEMO_ROSTER); a sample campaign the visitor runs, which a pretend player Sam's
// ranger asks to join; and Sam's own campaign, where Valeros already plays and the visitor
// can ask to bring more characters, which Sam answers by himself. A GM's own characters
// can't join their campaign, so Valeros plays in Sam's. Demo accounts are deleted after DEMO_HOURS, or when the visitor
// exits the demo.
import { randomBytes } from 'node:crypto';
import { SAMPLE_BUILDS, DEMO_ROSTER, PREGENS, buildCharacter, migrateBuild } from '@rollbound/rules';
import { pool } from './db.js';
import { storage } from './storage/index.js';
import { rulesData } from './rules.js';
import { generateInviteCode } from './inviteCode.js';
import { generateShareId } from './shareId.js';
import { decide, requestJoin } from './joinRequests.js';
import { rateLimit } from './rateLimit.js';

export const DEMO_HOURS = 24;
/** How long Sam takes to answer a request to his campaign. */
const BOT_DELAY_SECONDS = 5;
const CLEANUP_EVERY_MS = 60 * 60 * 1000;
// Demo accounts per IP address per hour, so a script can't fill the database.
const DEMOS_PER_HOUR = 20;

// Demo characters' portraits, by name: each pregen's own headshot (see storage/index.js).
// Kestrel, an elf ranger, borrows Merisiel's.
const STOCK_PORTRAITS = {
  ...Object.fromEntries(PREGENS.map((p) => [p.name, `stock/${p.slug}.webp`])),
  Kestrel: 'stock/merisiel.webp',
};

const fakeEmail = (tag) => `demo-${randomBytes(8).toString('hex')}${tag}@demo.invalid`;

const WELCOME = (vaultCode) => `This is a temporary demo account. Everything in it is deleted after ${DEMO_HOURS} hours, or when you exit the demo.

You run Wolves at the Ford. Sam, a pretend player, has asked to bring his ranger Kestrel into it: accept or reject the request above.

Sam runs a campaign too, The Sunken Vault, and your fighter Valeros is already in its party. Its invite code is ${vaultCode}. Enter it on the Campaigns page to ask to bring another of your characters; Sam answers within a few seconds.`;

/** Creates a demo account with its sample content. Returns the user row. */
export async function createDemo() {
  const data = rulesData();
  const sheet = (build) => buildCharacter(migrateBuild(build, data), data);
  const client = await pool.connect();
  let user, sam, wolves, kestrel;
  try {
    await client.query('BEGIN');
    [user] = (await client.query("INSERT INTO users (email, display_name, is_demo) VALUES ($1, 'Traveler', true) RETURNING *", [fakeEmail('')])).rows;
    [sam] = (await client.query("INSERT INTO users (email, display_name, is_demo, demo_owner_id) VALUES ($1, 'Sam', true, $2) RETURNING *", [fakeEmail('-sam'), user.id])).rows;
    const campaign = async (gm, name, backstory) =>
      (await client.query('INSERT INTO campaigns (name, backstory, gm_user_id, party_level, invite_code) VALUES ($1, $2, $3, 1, $4) RETURNING *', [name, backstory, gm.id, generateInviteCode()])).rows[0];
    wolves = await campaign(user, 'Wolves at the Ford', 'A pack of wolves has been harrying travelers at the river crossing outside town. The ferryman swears they hunt like soldiers.');
    const vault = await campaign(sam, 'The Sunken Vault', 'Beneath the drowned chapel lies a vault no one has opened in three hundred years. Sam is gathering a party to open it.');
    const character = async (owner, build, campaignId) => {
      const c = sheet(build);
      return (await client.query('INSERT INTO characters (owner_id, campaign_id, name, level, data, share_id, portrait_key) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [owner.id, campaignId, c.name, c.level, c, generateShareId(), STOCK_PORTRAITS[c.name] ?? null])).rows[0];
    };
    const [valeros, ...heroes] = DEMO_ROSTER;
    await character(user, valeros, vault.id);
    for (const build of heroes) await character(user, build, null);
    kestrel = await character(sam, SAMPLE_BUILDS.kestrel, null);
    await client.query("INSERT INTO messages (user_id, kind, title, body) VALUES ($1, 'announcement', 'Welcome to the RollBound demo', $2)", [user.id, WELCOME(vault.invite_code)]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  // After the welcome, so it shows at the top of the inbox.
  await requestJoin({ campaign: wolves, character: kestrel, player: 'Sam' });
  return user;
}

/** The demo account a user belongs to (themselves, or the visitor a pretend player came with), or null. */
export async function demoWorld(userId) {
  const { rows } = await pool.query('SELECT id, is_demo, demo_owner_id FROM users WHERE id = $1', [userId]);
  const u = rows[0];
  return u?.is_demo ? (u.demo_owner_id ?? u.id) : null;
}

/**
 * Demo accounts only mix with themselves: a demo visitor can only ask to join
 * their own demo's campaigns, and nobody else can join a demo campaign.
 */
export async function canJoin(userId, gmUserId) {
  const [mine, theirs] = await Promise.all([demoWorld(userId), demoWorld(gmUserId)]);
  return mine === theirs;
}

/** Sam (and any pretend player) accepts requests to his campaigns after a few seconds. */
export async function answerBotRequests(requesterId) {
  const { rows } = await pool.query(
    `SELECT jr.id, c.gm_user_id
     FROM join_requests jr
     JOIN campaigns c ON c.id = jr.campaign_id
     JOIN users gm ON gm.id = c.gm_user_id
     JOIN characters ch ON ch.id = jr.character_id
     WHERE jr.status = 'pending' AND ch.owner_id = $1 AND gm.demo_owner_id IS NOT NULL
       AND jr.created_at < now() - make_interval(secs => ${BOT_DELAY_SECONDS})`,
    [requesterId],
  );
  for (const r of rows) await decide({ requestId: r.id, gmUserId: r.gm_user_id, accept: true, check: () => [] });
}

/** Deletes a demo account, its pretend players, and everything they made, including uploads. */
export async function deleteDemo(userId) {
  const { rows: people } = await pool.query('SELECT id, avatar_key FROM users WHERE is_demo AND (id = $1 OR demo_owner_id = $1)', [userId]);
  if (!people.length) return;
  const ids = people.map((p) => p.id);
  const { rows: portraits } = await pool.query('SELECT portrait_key AS key FROM characters WHERE owner_id = ANY($1::int[]) AND portrait_key IS NOT NULL', [ids]);
  const { rows: covers } = await pool.query('DELETE FROM campaigns WHERE gm_user_id = ANY($1::int[]) RETURNING cover_key AS key', [ids]);
  // Characters, sessions, messages and requests go with the users (ON DELETE CASCADE).
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
  const keys = [...people.map((p) => p.avatar_key), ...portraits.map((p) => p.key), ...covers.map((c) => c.key)].filter(Boolean);
  for (const key of keys) await storage.deleteObject(key).catch(() => {});
}

/** Deletes demo accounts older than DEMO_HOURS. Returns how many. */
export async function deleteExpiredDemos() {
  const { rows } = await pool.query(
    `SELECT id FROM users WHERE is_demo AND demo_owner_id IS NULL AND created_at < now() - make_interval(hours => ${DEMO_HOURS})`,
  );
  for (const { id } of rows) await deleteDemo(id);
  return rows.length;
}

/** Runs the cleanup now and every hour: expired demos, and expired sign-ins so the sessions table doesn't grow forever. */
export function scheduleDemoCleanup() {
  const run = async () => {
    try {
      const n = await deleteExpiredDemos();
      if (n) console.log(`Deleted ${n} expired demo account(s)`);
      await pool.query('DELETE FROM sessions WHERE expires_at < now()');
    } catch (err) {
      console.error('Cleanup failed:', err.message);
    }
  };
  run();
  setInterval(run, CLEANUP_EVERY_MS).unref();
}

/** Whether this IP address may start another demo; counts it if so. */
export const allowDemo = rateLimit(DEMOS_PER_HOUR, 60 * 60 * 1000);
