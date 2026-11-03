import { Router } from 'express';
import { pool } from '../db.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSession,
  deleteSession,
  hashPassword,
  readSessionToken,
  userForToken,
  verifyPassword,
  requireUser,
} from '../auth.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';
import { DEMO_HOURS, allowDemo, createDemo, deleteDemo } from '../demo.js';
import { rateLimit } from '../rateLimit.js';

export const auth = Router();

const toJson = (u) => ({
  id: u.id,
  // Demo accounts have a made-up address; nobody needs to see it.
  email: u.is_demo ? null : u.email,
  displayName: u.display_name,
  avatarUrl: storage.publicUrl(u.avatar_key),
  isDemo: Boolean(u.is_demo),
  ...(u.is_demo && { demoExpiresAt: new Date(new Date(u.created_at).getTime() + DEMO_HOURS * 3600_000).toISOString() }),
});

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

async function startSession(res, user) {
  const token = await createSession(user.id);
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
}

// Per IP address, so a script can't guess passwords or mass-create accounts.
const allowLogin = rateLimit(20, 15 * 60 * 1000);
const allowRegister = rateLimit(10, 60 * 60 * 1000);
const TOO_MANY = { errors: ['Too many attempts from here. Wait a few minutes and try again.'] };

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

auth.post('/register', async (req, res) => {
  if (!allowRegister(req.ip)) return res.status(429).json(TOO_MANY);
  const email = normalizeEmail(req.body?.email);
  const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
  const password = req.body?.password;

  const errors = [];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Enter a valid email address.');
  if (!displayName || displayName.length > 60) errors.push('Display name must be 1–60 characters.');
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    errors.push('Password must be at least 8 characters.');
  }
  if (errors.length) return res.status(400).json({ errors });

  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING *',
      [email, displayName, await hashPassword(password)],
    );
    await startSession(res, rows[0]);
    res.status(201).json(toJson(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ errors: ['An account with that email already exists.'] });
    throw err;
  }
});

auth.post('/login', async (req, res) => {
  if (!allowLogin(req.ip)) return res.status(429).json(TOO_MANY);
  const email = normalizeEmail(req.body?.email);
  const password = req.body?.password;
  if (!email || typeof password !== 'string') {
    return res.status(400).json({ errors: ['Email and password are required.'] });
  }

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ errors: ['Incorrect email or password.'] });
  }

  await startSession(res, user);
  res.json(toJson(user));
});

// Start a demo: a temporary account of your own, with sample content (see demo.js).
auth.post('/demo', async (req, res) => {
  if (!allowDemo(req.ip)) return res.status(429).json({ errors: ['Too many demos started from here. Try again in an hour, or create an account.'] });
  const user = await createDemo();
  await startSession(res, user);
  res.status(201).json(toJson(user));
});

auth.post('/logout', async (req, res) => {
  const token = readSessionToken(req);
  // Exiting the demo deletes the demo account and everything in it.
  const user = token && (await userForToken(token));
  if (token) await deleteSession(token);
  if (user?.is_demo) await deleteDemo(user.id);
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

auth.get('/me', async (req, res) => {
  const user = await userForToken(readSessionToken(req));
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json(toJson(user));
});

// Update your profile: display name and/or avatar. avatarKey: null removes it.
auth.patch('/me', requireUser, async (req, res) => {
  const errors = [];
  const { rows: current } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
  const user = current[0];

  let displayName = user.display_name;
  if (req.body?.displayName !== undefined) {
    displayName = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
    if (!displayName || displayName.length > 60) errors.push('Display name must be 1–60 characters.');
  }

  let avatarKey = user.avatar_key;
  if (req.body?.avatarKey !== undefined) {
    const checked = await checkImageKey(req.body.avatarKey, 'avatar', req.user.id);
    if (checked.error) errors.push(checked.error);
    else avatarKey = checked.key;
  }
  if (errors.length) return res.status(400).json({ errors });

  const { rows } = await pool.query(
    'UPDATE users SET display_name = $1, avatar_key = $2 WHERE id = $3 RETURNING *',
    [displayName, avatarKey, req.user.id],
  );
  await swapImages(user.avatar_key, avatarKey);
  res.json(toJson(rows[0]));
});
