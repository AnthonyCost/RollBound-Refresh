# Database schema

RollBound's Postgres tables, from `server/db/schema.sql` (`npm run db:setup` creates or
updates them). GitHub draws the diagram below. Update it when the schema changes.

```mermaid
erDiagram
    users ||--o{ sessions : "signs in with"
    users |o--o{ users : "demo owns its pretend players"
    users |o--o{ campaigns : "runs as GM"
    users |o--o{ characters : "owns"
    campaigns |o--o{ characters : "has in its party"
    campaigns ||--o{ join_requests : "receives"
    characters ||--o{ join_requests : "asks to join with"
    campaigns ||--o{ session_logs : "is recapped in"
    campaigns ||--o{ encounters : "plans"
    users |o--o{ messages : "receives (none: everyone)"
    join_requests |o--o{ messages : "is announced by"
    users ||--o{ message_reads : "has read"
    messages ||--o{ message_reads : "is read in"

    users {
        serial id PK
        text email UK "made-up for demo accounts"
        text display_name
        text password_hash "null: can't sign in with a password"
        text avatar_key "uploaded image"
        boolean is_demo
        int demo_owner_id FK "pretend player's demo account"
        timestamptz created_at
    }
    sessions {
        text token_hash PK "SHA-256 of the cookie's token"
        int user_id FK
        timestamptz expires_at
    }
    campaigns {
        serial id PK
        text name
        int gm_user_id FK
        int party_level "1 to 20"
        text backstory
        text cover_key "uploaded image"
        text invite_code UK "permanent, like 7KQM-X4HP"
        text_list books "null: every book"
        text adventure_path "slug, null: homebrew"
        timestamptz created_at
    }
    characters {
        serial id PK
        int owner_id FK
        int campaign_id FK "one campaign at a time"
        text name
        int level "1 to 20"
        jsonb data "the sheet, with builder choices"
        text portrait_key "uploaded image"
        text share_id UK "public share link"
        jsonb inventory "items, coins, shield damage; null: builder gear"
        text backstory
        jsonb prepared "spells prepared today, null: the first known"
        int current_hp "null: full"
        timestamptz created_at
        timestamptz updated_at
    }
    join_requests {
        serial id PK
        int campaign_id FK
        int character_id FK "one pending at a time"
        text status "pending, accepted, rejected, withdrawn"
        timestamptz created_at
        timestamptz decided_at
    }
    messages {
        serial id PK
        int user_id FK "null: everyone"
        text kind "announcement, patch-notes, join-request, join-accepted, join-rejected"
        text title
        text body
        int join_request_id FK
        timestamptz created_at
    }
    encounters {
        serial id PK
        int campaign_id FK
        text name
        text notes
        int party_size "null: follow the campaign"
        int party_level "null: follow the campaign"
        jsonb creatures "bestiary id or homebrew, level, count"
        timestamptz created_at
        timestamptz updated_at
    }
    message_reads {
        int user_id PK, FK
        int message_id PK, FK
    }
    session_logs {
        serial id PK
        int campaign_id FK
        text title
        date played_on
        text body
        timestamptz created_at
        timestamptz updated_at
    }
```

## What happens on delete

| When this is deleted | These go with it | These stay, unlinked |
| --- | --- | --- |
| A user | their sessions, characters, messages, read marks, and pretend players (demo) | campaigns they ran (no GM)* |
| A campaign | its join requests, session logs, encounters, and those requests' messages | its characters (in no campaign) |
| A character | its join requests and their messages | |
| A join request | its messages | |
| A message | its read marks | |

\* Demo cleanup deletes a demo's campaigns itself, before deleting the account (`server/src/demo.js`).

## Rules that aren't foreign keys

- A character has **at most one pending join request** (a unique index on `character_id` where `status = 'pending'`).
- `campaigns.invite_code` and `characters.share_id` are unique, and `db:setup` fills them in for older rows and makes them required.
- A character's `level` and a campaign's `party_level` are 1 to 20, and `current_hp` is never negative.
- An encounter's `party_size` is 1 to 8 and its `party_level` 1 to 20 (both null to follow the campaign).
- `message_reads` covers messages for everyone too; messages for everyone from before a user signed up count as read without a row.

## Not in the database

- **Rules data** (ancestries, classes, feats, spells, items): JSON files in `packages/rules/data/`, loaded by the server and client. A character's `data` stores the IDs of what was chosen.
- **Adventure Paths**: `packages/rules/src/adventurePaths.js`. `campaigns.adventure_path` holds a slug from it.
- **Uploaded images**: in S3 (or `server/uploads/` locally). The `*_key` columns hold where each one is.
- **Inside the JSONB columns**: `characters.inventory` is `{ items, coins }`, where a shield item can carry `damage` (Hit Points lost; see `docs/shield-hit-points.md`), and `characters.prepared` is `{ cantrips, slots }` of spell ids. The rules package checks both before they're saved (`inventoryProblems`, `preparedProblems`).
- **Creatures**: `packages/rules/bestiary/`. An encounter's creatures hold a bestiary `creatureId` (or none, for homebrew) with a copy of the name and level.
