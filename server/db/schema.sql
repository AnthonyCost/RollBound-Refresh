-- RollBound schema (Postgres)

CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
