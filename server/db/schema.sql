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

-- Campaign details. invite_code is backfilled and made NOT NULL by db/setup.js,
-- since existing rows need codes generated in application code.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS backstory TEXT NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cover_key TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS invite_code TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_invite_code_idx ON campaigns (invite_code);
CREATE INDEX IF NOT EXISTS campaigns_gm_idx ON campaigns (gm_user_id);

-- Uploaded images, stored as object keys (the file lives in S3 or server/uploads).
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT;

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

ALTER TABLE characters ADD COLUMN IF NOT EXISTS portrait_key TEXT;

-- The id in a character's share link (/sheets/:shareId); anyone with the link can
-- view the sheet. Filled in for older characters by db:setup.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS share_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS characters_share_idx ON characters (share_id);
-- What the character carries and their coins (see inventory.js in the rules), with
-- any damage to a shield (docs/shield-hit-points.md). NULL until first edited: the
-- sheet starts from the builder's gear.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS inventory JSONB;
-- The player's own backstory for the character, shown on its Lore tab.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory TEXT NOT NULL DEFAULT '';
-- Spells prepared today, for casters who prepare from the spells they know (see
-- spells.js in the rules). NULL until first changed: the first ones they know.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS prepared JSONB;
-- Hit points right now. NULL means full.
ALTER TABLE characters ADD COLUMN IF NOT EXISTS current_hp INTEGER CHECK (current_hp >= 0);

CREATE INDEX IF NOT EXISTS characters_campaign_idx ON characters (campaign_id);
CREATE INDEX IF NOT EXISTS characters_owner_idx ON characters (owner_id);

-- The books a campaign allows. NULL means every book, including ones added later;
-- otherwise a list of book titles (always including Player Core).
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS books TEXT[];

-- A request to bring a character into a campaign, made with its invite code. The
-- GM accepts (the character joins) or rejects it. A character has at most one
-- pending request; asking somewhere else withdraws the old one.
CREATE TABLE IF NOT EXISTS join_requests (
  id           SERIAL PRIMARY KEY,
  campaign_id  INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS join_requests_one_pending ON join_requests (character_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS join_requests_campaign_idx ON join_requests (campaign_id);

-- The inbox. user_id NULL is for everyone (announcements, patch notes, posted with
-- npm run inbox:post); otherwise it's one user's (a join request and its answer).
CREATE TABLE IF NOT EXISTS messages (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('announcement', 'patch-notes', 'join-request', 'join-accepted', 'join-rejected')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL DEFAULT '',
  join_request_id INTEGER REFERENCES join_requests(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_user_idx ON messages (user_id, created_at DESC);

-- Which messages each user has read.
CREATE TABLE IF NOT EXISTS message_reads (
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, message_id)
);

-- Demo accounts: "Try the demo" makes a temporary account per visitor (src/demo.js).
-- demo_owner_id marks the pretend players that come with one (Sam), so deleting
-- the demo deletes them too. Demo accounts are deleted after a day, or on exit.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS demo_owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS users_demo_idx ON users (created_at) WHERE is_demo AND demo_owner_id IS NULL;

-- Session logs: the GM's write-ups of each session, read by the campaign's party.
-- They belong to their campaign and go with it.
CREATE TABLE IF NOT EXISTS session_logs (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  played_on   DATE,
  body        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_logs_campaign_idx ON session_logs (campaign_id, played_on DESC, created_at DESC);

-- The Adventure Path a campaign runs (a slug from adventurePaths.js in the rules),
-- or NULL for homebrew. Set when the campaign is created.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS adventure_path TEXT;

-- Encounters a campaign's GM builds and saves. party_size and party_level NULL mean
-- "follow the campaign" (its characters and their levels). creatures is a list of
-- { key, creatureId (a bestiary id, or null for a homebrew one), name, level, count }.
CREATE TABLE IF NOT EXISTS encounters (
  id          SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  party_size  INTEGER CHECK (party_size BETWEEN 1 AND 8),
  party_level INTEGER CHECK (party_level BETWEEN 1 AND 20),
  creatures   JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS encounters_campaign_idx ON encounters (campaign_id, updated_at DESC);
