import express from 'express';
import cors from 'cors';
import { characters } from './routes/characters.js';
import { auth } from './routes/auth.js';
import { campaigns } from './routes/campaigns.js';
import { uploads } from './routes/uploads.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', auth);
app.use('/api/characters', characters);
app.use('/api/campaigns', campaigns);
app.use('/api/uploads', uploads);

// Express 5 forwards rejected promises from async handlers here.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`RollBound API on http://localhost:${port}`));
