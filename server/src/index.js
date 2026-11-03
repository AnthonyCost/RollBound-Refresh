import express from 'express';
import { fileURLToPath } from 'node:url';
import { characters } from './routes/characters.js';
import { auth } from './routes/auth.js';
import { campaigns } from './routes/campaigns.js';
import { sheets } from './routes/sheets.js';
import { inbox, joinRequests } from './routes/inbox.js';
import { scheduleDemoCleanup } from './demo.js';
import { uploads } from './routes/uploads.js';

export const app = express();
// Behind a load balancer or proxy, TRUST_PROXY is how many sit in front, so req.ip is the
// visitor's address (the rate limits count by it). Unset, nothing in front is trusted.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/characters', characters);
app.use('/api/campaigns', campaigns);
app.use('/api/sheets', sheets);
app.use('/api/inbox', inbox);
app.use('/api/join-requests', joinRequests);
app.use('/api/uploads', uploads);

// Express 5 forwards rejected promises from async handlers here.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

// Run directly, it serves; imported (by the tests), it only builds the app. (import.meta.main needs Node 24.)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3001);
  scheduleDemoCleanup();
  app.listen(port, () => console.log(`RollBound API on http://localhost:${port}`));
}
