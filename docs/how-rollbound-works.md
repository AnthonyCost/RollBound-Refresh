# How RollBound works

A guide to the whole project: what each part does, how the parts talk to each other, and why the code is shaped the way it is. Read it top to bottom once, then use it as a map.

Related guides:

- [database-schema.md](database-schema.md): the tables, drawn out.
- [HANDOFF.md](HANDOFF.md): the history of how each feature was built, with the details found along the way.
- [render-deployment.md](render-deployment.md) and [render-upkeep.md](render-upkeep.md): running it live.
- The setup guides for [S3](aws-s3-setup.md), [email](password-reset-email-setup.md), [art](adding-art.md) and the [PDF sheet](character-sheet-pdf.md).

---

## Contents

1. [The big picture](#1-the-big-picture)
2. [Where everything lives](#2-where-everything-lives)
3. [The rules engine (`packages/rules`)](#3-the-rules-engine-packagesrules)
4. [The rules data](#4-the-rules-data)
5. [The server (`server`)](#5-the-server-server)
6. [The client (`client`)](#6-the-client-client)
7. [Four journeys through the code](#7-four-journeys-through-the-code)
8. [Why it's built this way](#8-why-its-built-this-way)
9. [Testing](#9-testing)
10. [How to change common things](#10-how-to-change-common-things)
11. [Known limits and shortcuts](#11-known-limits-and-shortcuts)

---

## 1. The big picture

RollBound is a Pathfinder Second Edition (Remaster) companion for a table: players build and play characters, GMs run campaigns and encounters, and everyone can look up rules, spells, creatures and gear. Its one idea is that **it teaches while you play**: every number can be opened to show where it comes from, every roll says what it means, and every step of the builder explains its rule.

It's a PERN app (Postgres, Express, React, Node) split into three packages, in one repository (an npm workspace):

```
              ┌───────────────────────────────┐
              │  packages/rules               │  The rules of the game, as pure functions,
              │  (shared, no dependencies)    │  plus all the game data as JSON files
              └───────────────┬───────────────┘
                     imported by both
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌──────────────────────────┐       ┌──────────────────────────┐
│  client (React + Vite)   │ /api  │  server (Express)        │──── Postgres
│  what people see and     │──────▶│  accounts, saving,       │──── S3 (images)
│  click; does the math    │◀──────│  permissions, checks     │──── Resend (email)
│  live as you play        │ JSON  │  the math again          │
└──────────────────────────┘       └──────────────────────────┘
```

The design rests on that shared middle box. **The rules exist once.** The client uses them to show a sheet instantly as you change things. The server uses the same functions to rebuild and check every character it saves, so nobody can save a sheet with made-up numbers. Neither side has its own copy of the math to drift out of sync.

In production, one Node process (the server) also serves the built client, so the whole site is one address (see [section 5](#5-the-server-server)). In development they run separately: Vite serves the client on port 5173 and forwards `/api` to the server on port 3001 (`client/vite.config.js`).

---

## 2. Where everything lives

```
packages/rules/
  src/            The engine: one file per area of the rules (see section 3)
  data/           Character-creation data from Foundry VTT: <book>/<type>.json + index.json
  books/          Books Foundry doesn't have, converted from the Archives of Nethys
  corrections/    Per-book fixes for rules Foundry only encodes in its own code
  bestiary/       Monster Core 1 and 2, from the Archives of Nethys
  armory/         Every item, from the Archives of Nethys
  glossary/       Rules, conditions, traits and basic actions, from the Archives of Nethys
  pregens/        The iconic heroes, transcribed from Paizo's sheets
  scripts/        Importers that write the folders above
  test/           The rules tests, including the build sweep

server/
  src/index.js    The Express app: routes, error handler, serving the built client
  src/routes/     One file per area of the API
  src/storage/    Image storage: a local-disk driver and an S3 driver, same interface
  src/            Sessions (auth.js), demo accounts, email, join requests, rate limits
  db/             schema.sql, seed.sql, setup.js and one-off migrations
  test/           API access tests (need a throwaway database)

client/
  src/App.jsx     Every route, and who may see it
  src/pages/      One file per screen (some hold a few related screens)
  src/components/ Shared pieces: top bar, drawers, dice, pickers, the book layout
  src/builder/    The character builder's steps
  src/state/      Data the screens share: sign-in, the character in play, loaders
  src/sheet/      The PDF character sheet export, and the sheet's rules explanations
  src/learn/      The Learning the Game lessons, as data
  src/assets/     Art, fonts, the logo
  src/theme.css   Every style and every color theme
  src/motion.css  Animations
  scripts/        Art importers, the icon builder, the PDF field mapper
  public/         Files served as they are: favicon, pregen PDFs, stock portraits

infra/aws/        S3 bucket, CORS, lifecycle and IAM policy files
docs/             These guides
```

---

## 3. The rules engine (`packages/rules`)

### Why pure functions

Everything in `packages/rules/src/` is a **pure function**: it takes data in and returns data out, with no database, no network, no React and no dependencies. That buys three things:

- **The client and the server can share it.** The same file runs in a browser and in Node.
- **It's easy to test.** A test calls a function and checks the answer, with nothing to set up.
- **The sheet is always rebuildable.** Nothing is stored that can't be worked out again from the player's choices.

### Builds and sheets: the central idea

A character exists in two forms:

| | What it is | Where it's kept |
| --- | --- | --- |
| **The build** | The player's *choices*: which ancestry, which feats, which boosts, by ID | Saved, inside `characters.data.build` |
| **The sheet** | Every number on the character: HP, AC, saves, skills, strikes, spell DC | Worked out from the build, and saved alongside it |

`buildCharacter(build, data)` in `builder.js` turns a build plus the rules data into a sheet. `buildProblems(build, data)` lists what's missing or invalid, each tied to the builder step that fixes it. The builder shows the problems, the Review step refuses to save while there are any, and the server runs the same check again before saving.

Because the sheet is *derived*, a fix to the rules or the data reaches every character: rebuild it and the numbers update.

### Numbers that explain themselves

Statistics come back as `{ total, parts }`, not a bare number. `armorClass(character)` returns something like:

```js
{ total: 18, parts: [
  { label: 'Base', value: 10 },
  { label: 'Dexterity', value: 1, note: 'capped by armor' },
  { label: 'Proficiency (Trained)', value: 3 },
  { label: 'Hide Armor', value: 3 },
  { label: 'Raised shield', value: 2 },
]}
```

The sheet shows `total`, and the details drawer lists `parts`. That's how "every number shows its math" works: the math is in the data, not rebuilt by the screen.

### The files

| File | What it covers |
| --- | --- |
| `proficiency.js` | Ranks (untrained to legendary) and their bonus: level + 2/4/6/8 |
| `character.js` | Derived statistics: HP, AC, saves, Perception, skills, class DC, spell attack and DC, Speed |
| `combat.js` | Strikes, the multiple attack penalty, damage, dice rolling, the four degrees of success |
| `conditions.js` | Conditions, their values, which penalties they apply, and what ticks down at end of turn |
| `builder.js` | Level 1 character creation: steps, choices, problems, `buildCharacter`, migrations and rules-data versions |
| `leveling.js` | Levels 2 to 20: what each level grants and how the build stores those choices |
| `inventory.js` | Items, coins, Bulk, equipping, buying, and `equipCharacter` (the sheet with gear applied) |
| `spells.js` | Prepared spells for casters who prepare from a list each day |
| `encounter.js` | Running a fight: initiative order, turns, rounds, and characters' HP and shields in it |
| `gm.js` | Encounter XP budgets and threat, and DCs by level |
| `consumables.js` | How a potion or elixir is used, read from its rules text |
| `adventurePaths.js` | All 26 Second Edition Adventure Paths, with themes and starting levels |
| `data.js` | How the data files are split up and put back together, and campaign book filtering |
| `load.js` | Loading the data from disk in Node (the browser has its own loader) |
| `pregens.js`, `sampleBuilds.js` | Ready-made builds: the iconic heroes and the demo's characters (both generated or checked by scripts and tests) |

`index.js` exports everything. Node code that needs the data files imports `@rollbound/rules/load`.

### Leveling

A build is level 1 choices plus `build.level` and `build.levels`, one entry per level from 2 up (`build.levels[0]` is level 2). Each entry holds that level's feats, skill increase, boosts and spells. Going back a level is just dropping the last entry, and everything stays a pure function of the build. `leveling.js` knows what each class gets at each level; the builder's Level step fills in the entries.

### The sheet with gear on it

The builder's sheet assumes the starting gear. The Inventory tab can change what's equipped, so the sheet everyone actually reads is `equipCharacter(sheet, inventory, gearData)`: Strikes from the equipped weapons (a fist if none), AC from the worn armor and raised shield. The inventory is kept apart from the build on purpose, so editing a character in the builder never touches what they carry.

---

## 4. The rules data

### Where it comes from

| Data | Source | Importer |
| --- | --- | --- |
| Ancestries, heritages, backgrounds, classes, feats, deities, spells, runes, weapons, armor, shields, gear | [Foundry VTT's pf2e system](https://github.com/foundryvtt/pf2e), which publishes the rules as open data | `npm run data:import` (`scripts/import-pf2e.js`) |
| Books Foundry doesn't have yet (Impossible Magic, Dark Archive Remastered) | Archives of Nethys's search index | `npm run data:aon -w @rollbound/rules -- "<Book>"` |
| Bestiary (Monster Core 1 and 2) | Archives of Nethys | `npm run data:bestiary -w @rollbound/rules` |
| Armory (every item) | Archives of Nethys | `npm run data:armory -w @rollbound/rules` |
| Rules glossary | Archives of Nethys | `npm run data:glossary -w @rollbound/rules` |
| Iconic heroes | Paizo's pregen PDFs, transcribed in `pregens/specs.js` | `npm run pregens -w packages/rules` |

All of it is **committed** to the repository. The importers only run when you want newer data, never at build time or on the server. Their downloads are cached in `node_modules/.cache/`, and `--refresh` fetches again.

### Why it's imported, not typed in

There are over 2,000 feats and 1,000 spells. Typing them by hand would be slow and error-prone. Importing from Foundry keeps the numbers right, and re-importing picks up Paizo's errata.

### Corrections

Some rules live only in Foundry's own code, not in its data: a Warpriest's armor training, the spells a class starts with, a gunslinger's firearm proficiency. Those go in `packages/rules/corrections/<book>.json`, and the importer applies them. This means **the engine has no book-specific code**: adding a book adds data, not `if (book === …)` branches. After each import, the importer prints a report of anything that looks like it needs a correction.

### Stable IDs

Builds store choices by Foundry's `_id`, never by name. Names change ("Flat-Footed" became "Off-Guard") and collide across books; IDs don't. `migrateBuild()` upgrades older builds that stored names.

### Versions: knowing when a sheet is out of date

Each import gets a `meta.version`, a fingerprint of the data's content. `buildCharacter` stamps every sheet with that version (`dataVersion`) and the names of its choices (`choiceNames`). When a character opens, `RulesUpdateNotice` compares the stamp with the current data, and `reviewCharacter()` sorts the result:

- **restamp:** nothing that matters changed, so update the stamp quietly;
- **refresh:** numbers or text changed, so offer **Update sheet**;
- **repick:** a choice was removed or became invalid, so offer **Re-pick in the builder**, naming each choice.

### Split files, loaded on demand

The data is one file per book and type (`data/player-core/feats.json`), plus a tiny `data/index.json` listing them with the version. This lets a screen load only what it needs:

- the builder loads ancestries, backgrounds and classes first (`EARLY_TYPES`), so step 1 shows before feats and spells finish downloading;
- `client/src/state/rulesData.js` and `useRules(['spells'])` load files in the browser, and Vite makes each file its own download, cached after the first time;
- the bestiary, armory and glossary are separate again, each with a small list file and its rules text split by category, loaded only when an entry is opened.

`test/data.test.js` fails if the character-creation data passes 5 MB. That's the agreed point to move it into Postgres instead.

### Campaign books

A GM can limit a campaign to certain books. `campaignData(data, books)` in `data.js` filters the *options* players pick from, while keeping things allowed content grants, wherever they're printed. `bookIssues()` names choices from books a campaign doesn't use; the server refuses to let such a character join, and the builder clears those choices when building for that campaign.

---

## 5. The server (`server`)

### Shape

`src/index.js` builds the Express app:

1. **`trust proxy`**, only when `TRUST_PROXY` is set, so rate limits see visitors' real addresses behind Render's proxy.
2. **JSON body parsing.**
3. **`/api/health`** for Render's health check.
4. **One router per area:** `/api/auth`, `/api/characters`, `/api/campaigns` (with session logs and encounters mounted inside it), `/api/sheets`, `/api/inbox`, `/api/join-requests`, `/api/uploads`.
5. **The built client**, if `client/dist` exists: its files, then `index.html` for any other non-API address, so a reload of `/campaigns/12` works. In development `client/dist` usually doesn't exist (or is ignored), and Vite serves the client instead.
6. **An error handler** that logs the error and answers "Something went wrong", without leaking details. Express 5 sends rejected promises from async routes here automatically, so routes don't need try/catch for that.

The file only listens on a port when run directly. When the tests import it, they get the app without a running server.

### Accounts and sessions (`src/auth.js`, `routes/auth.js`)

- **Passwords** are hashed with Node's built-in `scrypt`, with a random salt. No extra dependency.
- **Sessions:** signing in creates a random token and puts it in an HTTP-only cookie (`rb_session`, 30 days). It's HTTPS-only when `NODE_ENV=production`, and invisible to JavaScript. **The database stores only a SHA-256 hash of the token**, so a leaked database can't be used to sign in as anyone.
- **`requireUser`** middleware looks up the session and puts the user on `req.user`. Every route that touches someone's data runs behind it.
- **Password reset:** a random token emailed as a link, stored only as a hash in `password_resets`, good once for 30 minutes. Asking for a link answers the same whether or not the account exists, so the form can't be used to find out who has an account. Resetting signs the account out everywhere else.
- **Emails** go through `src/email.js` (Resend's HTTP API). With no API key, the email is printed in the server's terminal instead, so local development works without email set up. A Resend template is used when its ID is set in `.env`.

### Permissions: the "404, not 403" rule

Every query that reads or changes someone's data includes the owner in its `WHERE` clause (`WHERE id = $1 AND owner_id = $2`). When something isn't yours, the API answers **404 Not found**, not 403 Forbidden, so the API never confirms that someone else's character or campaign exists. Campaign data is visible to the GM and to players with a character in the campaign. Creature stats in a running encounter are the GM's alone.

Every query is parameterized (`$1`, `$2`), never built by gluing strings, which is what prevents SQL injection.

### Saving a character: the server does the math again

When the client saves a character, `routes/characters.js` takes only the **build** and rebuilds the sheet with the server's own rules (`sheetFrom`). If the build has problems, the save is refused with the builder's own messages. A client can't save a sheet with made-up numbers, because the numbers it sends are thrown away.

The live parts of a character are saved separately, each with its own small route and its own check:

| Column | What | Saved by |
| --- | --- | --- |
| `current_hp` | Current HP (NULL = full, so a higher max after leveling stays full) | `PUT /characters/:id/hp` |
| `inventory` | Items and coins (NULL = the builder's starting gear) | `PUT /characters/:id/inventory` |
| `prepared` | Today's prepared spells | `PUT /characters/:id/prepared` |
| `backstory` | The Lore tab's text | `PUT /characters/:id/backstory` |

Keeping them apart means editing a character in the builder never wipes what they carry or how hurt they are.

### Campaigns, invite codes and join requests

- **Invite codes** look like `7KQM-X4HP`: no look-alike characters, permanent, and visible only to the GM (`src/inviteCode.js`).
- **Joining is a request**, not a door. Entering a code creates a `join_requests` row and an inbox message for the GM, who accepts or rejects; the player gets a message back (`src/joinRequests.js`). This means a leaked code can't get a stranger into a party. A character has one pending request at a time, enforced by a unique index.
- **A GM's own characters can't join their own campaign.**
- **Inbox** (`routes/inbox.js`): messages for everyone (announcements, patch notes, posted with `npm run inbox:post`) or for one person (join requests and answers). Reads are tracked per person in `message_reads`.

### Encounters: saved, then run

An encounter row has two lives:

- **Saved:** a name, notes and a list of creatures. The GM builds it on the Encounters tab, rated live against the party's XP budget.
- **Running:** while a fight is on, its `state` column holds the live tracker (`{ round, current, combatants }`, see `encounter.js`), and its `actions` column holds everyone's actions and reaction this turn.

How the GM and players stay in sync:

1. The **GM's tracker** saves the whole `state` on each change (`PUT …/encounters/:id/state`). The server clears `actions` when a round starts, and gives the new current combatant 3 fresh actions (but keeps a reaction they already spent).
2. **Players' Combat tabs** ask for the running encounter every 3 seconds (`useRunningEncounter`), and immediately when the tab comes back into view, pausing while it's hidden. Express's ETag turns an unchanged answer into a tiny 304. Players see the order, the round and whose turn it is, never a creature's HP, AC or Perception.
3. **Marking actions** (`PUT /campaigns/:id/encounter/actions/:key`) updates **one combatant's entry** in place with `jsonb_set`. The GM and a player marking at the same moment can't overwrite each other.
4. **The GM changing a character's HP or shield** goes through `POST /campaigns/:id/characters/:characterId/combat`, worked out on the server inside a transaction that locks the character's row. A player healing themselves at the same moment can't be lost.

Polling was chosen over WebSockets because it's far simpler, works through any host's proxy, and a 3-second delay is fine for a turn-based game.

### Images (`src/storage/`)

Uploads use **presigned URLs**:

1. The browser asks the API for an upload URL (`POST /api/uploads` with the kind, type and size).
2. The browser sends the file **straight to storage**: the image never passes through the server.
3. The browser tells the API the file's **key**. The API checks the file is really an image of the right kind, uploaded by this user, then saves the key.

The database stores **keys, never URLs** (`portraits/ab12….webp`). The storage driver turns a key into a URL when sending it out, so switching storage changes no data.

There are two drivers with the same functions, chosen by `STORAGE_DRIVER`:

- **`local`:** saves under `server/uploads/`, with signed URLs the API checks itself. This is for development.
- **`s3`:** AWS S3. New uploads are tagged `pending` until they're attached to something, and a lifecycle rule deletes abandoned ones after a day.

Replaced and removed images are deleted. Stock portraits (`stock/…`, the iconic heroes' faces) are served from `client/public/stock/` and never deleted.

### The demo (`src/demo.js`)

"Try the demo" creates a **real, temporary account**, not a fake mode in the browser. It's a visitor ("Traveler") with a character of every class and four pretend players: Sam, Priya, Marcus and Elena. Their campaigns, parties, session logs and two join requests come ready-made. When the visitor asks to join a pretend player's campaign, that player accepts on their own after a few seconds.

Each demo is its own world: `demo_owner_id` links the pretend players to their visitor, and `canJoin` keeps demos from finding each other's campaigns. Demos are deleted when the visitor exits, or after 24 hours by an hourly cleanup that also removes expired sessions.

**Why a real account:** the demo runs exactly the same code as everyone else, so there's no second copy to keep in sync, and it can show features that need more than one person (join requests).

### The database

- `db/schema.sql` creates the tables and is **safe to run again and again**: everything is `IF NOT EXISTS`, and changes are added as `ADD COLUMN IF NOT EXISTS` lines at the end. `npm run db:setup` runs it plus `seed.sql`, gives older rows anything new they need (invite codes, share links), and converts old builds. It runs on every deploy.
- The ten tables are `users`, `sessions`, `campaigns`, `characters`, `join_requests`, `messages`, `message_reads`, `session_logs`, `encounters` and `password_resets`. They're drawn in [database-schema.md](database-schema.md).
- Flexible, nested data uses **JSONB**: a character's build and sheet, the inventory, a running encounter's state. These are only ever read and written whole by their owner, so separate tables would add joins without adding safety.
- `src/db.js` makes Postgres `DATE` columns come back as text (`"2026-10-24"`), so a session's date can't shift by a day across time zones.

### Rate limits

Sign-in (20 per 15 minutes), sign-up, password-reset requests and demos are limited per IP address (`src/rateLimit.js`). The counts live in memory, which is fine for one server process; they reset on each deploy.

---

## 6. The client (`client`)

### Routes and who can see them (`App.jsx`)

Every route is in one file, grouped by who may see it:

- **`SignedOutOnly`:** sign in, create account, forgot and reset password. Signed-in visitors go to Home.
- **`SignedInOnly`:** everything personal, including Home, characters, campaigns, the builder, the Bestiary, Spell Book and Armory.
- **Open to everyone:** Learning the Game, the Rules Glossary, Resources, and shared sheets (`/sheets/:shareId`).

The main route families:

| Address | What |
| --- | --- |
| `/play/:characterId/sheet\|feats\|spells\|inventory\|lore\|combat\|settings` | Your character, playable |
| `/campaigns/:id/characters/:characterId/…` | A party member's sheet, read-only |
| `/sheets/:shareId/…` | A shared sheet, read-only, no sign-in |
| `/campaigns/:id` (Overview), `/logs…`, `/encounters…`, `/encounter`, `/settings` | A campaign and its tabs |
| `/create`, `/characters/:id/edit` | The builder, new or editing |
| `/bestiary…`, `/spells…`, `/armory…`, `/glossary…` | The reference books |

### Signed-in state (`state/AuthContext.jsx`)

`AuthProvider` loads `/api/auth/me` once and shares the user. `api.js` wraps `fetch`. If any request comes back 401 ("not signed in") while the app thinks you're signed in, it fires `SIGNED_OUT_EVENT`, and the app sends you to sign in with a note saying why ("Your demo has ended…" or "You were signed out…").

### The character in play (`state/TableContext.jsx`)

`TableProvider` is the hub of every character screen. It loads the character once and gives every tab the same live state:

- **`character`:** the sheet with the inventory's gear applied (`equipCharacter`), and with conditions and a raised shield applied when reading numbers. **`baseCharacter`** is the builder's sheet before gear, used for rules updates and the builder.
- **HP, inventory, prepared spells and backstory**, each saved through **`useDelayedSave`**: a moment after the last change, so a burst of edits makes one request, and again if you leave or close the tab.
- **The running encounter** from `useRunningEncounter`: whose turn it is, and the HP, conditions and shield the GM changed.
- **Actions and reaction** this turn, synced to the encounter.
- **Rolls:** `rollCheck` and `rollDamage` set `lastRoll`, which the roll drawer shows.

A read-only sheet (a party member's or a shared one) uses the same provider with `readOnly` set, so every tab renders the same way and simply hides its controls.

`RollProvider` is a slimmed-down version for the GM's encounter tracker, which rolls dice without a character.

### The builder (`pages/BuilderPage.jsx`, `builder/`)

- **Steps:** Ancestry, Heritage, Background, Class, Class Options, Attributes, Skills, Feats, Spells, Gear, Level, Review (`STEPS` in the rules package).
- **The draft** (the build, the current step, how it started, and which steps were visited) is saved in `localStorage`, per user, so a reload or a closed tab loses nothing. The start screen offers to continue it.
- **Step diamonds** fill when a step has choices (`STEP_TOUCHED`), and the Level step, or Spells for a class without spells, fill once visited, or straight away for an iconic hero.
- **Iconic heroes:** picking one loads their ready-made build and jumps to Review.
- **Edit mode** (`/characters/:id/edit`) opens a saved character, clears any choice that's no longer valid, starts on the first step needing attention, and saves over the same character.
- **Building for a campaign** (`/create?invite=CODE`) limits options to the campaign's books, and saving also asks to join.
- **How choices are shown:** ancestries and classes as a character-select screen (`Showcase.jsx`), Class Options as a three-pane game menu (`ClassOptions.jsx`), and long lists (backgrounds, feats, spells, gear) as an open book (`BookSpread`).

### The sheet and the details drawer

Tapping any number opens the **details drawer** (`DetailsDrawer.jsx`). It shows the number's `parts` from the engine, plus a plain explanation of the rule from `sheet/sheetRules.js`. That file is the only place the sheet's teaching text lives, written in our own words; the numbers always come from the engine. Dice in any rules text become buttons that roll (`boxDice` in `Dice.jsx`).

### Combat and rolling

- **The Combat tab** (`CombatPage.jsx`) is the three-action turn: Strikes with the multiple attack penalty growing as you attack, basic actions, spells, and usable items (a potion's heal is read from its armory text). During a running encounter it shows the order and whose turn it is, and marks your actions as you spend them.
- **The roll drawer** (`RollDrawer.jsx`, showing `RollView` from `RollPage.jsx`) slides in with the 3D die (`Dice.jsx`), the total, and the degree of success once a DC is entered after the roll. Critical successes and failures get their own glow, timed to when the die lands (`motion.css`).

### The GM's encounter tracker (`EncounterRunPage.jsx`)

It starts from a saved encounter: initiative is rolled for everyone (d20 + Perception, editable), then the GM runs turns and rounds, drags rows to change the order, adjusts HP and conditions, and rolls creature attacks against a chosen target. Every change saves the encounter's `state` (see [section 5](#5-the-server-server)). Players watch from their Combat tab, or from the campaign's Encounter tab (`EncounterWatchPage`).

### Inventory and the merchant

The Inventory tab is a character screen: equipped slots, the pack as a grid of item sockets, and an item card. The **Merchant** sub-tab sells the whole armory. Weapons, armor and shields the rules data has stats for go in as real equipment that can be equipped; everything else goes in as gear with its price and Bulk.

### The reference books (`BookSpread.jsx`)

The Bestiary, Spell Book, Armory, Glossary, feats and backgrounds all use one component: an open book with letter tabs, an index on the left page and the open entry on the right, or one page at a time on phones. Each book's filters and page live in the address, so a filtered list can be bookmarked and the Back button works.

### Images in the browser

`ImagePicker` takes a file. `ImageCropper` crops it to the exact shape it will be shown at: a 5:2 campaign cover, a square portrait, a round avatar. It then turns it into a JPEG before uploading (see [section 5](#5-the-server-server)). Cropping in the browser means the server and storage only ever hold the size actually used.

### The PDF character sheet (`sheet/`)

Paizo's fillable Remaster sheet is filled in the browser with `pdf-lib`. The PDF's 517 fields have random names, so `scripts/map-sheet-fields.mjs` matched them by position once, into `sheetFields.json`. `pdf-lib` and the fill code load only when someone exports, so they don't slow the app. The template PDF itself isn't in git; see [character-sheet-pdf.md](character-sheet-pdf.md).

### Themes and styling

- **One stylesheet.** `theme.css` holds every style, in sections with comments naming the file each section styles. `motion.css` holds the animations.
- **Themes are sets of color tokens.** Every color in the CSS is a variable (`--bg`, `--panel`, `--gold`, `--blood`…). Each theme in `themes.js` is a block in `theme.css` (`[data-theme='cosmic'] { … }`) that sets those variables. A few themes add a background too: Cosmic's stars, Pastel's egg-colored glows, Aurora's curtains of light. Switching theme only changes `data-theme` on `<html>`.
- **No flash on load:** a small script in `index.html` applies the remembered theme before the page draws. The choice is saved to the account (`users.theme`) and remembered on the device.
- **Previews:** because a theme is just variables, any element can preview one with `data-theme` (the theme picker's cards, the style lab).
- **Layout:** mobile first. Components size themselves by the space they're given (container queries), not the window, so the same card works in a sidebar or full width. Hover effects only apply with a mouse, and every animation respects reduced motion.
- **Icons** come from game-icons.net. `scripts/build-icons.js` lists the ones used and writes them into `components/iconPaths.js`, so the site carries only those icons, not the whole set.
- **Fonts** are self-hosted in `assets/fonts/`, trimmed to Latin characters.

---

## 7. Four journeys through the code

### Building and saving a character

1. `/create` opens `BuilderPage`. It loads the early rules data, and the rest in the background.
2. Each choice updates the **build** in the draft, which saves to `localStorage`.
3. Every render, `buildProblems(build, data)` lists what's missing; the step diamonds and the Review step show it.
4. Review shows `buildCharacter(build, data)`, the same sheet the server will make.
5. **Save** sends the character (`POST /api/characters`). The server **rebuilds the sheet from the build**, refuses it if `buildProblems` finds anything, stamps the data version, and stores it.
6. With a portrait, the browser uploads it (presigned) and attaches its key. Building for a campaign also creates a join request.

### A Strike during a running encounter

1. The GM starts the encounter: initiative is rolled and the tracker saves `state`.
2. The player's Combat tab, polling every 3 seconds, sees it's their turn.
3. The player taps a Strike. `TableContext.rollCheck` rolls d20 + the Strike's bonus, including the multiple attack penalty for attacks already made this turn, and the roll drawer opens. One action is marked spent, and that's sent to the server, which updates only this character's entry in `actions`.
4. The GM's tracker and the other players see the spent action on their next poll.
5. The player enters the target's AC in the drawer, and the degree of success shows, with damage doubled on a critical hit.

### Uploading a portrait

1. `ImagePicker` takes the file, and `ImageCropper` crops it to a square JPEG.
2. `POST /api/uploads { kind: 'portrait', contentType, size }` returns a signed URL and a key.
3. The browser `PUT`s the file to that URL: S3, or the local driver.
4. `PUT /api/characters/:id/portrait { portraitKey }`: the server checks the upload is a real image, of this kind, from this user, saves the key, and deletes the old portrait.

### Forgot password

1. `/forgot-password` sends the email address (`POST /api/auth/forgot-password`).
2. If an account has that email, the server stores a hashed one-time token and emails the link through Resend (or prints it, with no key set). It answers the same either way.
3. The link opens `/reset-password?token=…`. A new password is sent with the token, and the server checks the hash, expiry and that it's unused, sets the password, signs out every other session, and signs this browser in.

---

## 8. Why it's built this way

| Decision | Why |
| --- | --- |
| One shared rules package | The client and server compute identical numbers, and the rules are tested in one place. |
| Pure functions, no dependencies, in the engine | Runs anywhere, trivial to test, and a sheet can always be rebuilt from its build. |
| Save the build; derive the sheet | Fixes and errata reach every character. The server can't be fooled by a made-up sheet. |
| `{ total, parts }` for every statistic | "Show the math" comes from the engine, so it's always right and never duplicated by the screen. |
| Rules data imported from Foundry and AoN | Thousands of items, accurate, and refreshable when Paizo publishes errata. |
| Corrections as per-book data | New books add data, not engine branches. |
| Choices saved by stable ID | Names change and collide; IDs don't. |
| Data versions stamped on sheets | A re-import can say exactly which characters need what. |
| Data split per book and type, loaded on demand | Screens show fast and download only what they use. |
| Inventory, HP, prepared spells and backstory kept apart from the build | Editing a build never wipes what a character carries or how hurt they are. |
| Sessions in the database, tokens hashed | Real sign-out everywhere, and a leaked database can't sign anyone in. |
| 404 for anything that isn't yours | The API never confirms someone else's data exists. |
| Join requests instead of open invite codes | A leaked code can't get a stranger into a party. |
| Polling for live encounters | Simple, works behind any proxy, and fast enough for a turn-based game. |
| Per-combatant action updates (`jsonb_set`), and GM changes in locked transactions | Two people acting at once can't overwrite each other. |
| Presigned uploads; keys not URLs in the database | Files never pass through the server; storage can change without touching data. |
| The demo as a real temporary account | One code path, and it can show multi-person features. |
| Additive, re-runnable `schema.sql` | Deploys update the database safely and automatically. |
| One process serves the API and the site in production | One address, no cross-site cookies, nothing extra to host. |
| Themes as CSS variables | A new theme is one block of colors; any element can preview any theme. |
| The PDF built in the browser | No server load, works in the demo, and the template stays local. |
| Art found by file name | Adding art needs no code changes. |

---

## 9. Testing

- **`npm test`** runs the rules tests with Node's built-in test runner: over 300 tests, one file per area in `packages/rules/test/`. They cover proficiency, AC with Dex caps, saves, strikes and the multiple attack penalty, degrees of success, conditions, encounters, leveling, inventory, spells, dice, and the data files (bestiary, armory, glossary, and the size budget).
- **The build sweep** (`test/sweep.test.js`) builds a character for every class with every ancestry, heritage, background, subclass option and compatible deity, thousands of builds, and checks each one is valid with a complete sheet. New classes and books are included automatically. It's why a re-import can't quietly break a combination nobody thought to try.
- **API access tests** (`server/test/access.test.js`): `TEST_DATABASE_URL=postgres://localhost:5432/rollbound_test npm test -w server`, against a throwaway database (they skip without one). They check that nobody reaches another person's data, players only read logs, saved sheets are rebuilt from their builds, and sign-in attempts are limited.
- **GitHub Actions** (`.github/workflows/ci.yml`) runs the tests and a client build on every push and pull request, on Node 24.
- **Visual checks** have been done by driving the app in a headless browser (Playwright) and reading screenshots, at desktop and phone widths.

---

## 10. How to change common things

| To… | Do this |
| --- | --- |
| **Add a page** | Make it in `client/src/pages/`, add its route to `App.jsx` under the right access group, and link it from `SideNav.jsx` or wherever it belongs. |
| **Add an API route** | Add it to the matching file in `server/src/routes/`. Put the owner in the query's `WHERE`, answer 404 for anything not theirs, use `$1` parameters, and add an `api.js` helper in the client. |
| **Add a database column or table** | Append an `ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS` to the end of `server/db/schema.sql`, update `docs/database-schema.md`, and run `npm run db:setup`. Never remove or rename in that file; see [render-upkeep.md](render-upkeep.md). |
| **Change a rule** | Change the function in `packages/rules/src/`, add or adjust a test beside it, and run `npm test` (the sweep checks nothing else broke). |
| **Fix a rule only one book gets wrong** | Add a correction in `packages/rules/corrections/<book>.json` rather than code. |
| **Pick up new rules data** | `npm run data:import`; read its corrections report; run the tests; commit the changed JSON. |
| **Add a color theme** | Add it to `client/src/themes.js`, add a `[data-theme='id'] { … }` block of tokens in `theme.css` (copy an existing one), and add its id to the lists in `server/src/routes/auth.js` and `client/index.html`. If it replaces a theme, add an `UPDATE users SET theme = …` line to `schema.sql` for anyone who had the old one. |
| **Add an icon** | Add it to `ICONS` in `client/scripts/build-icons.js`, then run `npm run icons -w client`. |
| **Add art** | Name it like `class-wizard.png` or `ancestry-elf-icon.png`, then `npm run art:import -- <folder>`. See [adding-art.md](adding-art.md). |
| **Change the logo** | Replace `client/src/assets/logo.webp` and the three files in `client/public/` (`favicon-32.png`, `logo-512.png`, `apple-touch-icon.png`). |
| **Post an announcement** | `npm run inbox:post -- --title "…" --body "…"` (add `--kind patch-notes` for patch notes). |

---

## 11. Known limits and shortcuts

These are deliberate, with the point at which each should change. Places in the code marked `shortcut:` explain their own limits.

- **Rate limits live in memory.** That's fine for one server process. Running more than one would need the counts in Postgres.
- **Live encounters poll every 3 seconds.** That's fine for a turn-based table. Many large simultaneous games would be a reason to look at WebSockets.
- **The rules data is JSON in the repository,** close to the 5 MB budget the data test enforces. When that test fails, it's time to move the data into Postgres.
- **The merchant lists the first 200 matches** of a category; searching narrows it.
- **Five iconic heroes wait on their classes** (Guardian, Exemplar, Animist, Commander, Kineticist). Their PDFs and class art are kept for when those classes are added.
- **The PDF sheet template isn't in git** and needs Paizo's permission before it's hosted publicly. Adventure Path covers are kept out of git for the same reason (Paizo art).
- **The HANDOFF's open items** list the remaining rules gaps (bonus spells from domains, some Lore subcategories, shield edge cases).
