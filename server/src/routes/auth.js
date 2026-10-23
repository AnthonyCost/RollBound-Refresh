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
} from '../auth.js';

export const auth = Router();

const toJson = (u) => ({ id: u.id, email: u.email, displayName: u.display_name });

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

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

auth.post('/register', async (req, res) => {
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

auth.post('/logout', async (req, res) => {
  const token = readSessionToken(req);
  if (token) await deleteSession(token);
  res.clearCookie(SESSION_COOKIE, cookieOptions);
  res.status(204).end();
});

auth.get('/me', async (req, res) => {
  const user = await userForToken(readSessionToken(req));
  if (!user) return res.status(401).json({ error: 'Not signed in' });
  res.json(toJson(user));
});
