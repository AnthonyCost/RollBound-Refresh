-- RollBound schema (Postgres)

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Nullable so seeded/demo users without a login still fit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Only a SHA-256 of the session token is stored, so a leaked table can't be replayed.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS campaigns (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  gm_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  party_level INTEGER NOT NULL DEFAULT 1 CHECK (party_level BETWEEN 1 AND 20),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Character data lives in JSONB so the shape can grow with the rules engine
-- (feats, spells, inventory) without a migration for every field. The columns
-- pulled out alongside it are the ones we filter or sort on.
CREATE TABLE IF NOT EXISTS characters (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  level       INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 20),
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS characters_campaign_idx ON characters (campaign_id);
CREATE INDEX IF NOT EXISTS characters_owner_idx ON characters (owner_id);
