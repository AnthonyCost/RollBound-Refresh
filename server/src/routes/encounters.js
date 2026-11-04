import { Router } from 'express';
import { pool } from '../db.js';

// A campaign's saved encounters. Only its GM can see or change them. Mounted under
// /api/campaigns/:id/encounters, after requireUser.
export const encounters = Router({ mergeParams: true });

export const ENCOUNTER_LIMITS = { name: 80, notes: 5000, creatures: 40, count: 20, creatureName: 80, combatants: 200 };
const isId = (s) => /^\d{1,9}$/.test(String(s));

const toJson = (row) => ({
  id: row.id,
  name: row.name,
  notes: row.notes,
  partySize: row.party_size,
  partyLevel: row.party_level,
  creatures: row.creatures,
  state: row.state,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

/** Checks an encounter from the client. Returns { errors } or the clean values. */
function validEncounter(body) {
  const L = ENCOUNTER_LIMITS;
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
  if (!name || name.length > L.name) errors.push(`Name must be 1–${L.name} characters.`);
  if (notes.length > L.notes) errors.push(`Notes must be ${L.notes.toLocaleString('en-US')} characters or fewer.`);
  const size = body?.partySize ?? null;
  const level = body?.partyLevel ?? null;
  if (size !== null && !(Number.isInteger(size) && size >= 1 && size <= 8)) errors.push('Party size must be 1 to 8, or automatic.');
  if (level !== null && !(Number.isInteger(level) && level >= 1 && level <= 20)) errors.push('Party level must be 1 to 20, or automatic.');
  const list = body?.creatures;
  if (!Array.isArray(list) || list.length > L.creatures) errors.push(`An encounter can have up to ${L.creatures} kinds of creature.`);
  const creatures = (Array.isArray(list) ? list : []).map((c, i) => {
    const at = `Creature ${i + 1}`;
    const cname = typeof c?.name === 'string' ? c.name.trim() : '';
    if (!cname || cname.length > L.creatureName) errors.push(`${at}: name must be 1–${L.creatureName} characters.`);
    if (!Number.isInteger(c?.level) || c.level < -1 || c.level > 25) errors.push(`${at}: level must be −1 to 25.`);
    if (!Number.isInteger(c?.count) || c.count < 1 || c.count > L.count) errors.push(`${at}: count must be 1 to ${L.count}.`);
    if (c?.creatureId != null && (typeof c.creatureId !== 'string' || c.creatureId.length > 64)) errors.push(`${at}: unknown bestiary creature.`);
    if (typeof c?.key !== 'string' || !c.key || c.key.length > 40) errors.push(`${at} needs a key.`);
    return { key: c?.key, creatureId: c?.creatureId ?? null, name: cname, level: c?.level, count: c?.count };
  });
  return errors.length ? { errors: errors.slice(0, 5) } : { name, notes, partySize: size, partyLevel: level, creatures };
}

const isInt = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const intOrNull = (n, min, max) => n === null || n === undefined || isInt(n, min, max);

/** Checks a running encounter's state from the GM's tracker (see rules encounter.js). Returns { errors } or the clean state. */
function validState(body) {
  const L = ENCOUNTER_LIMITS;
  const list = body?.combatants;
  if (!isInt(body?.round, 1, 9999)) return { errors: ['Round must be 1 or more.'] };
  if (!Array.isArray(list) || !list.length || list.length > L.combatants) return { errors: [`An encounter needs 1 to ${L.combatants} combatants.`] };
  const errors = [];
  const combatants = list.map((c, i) => {
    const at = `Combatant ${i + 1}`;
    const name = typeof c?.name === 'string' ? c.name.trim() : '';
    if (typeof c?.key !== 'string' || !c.key || c.key.length > 60) errors.push(`${at} needs a key.`);
    if (!['creature', 'pc'].includes(c?.kind)) errors.push(`${at}: kind must be creature or pc.`);
    if (!name || name.length > L.creatureName) errors.push(`${at}: name must be 1–${L.creatureName} characters.`);
    if (!intOrNull(c?.initiative, -50, 200)) errors.push(`${at}: initiative must be a whole number.`);
    if (!intOrNull(c?.perception, -20, 100)) errors.push(`${at}: Perception must be a whole number.`);
    if (!intOrNull(c?.hp, -9999, 99999) || !intOrNull(c?.maxHp, 0, 99999) || !intOrNull(c?.ac, 0, 100)) errors.push(`${at}: HP and AC must be whole numbers.`);
    if (c?.characterId != null && !isId(c.characterId)) errors.push(`${at}: unknown character.`);
    if (c?.creatureId != null && (typeof c.creatureId !== 'string' || c.creatureId.length > 64)) errors.push(`${at}: unknown bestiary creature.`);
    return {
      key: c?.key, kind: c?.kind, name,
      initiative: c?.initiative ?? null, perception: c?.perception ?? 0, hp: c?.hp ?? null, maxHp: c?.maxHp ?? null, ac: c?.ac ?? null,
      defeated: Boolean(c?.defeated), characterId: c?.characterId ?? null, creatureId: c?.creatureId ?? null,
    };
  });
  if (new Set(combatants.map((c) => c.key)).size !== combatants.length) errors.push('Each combatant needs its own key.');
  const current = body?.current ?? null;
  if (current !== null && !combatants.some((c) => c.key === current)) errors.push("Whose turn it is must be one of the combatants.");
  return errors.length ? { errors: errors.slice(0, 5) } : { state: { round: body.round, current, combatants } };
}

encounters.param('encounterId', (req, res, next, value) => (isId(value) ? next() : res.status(404).json({ errors: ['Encounter not found.'] })));

// Only the campaign's GM, for everything.
encounters.use(async (req, res, next) => {
  if (!isId(req.params.id)) return res.status(404).json({ errors: ['Campaign not found.'] });
  const { rows } = await pool.query('SELECT 1 FROM campaigns WHERE id = $1 AND gm_user_id = $2', [req.params.id, req.user.id]);
  if (!rows.length) return res.status(404).json({ errors: ['Campaign not found.'] });
  next();
});

encounters.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM encounters WHERE campaign_id = $1 ORDER BY updated_at DESC', [req.params.id]);
  res.json(rows.map(toJson));
});

encounters.get('/:encounterId', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM encounters WHERE id = $1 AND campaign_id = $2', [req.params.encounterId, req.params.id]);
  if (!rows.length) return res.status(404).json({ errors: ['Encounter not found.'] });
  res.json(toJson(rows[0]));
});

encounters.post('/', async (req, res) => {
  const e = validEncounter(req.body);
  if (e.errors) return res.status(400).json({ errors: e.errors });
  const { rows } = await pool.query(
    'INSERT INTO encounters (campaign_id, name, notes, party_size, party_level, creatures) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [req.params.id, e.name, e.notes, e.partySize, e.partyLevel, JSON.stringify(e.creatures)],
  );
  res.status(201).json(toJson(rows[0]));
});

encounters.put('/:encounterId', async (req, res) => {
  const e = validEncounter(req.body);
  if (e.errors) return res.status(400).json({ errors: e.errors });
  const { rows } = await pool.query(
    `UPDATE encounters SET name = $1, notes = $2, party_size = $3, party_level = $4, creatures = $5, updated_at = now()
     WHERE id = $6 AND campaign_id = $7 RETURNING *`,
    [e.name, e.notes, e.partySize, e.partyLevel, JSON.stringify(e.creatures), req.params.encounterId, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ errors: ['Encounter not found.'] });
  res.json(toJson(rows[0]));
});

// Run the encounter: save the tracker's live state (starting it, or any change after).
encounters.put('/:encounterId/state', async (req, res) => {
  const v = validState(req.body);
  if (v.errors) return res.status(400).json({ errors: v.errors });
  const { rows } = await pool.query(
    'UPDATE encounters SET state = $1 WHERE id = $2 AND campaign_id = $3 RETURNING *',
    [JSON.stringify(v.state), req.params.encounterId, req.params.id],
  );
  if (!rows.length) return res.status(404).json({ errors: ['Encounter not found.'] });
  res.json(toJson(rows[0]));
});

// End the encounter: it stays saved, ready to run again.
encounters.delete('/:encounterId/state', async (req, res) => {
  const { rows } = await pool.query('UPDATE encounters SET state = NULL WHERE id = $1 AND campaign_id = $2 RETURNING *', [req.params.encounterId, req.params.id]);
  if (!rows.length) return res.status(404).json({ errors: ['Encounter not found.'] });
  res.json(toJson(rows[0]));
});

encounters.delete('/:encounterId', async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM encounters WHERE id = $1 AND campaign_id = $2', [req.params.encounterId, req.params.id]);
  if (!rowCount) return res.status(404).json({ errors: ['Encounter not found.'] });
  res.status(204).end();
});
