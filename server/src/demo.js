// Demo accounts. "Try the demo" makes a real, temporary account for each visitor, so the demo
// runs the same code as everyone else. It comes with a character of every class (DEMO_ROSTER)
// and a small table of pretend players (PLAYERS): Sam, Priya, Marcus and Elena.
//   - Wolves at the Ford, which the visitor runs: Sam's Clay (Valeros's build, a fighter with a
//     shield, for trying the encounter tracker), Priya's Kyra and Marcus's Merisiel already play; Sam asks
//     to bring his ranger Kestrel and Priya her Lini; two sessions are logged.
//   - The Sunken Vault (Sam's) and The Lantern Road (Elena's), where the visitor's Valeros and
//     Ezren already play beside the others, each with its own session logs.
// The visitor can ask to bring more characters to the pretend players' campaigns, and they
// answer by themselves. A GM's own characters can't join their campaign. Demo accounts are
// deleted after DEMO_HOURS, or when the visitor exits the demo.
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
// Kestrel, an elf ranger, borrows Merisiel's, and Sam's fighter Clay (Valeros's build) Valeros's.
const STOCK_PORTRAITS = {
  ...Object.fromEntries(PREGENS.map((p) => [p.name, `stock/${p.slug}.webp`])),
  Kestrel: 'stock/merisiel.webp',
  Clay: 'stock/valeros.webp',
};

// The pretend players, and which of the visitor's campaigns each one's characters play in.
const PLAYERS = ['Sam', 'Priya', 'Marcus', 'Elena'];

// Each campaign's sessions so far: [days ago, title, what happened].
const LOGS = {
  wolves: [
    [13, 'The Ferryman’s Warning', 'The party met Old Hesk at the crossing. He refused to take anyone over after dark and showed them the claw marks gouged into his raft: four parallel lines, too evenly spaced for any wolf.\n\nKyra tended a wounded drover who swore the pack had circled his cart in formation, then simply let him go.'],
    [6, 'Tracks in the Reeds', 'Merisiel followed the trail into the reed beds and found a camp: cold fire, iron stakes, and a collar sized for something much larger than a dog. Clay held the ford while the wolves tested the line, three times, and broke off each time a horn sounded from the hills.\n\nSomeone is training them. The party plans to find the horn.'],
  ],
  vault: [
    [20, 'Down the Bell Tower', 'The drowned chapel’s bell tower was the only way in. Harsk anchored the rope, Seoni lit the way with a dancing light, and Valeros went first, which is how he met the eels.'],
    [12, 'The Choir Below', 'A flooded nave, pews still in rows under the water, and voices singing a hymn nobody has sung in three hundred years. Seoni recognized the tune from a lullaby her mother sang. The singing stopped the moment she hummed along.'],
    [5, 'The Vault Door', 'Seven locks, seven saints, and a riddle carved in the old tongue. The party solved five before the water began to rise. They retreated with the sixth saint’s name and a very wet map.'],
  ],
  lantern: [
    [9, 'A Lantern That Will Not Go Out', 'Elena’s caravan hired the party to carry a lantern from Brightmoor to the coast without letting it gutter. Ezren identified the flame as something older than fire. Lem wrote a song about it before anyone could stop him.'],
  ],
};

const fakeEmail = (tag) => `demo-${randomBytes(8).toString('hex')}${tag}@demo.invalid`;

const WELCOME = (vaultCode, lanternCode) => `This is a temporary demo account. Everything in it is deleted after ${DEMO_HOURS} hours, or when you exit the demo.

Sam, Priya, Marcus and Elena are pretend players, here so you can see a table in motion.

You run Wolves at the Ford. Sam's Clay (a fighter with a shield, to try your encounters on), Priya's Kyra and Marcus's Merisiel already play there, and two sessions are logged. Sam has asked to bring his ranger Kestrel, and Priya her druid Lini: accept or reject their requests above.

You also play in two campaigns. Sam runs The Sunken Vault, where your Valeros plays (invite code ${vaultCode}). Elena runs The Lantern Road, where your Ezren plays (invite code ${lanternCode}). Enter a code on the Campaigns page to ask to bring another of your characters; they answer within a few seconds.`;

/** Creates a demo account with its sample content. Returns the user row. */
export async function createDemo() {
  const data = rulesData();
  const sheet = (build) => buildCharacter(migrateBuild(build, data), data);
  const client = await pool.connect();
  let user, wolves, requests;
  try {
    await client.query('BEGIN');
    [user] = (await client.query("INSERT INTO users (email, display_name, is_demo) VALUES ($1, 'Traveler', true) RETURNING *", [fakeEmail('')])).rows;
    const people = {};
    for (const name of PLAYERS) {
      [people[name]] = (await client.query('INSERT INTO users (email, display_name, is_demo, demo_owner_id) VALUES ($1, $2, true, $3) RETURNING *', [fakeEmail(`-${name.toLowerCase()}`), name, user.id])).rows;
    }
    const campaign = async (gm, name, backstory, logs) => {
      const [c] = (await client.query('INSERT INTO campaigns (name, backstory, gm_user_id, party_level, invite_code) VALUES ($1, $2, $3, 1, $4) RETURNING *', [name, backstory, gm.id, generateInviteCode()])).rows;
      for (const [daysAgo, title, body] of logs) {
        await client.query('INSERT INTO session_logs (campaign_id, title, played_on, body) VALUES ($1, $2, current_date - $3::int, $4)', [c.id, title, daysAgo, body]);
      }
      return c;
    };
    wolves = await campaign(user, 'Wolves at the Ford', 'A pack of wolves has been harrying travelers at the river crossing outside town. The ferryman swears they hunt like soldiers.', LOGS.wolves);
    const vault = await campaign(people.Sam, 'The Sunken Vault', 'Beneath the drowned chapel lies a vault no one has opened in three hundred years. Sam is gathering a party to open it.', LOGS.vault);
    const lantern = await campaign(people.Elena, 'The Lantern Road', 'A caravan carries a lantern that must never go out, from the mountain town of Brightmoor to the sea. Whatever burns inside it is waking up.', LOGS.lantern);
    const character = async (owner, build, campaignId) => {
      const c = sheet(build);
      return (await client.query('INSERT INTO characters (owner_id, campaign_id, name, level, data, share_id, portrait_key) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [owner.id, campaignId, c.name, c.level, c, generateShareId(), STOCK_PORTRAITS[c.name] ?? null])).rows[0];
    };
    const hero = (name) => DEMO_ROSTER.find((b) => b.name === name);
    // The visitor's whole roster; Valeros plays in Sam's campaign and Ezren in Elena's.
    const seats = { Valeros: vault.id, Ezren: lantern.id };
    for (const build of DEMO_ROSTER) await character(user, build, seats[build.name] ?? null);
    // The pretend players' characters: in the visitor's campaign, in each other's, and two waiting to ask.
    await character(people.Sam, { ...hero('Valeros'), name: 'Clay' }, wolves.id);
    await character(people.Priya, hero('Kyra'), wolves.id);
    await character(people.Marcus, hero('Merisiel'), wolves.id);
    await character(people.Priya, hero('Seoni'), vault.id);
    await character(people.Marcus, hero('Harsk'), vault.id);
    await character(people.Marcus, hero('Lem'), lantern.id);
    await character(people.Sam, hero('Seelah'), lantern.id);
    requests = [
      { character: await character(people.Sam, SAMPLE_BUILDS.kestrel, null), player: 'Sam' },
      { character: await character(people.Priya, hero('Lini'), null), player: 'Priya' },
    ];
    await client.query("INSERT INTO messages (user_id, kind, title, body) VALUES ($1, 'announcement', 'Welcome to the RollBound demo', $2)", [user.id, WELCOME(vault.invite_code, lantern.invite_code)]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  // After the welcome, so they show at the top of the inbox.
  for (const r of requests) await requestJoin({ campaign: wolves, ...r });
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
