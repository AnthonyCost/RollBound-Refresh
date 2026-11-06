import { Router } from 'express';
import { pool } from '../db.js';
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  createSession,
  deleteSession,
  hashPassword,
  hashToken,
  readSessionToken,
  userForToken,
  verifyPassword,
  requireUser,
} from '../auth.js';
import { storage } from '../storage/index.js';
import { checkImageKey, swapImages } from '../images.js';
import { DEMO_HOURS, allowDemo, createDemo, deleteDemo } from '../demo.js';
import { rateLimit } from '../rateLimit.js';
import { randomBytes } from 'node:crypto';
import { sendEmail } from '../email.js';

export const auth = Router();

// The site's color themes (client/src/themes.js). Infernal is the default.
const THEMES = ['infernal', 'mirage', 'gothic', 'cosmic', 'obscure', 'luminary', 'radiant', 'tunic', 'ethereal', 'badge', 'traveler', 'judgement', 'atrophy', 'emblem', 'tarnished', 'briar', 'aurora', 'pastel'];

const toJson = (u) => ({
  id: u.id,
  // Demo accounts have a made-up address; nobody needs to see it.
  email: u.is_demo ? null : u.email,
  displayName: u.display_name,
  avatarUrl: storage.publicUrl(u.avatar_key),
  theme: THEMES.includes(u.theme) ? u.theme : 'infernal',
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
  // A welcome email, after the account is made: a failed send is logged and never stops sign-up.
  const home = `${appUrl()}/home`;
  sendEmail({
    to: email,
    subject: 'Welcome to RollBound',
    text: `Hi ${displayName},\n\nYour RollBound account is ready. Build your first hero, or join your GM's campaign with their invite code:\n\n${home}\n\nSee you at the table.`,
    html: `<p>Hi ${escapeHtml(displayName)},</p><p>Your RollBound account is ready. Build your first hero, or join your GM's campaign with their invite code.</p><p><a href="${home}">Open RollBound</a></p><p>See you at the table.</p>`,
    template: { id: process.env.RESEND_TEMPLATE_WELCOME, variables: { DISPLAY_NAME: escapeHtml(displayName), APP_URL: home } },
  }).catch((e) => console.error('Welcome email failed:', e.message));
});

/** Where links in emails point: APP_URL, without a trailing slash. */
const appUrl = () => (process.env.APP_URL ?? 'http://localhost:5173').replace(/\/+$/, '');

const RESET_MINUTES = 30;
const allowResetRequest = rateLimit(5, 60 * 60 * 1000);
const SENT = { ok: true, message: "If there's an account with that email, we've sent a link to reset its password. It works for 30 minutes." };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Forgot password: emails a single-use link. The answer is the same whether or not the
// account exists, so nobody can use this to find out who has an account.
auth.post('/forgot-password', async (req, res) => {
  if (!allowResetRequest(req.ip)) return res.status(429).json(TOO_MANY);
  const email = normalizeEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ errors: ['Enter a valid email address.'] });
  const { rows } = await pool.query('SELECT id, display_name FROM users WHERE email = $1 AND NOT is_demo AND password_hash IS NOT NULL', [email]);
  const user = rows[0];
  if (user) {
    const token = randomBytes(32).toString('base64url');
    // A new link replaces any older one that wasn't used.
    await pool.query('DELETE FROM password_resets WHERE user_id = $1', [user.id]);
    await pool.query(
      `INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3))`,
      [hashToken(token), user.id, RESET_MINUTES],
    );
    const link = `${appUrl()}/reset-password?token=${token}`;
    const name = user.display_name;
    try {
      await sendEmail({
        to: email,
        subject: 'Reset your RollBound password',
        text: `Hi ${name},\n\nSomeone (hopefully you) asked to reset your RollBound password. Open this link to choose a new one:\n\n${link}\n\nThe link works once, for ${RESET_MINUTES} minutes. If you didn't ask, ignore this email; your password hasn't changed.`,
        html: `<p>Hi ${escapeHtml(name)},</p><p>Someone (hopefully you) asked to reset your RollBound password.</p><p><a href="${link}">Choose a new password</a></p><p>The link works once, for ${RESET_MINUTES} minutes. If you didn't ask, ignore this email; your password hasn't changed.</p>`,
        // Escaped: Resend's {{{triple braces}}} put a value in the HTML as it is.
        template: { id: process.env.RESEND_TEMPLATE_PASSWORD_RESET, variables: { DISPLAY_NAME: escapeHtml(name), RESET_URL: link, EXPIRES_IN: `${RESET_MINUTES} minutes` } },
      });
    } catch (err) {
      // Logged, not shown: telling the visitor would reveal that the account exists.
      console.error('Password reset email failed:', err.message);
    }
  }
  res.json(SENT);
});

// Set a new password with a link from the email. Signs the account out everywhere else.
auth.post('/reset-password', async (req, res) => {
  if (!allowLogin(req.ip)) return res.status(429).json(TOO_MANY);
  const token = typeof req.body?.token === 'string' ? req.body.token : '';
  const password = req.body?.password;
  if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
    return res.status(400).json({ errors: ['Password must be at least 8 characters.'] });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE password_resets SET used_at = now()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING user_id`,
      [hashToken(token)],
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ errors: ['That reset link has expired or was already used. Ask for a new one.'] });
    }
    const userId = rows[0].user_id;
    const { rows: users } = await client.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING *', [await hashPassword(password), userId]);
    await client.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    await startSession(res, users[0]);
    res.json(toJson(users[0]));
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
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

// Update your profile: display name, avatar and/or color theme. avatarKey: null removes it.
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
  let theme = user.theme;
  if (req.body?.theme !== undefined) {
    if (THEMES.includes(req.body.theme)) theme = req.body.theme;
    else errors.push(`Theme must be one of: ${THEMES.join(', ')}.`);
  }
  if (errors.length) return res.status(400).json({ errors });

  const { rows } = await pool.query(
    'UPDATE users SET display_name = $1, avatar_key = $2, theme = $3 WHERE id = $4 RETURNING *',
    [displayName, avatarKey, theme, req.user.id],
  );
  await swapImages(user.avatar_key, avatarKey);
  res.json(toJson(rows[0]));
});
