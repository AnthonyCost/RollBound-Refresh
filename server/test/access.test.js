// The API's access checks: nobody sees or changes another person's characters or
// campaigns, party members read but don't write, and saved sheets come from the rules.
// Needs a throwaway Postgres database (it adds and removes its own users):
//   TEST_DATABASE_URL=postgres://localhost:5432/rollbound_test npm test -w server
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SAMPLE_BUILDS } from '@rollbound/rules';

const url = process.env.TEST_DATABASE_URL;
const skip = url ? false : 'set TEST_DATABASE_URL to a throwaway database';
let server, base, pool;
const users = [];

before(async () => {
  if (!url) return;
  process.env.DATABASE_URL = url;
  ({ pool } = await import('../src/db.js'));
  await pool.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  const { app } = await import('../src/index.js');
  server = app.listen(0);
  base = `http://localhost:${server.address().port}/api`;
});

after(async () => {
  if (!url) return;
  const ids = users.map((u) => u.id);
  await pool.query('DELETE FROM campaigns WHERE gm_user_id = ANY($1::int[])', [ids]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [ids]);
  server.close();
  await pool.end();
});

/** A new account, with call(method, path, body) signed in as it. */
async function signUp(name) {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ displayName: name, email: `${name}-${Date.now()}@test.invalid`, password: 'password123' }),
  });
  assert.equal(res.status, 201);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  const call = async (method, path, body) => {
    const r = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', cookie }, body: body && JSON.stringify(body) });
    return { status: r.status, body: r.status === 204 ? null : await r.json() };
  };
  const user = { id: (await res.json()).id, call };
  users.push(user);
  return user;
}

test('a saved sheet is rebuilt from its build', { skip }, async () => {
  const a = await signUp('builder');
  const made = await a.call('POST', '/characters', { build: SAMPLE_BUILDS.mira, classHp: 99, name: 'Cheat' });
  assert.equal(made.status, 201);
  assert.notEqual(made.body.data.classHp, 99);
  assert.equal(made.body.name, SAMPLE_BUILDS.mira.name);
  assert.equal((await a.call('POST', '/characters', { name: 'No build' })).status, 400);
  assert.equal((await a.call('POST', '/characters', { build: { ...SAMPLE_BUILDS.mira, name: '' } })).status, 400);
  assert.equal((await a.call('POST', '/characters', { build: { ...SAMPLE_BUILDS.mira, skills: 'all of them' } })).status, 400);
});

test("nobody can see or change another person's character", { skip }, async () => {
  const [a, b] = [await signUp('owner'), await signUp('stranger')];
  const { body: c } = await a.call('POST', '/characters', { build: SAMPLE_BUILDS.mira });
  const tries = [
    ['GET', `/characters/${c.id}`],
    ['PUT', `/characters/${c.id}`, { build: SAMPLE_BUILDS.mira }],
    ['PUT', `/characters/${c.id}/hp`, { currentHp: 1 }],
    ['PUT', `/characters/${c.id}/inventory`, { items: [], coins: { pp: 0, gp: 0, sp: 0, cp: 0 } }],
    ['PUT', `/characters/${c.id}/backstory`, { backstory: 'mine now' }],
    ['PUT', `/characters/${c.id}/prepared`, { cantrips: [], slots: [] }],
    ['PUT', `/characters/${c.id}/portrait`, { portraitKey: null }],
    ['POST', `/characters/${c.id}/share-link`],
    ['DELETE', `/characters/${c.id}`],
  ];
  for (const [method, path, body] of tries) assert.equal((await b.call(method, path, body)).status, 404, `${method} ${path}`);
  const mine = await a.call('GET', `/characters/${c.id}`);
  assert.equal(mine.status, 200);
  assert.equal(mine.body.backstory, '');
  assert.equal(mine.body.shareId, c.shareId);
});

test("nobody outside a campaign can see or change it, and players only read its logs", { skip }, async () => {
  const [gm, player, stranger] = [await signUp('gm'), await signUp('player'), await signUp('outsider')];
  const { body: camp } = await gm.call('POST', '/campaigns', { name: 'Test campaign' });
  const id = camp.id;
  const { body: log } = await gm.call('POST', `/campaigns/${id}/logs`, { title: 'One', body: 'x' });
  assert.equal((await gm.call('POST', `/campaigns/${id}/logs`, { title: 'Bad day', body: 'x', playedOn: '2026-02-30' })).status, 400);

  for (const [method, path, body] of [
    ['GET', `/campaigns/${id}`],
    ['PATCH', `/campaigns/${id}`, { name: 'Taken' }],
    ['DELETE', `/campaigns/${id}`],
    ['GET', `/campaigns/${id}/logs`],
    ['GET', `/campaigns/${id}/logs/${log.id}`],
    ['POST', `/campaigns/${id}/logs`, { title: 'Mine', body: 'x' }],
    ['GET', `/campaigns/${id}/encounters`],
  ]) {
    assert.equal((await stranger.call(method, path, body)).status, 404, `${method} ${path}`);
  }

  // The player asks to join twice at once; it's one request, and the GM accepts it.
  const { body: hero } = await player.call('POST', '/characters', { build: SAMPLE_BUILDS.mira });
  const asks = await Promise.all([1, 2].map(() => player.call('POST', '/campaigns/join', { code: camp.inviteCode, characterId: hero.id })));
  assert.deepEqual(asks.map((r) => r.status), [202, 202]);
  const { body: seen } = await gm.call('GET', `/campaigns/${id}`);
  assert.equal(seen.requests.length, 1);
  assert.equal((await stranger.call('POST', `/join-requests/${seen.requests[0].id}/accept`)).status, 404);
  assert.equal((await gm.call('POST', `/join-requests/${seen.requests[0].id}/accept`)).status, 200);

  assert.equal((await player.call('GET', `/campaigns/${id}/logs`)).status, 200);
  assert.equal((await player.call('POST', `/campaigns/${id}/logs`, { title: 'Mine', body: 'x' })).status, 403);
  assert.equal((await player.call('GET', `/campaigns/${id}/encounters`)).status, 404);
  assert.equal((await player.call('PATCH', `/campaigns/${id}`, { name: 'Taken' })).status, 404);
  assert.equal((await stranger.call('GET', `/campaigns/${id}/characters/${hero.id}`)).status, 404);
  assert.equal((await gm.call('GET', `/campaigns/${id}/characters/${hero.id}`)).status, 200);
});

test('sign-in attempts are limited', { skip }, async () => {
  const tries = [];
  for (let i = 0; i < 21; i++) {
    const r = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@test.invalid', password: 'wrong-password' }) });
    tries.push(r.status);
  }
  assert.equal(tries[0], 401);
  assert.equal(tries.at(-1), 429);
});
