# RollBound handoff

A record of everything built in this project so far, why it was built that way, what's still open, and where to pick up. Written 2026-10-23.

It's organized by topic, roughly in the order the work happened. Each section says what exists, where it lives, and anything worth knowing before you change it. The [Open items](#open-items) list at the end is the place to start next time.

---

## Contents

1. [The project at a glance](#the-project-at-a-glance)
2. [Running it](#running-it)
3. [How the code is organized](#how-the-code-is-organized)
4. [Feature history](#feature-history)
5. [Key decisions and why](#key-decisions-and-why)
6. [Licensing and content rules](#licensing-and-content-rules)
7. [Testing and verification](#testing-and-verification)
8. [Gotchas](#gotchas)
9. [Open items](#open-items)
10. [Scalability roadmap](#scalability-roadmap)

---

## The project at a glance

RollBound is a Pathfinder 2e (Remaster) table companion that **teaches the rules while you play**. Every number on the sheet shows its math.

**Stack (PERN):** Postgres, Express, React (Vite), Node.

**What a player can do today:**
- create an account (with an optional profile picture), or try a demo with no account,
- build a level 1 character in a 9-step builder using Player Core and Player Core 2,
- play that character on four screens: Sheet, Turn, Roll and GM,
- export the character to Paizo's fillable PDF character sheet,
- create, edit and join campaigns with invite codes, cover images and portraits.

---

## Running it

```bash
npm install
sudo service postgresql start        # Postgres often stops after a WSL restart
npm run db:setup                     # tables, seed data, invite codes, build upgrades (safe to re-run)
npm run dev:server                   # API on :3001
npm run dev:client                   # app on :5173 (second terminal)
npm test                             # 105 rules tests, including the full build sweep
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run data:import` | Re-imports rules data from Foundry, prints the corrections report, then runs the tests and build sweep |
| `npm run art:import -- <folder>` | Converts art named like `class-wizard.png` into the app |
| `npm run db:migrate-builds --workspace @rollbound/server` | Upgrades saved characters' builds on their own |
| `npm run dev:client -- --host` | Opens the dev server to your phone on the same Wi-Fi |

The settings go in `server/.env`; see `server/.env.example`. Key ones are `DATABASE_URL`, `UPLOAD_SECRET`, and the commented S3 block.

**Local files that aren't in git** (each machine needs its own copy):
- `client/src/assets/art/placeholder-hero.png`: Capcom placeholder art, never publish it,
- `client/public/sheets/pf2e-remaster-character-sheet.pdf`: Paizo's fillable sheet, see `docs/character-sheet-pdf.md`,
- `server/uploads/`: local stand-in for S3,
- `server/.env`.

---

## How the code is organized

```
packages/rules/        Rules engine: pure functions, no dependencies. Shared by client and server.
  src/                   proficiency, character stats, combat, conditions, GM math, builder.js
  data/pf2e-level1.json  Imported rules data (committed)
  corrections/           Per-book rule corrections (see below)
  scripts/import-pf2e.js The importer
  test/                  rules.test.js, builder.test.js
client/                React app (Vite)
  src/pages/             Login, Register, Hub, Account, Builder, Campaign pages, Sheet/Turn/Roll/GM
  src/builder/           Builder steps, Showcase (character select), OptionList, art.js
  src/sheet/             PDF export: fill logic, field map, open/download
  src/state/             Auth, table state, demo stores, campaign service, portraits
  src/assets/art/        Class/ancestry portraits and icons (found by file name)
  scripts/               map-sheet-fields.mjs, import-art.mjs
server/                Express API
  src/routes/            auth, characters, campaigns, uploads
  src/storage/           local.js and s3.js drivers behind one interface
  db/                    schema.sql, seed.sql, setup.js, migrate-builds.js
infra/aws/             S3 CORS, lifecycle, IAM and bucket policies
docs/                  Guides (art, S3, PDF sheet) and this file
```

---

## Feature history

### 1. Accounts, login and demo
- **Pages:** `/` is sign-in and `/register` is create-account. Signing in lands you on the hub.
- **Sessions:**
  - passwords are hashed with Node's built-in `scrypt`, so there's no extra dependency,
  - the session cookie is HTTP-only and lasts 30 days,
  - the database stores only a SHA-256 hash of each session token (`sessions` table).
- **Demo mode:** a "Try the demo" button skips sign-in. Everything a demo user does lives in the browser tab (`sessionStorage`): characters, campaigns, portraits. It's cleared when they exit or close the tab.
- **Profile:** the Account page (`/account`) sets the display name and profile picture. Sign-up has an optional picture too; it uploads after the account exists, and if that fails the user lands on the Account page with a note.

### 2. Hub
- Lists your characters with portrait, HP and AC, and your campaigns, split into "you run" and "you play in".
- Includes the join-a-campaign box, and shows your avatar in the top bar.
- Each character opens at `/play/:id/sheet|turn|roll|gm`.

### 3. Character builder (`/create`)
- **Nine steps:** Ancestry, Background, Class, Attributes, Skills, Feats, Spells, Gear, Review.
- **Teaching:** each step has a short note explaining its rule.
- **Drafts:** the draft is saved in `localStorage`, and Reset (top bar) clears it.
- **Step diamonds:** empty means nothing chosen yet, gold means started, and red is the current step.
- **Rules covered:**
  - ancestry and versatile heritages,
  - Remaster attribute boosts, including alternate ancestry boosts,
  - background Lore choices,
  - class with subclass choices (muse, doctrine, bloodline, racket and so on) and their effects,
  - deity, divine font and sanctification,
  - skills, including the extra pick when two sources train the same skill,
  - languages,
  - ancestry, class and bonus feats (Natural Ambition, General Training), with prerequisite checks,
  - spells per class,
  - a 15 gp gear budget.
- **Character-select look:** the ancestry and class steps work like Diablo 4's class select:
  - a large portrait in a fixed 2:3 panel, anchored to the top,
  - a grid of round icon tiles,
  - the selected option's stats and description.
- **Saving:** sends the character to the API, or keeps it in the tab in demo mode, with an optional portrait.

### 4. Rules data import
- **Source:** the Foundry VTT pf2e system's open data, filtered to the books in `BOOKS` (Player Core and Player Core 2) and pinned to an upstream commit recorded in `meta.commit`.
- **Impossible Magic:** Foundry has no Necromancer or Runesmith yet. Add the book's exact title to `BOOKS` when it appears; the importer logs skipped titles mentioning "Impossible".
- **Deities:** these come from Foundry's `core-gods` folder, which is Player Core's list.
- **Corrections:** rules Foundry encodes only in its own code come from `packages/rules/corrections/<book>.json`. After each import, a report lists anything that looks like it needs a correction.

### 5. Playing a character
- **Sheet:** defenses, saves, Perception, skills (including the armor check penalty), class DC, and spell attack and DC. Tapping a number shows its breakdown. It also has the portrait editor and the PDF export button.
- **Turn:** the 3-action economy, the multiple attack penalty, and conditions.
- **Roll:** degrees of success, with the correct Strength damage for melee, thrown, propulsive and ranged weapons.
- **GM:** encounter budget and initiative. It still uses the character's level, not the campaign's party level.

### 6. Campaigns
- **Fields:** title, backstory, party level and cover image, all editable by the GM.
- **Invite codes:**
  - format `XXXX-XXXX`, with no look-alike characters (0/O, 1/I/L),
  - unique in the database, accepted in any case with or without the dash,
  - the GM can replace a code, and the old one stops working.
- **Joining:** a player previews the campaign from its code, then picks which character joins. A character is in one campaign at a time.
- **Campaign page:** cover, backstory, the party (portraits and player avatars), and the invite code (GM only).
- **Demo mode:** it all works within the tab.

### 7. Image uploads and S3
- **Three kinds:** campaign covers (`covers/`, 5 MB), profile pictures (`avatars/`, 2 MB), and character portraits (`portraits/`, 5 MB).
- **Flow:**
  1. the API issues a short-lived signed upload URL,
  2. the browser uploads straight to it,
  3. the record stores only the file's key.
- **Checks:**
  - the API checks the file is a real image before using it,
  - it refuses images of the wrong kind or uploaded by another user,
  - replaced or removed images are deleted.
- **Drivers:**
  - `STORAGE_DRIVER=local` (default) saves under `server/uploads/`,
  - `STORAGE_DRIVER=s3` uses S3, with uploads tagged `pending` until used and a lifecycle rule deleting abandoned ones after a day.
- **Status:** tested against a local S3-compatible server (Versity Gateway), not real AWS yet. `docs/aws-s3-setup.md` is the step-by-step setup guide, and `infra/aws/` has the config files.

### 8. PDF character sheet export
- **What it does:** fills Paizo's form-fillable Remaster sheet in the browser with `pdf-lib`. The result stays fillable.
- **Field map:** the PDF's 517 fields have random names, so `client/scripts/map-sheet-fields.mjs` identifies them by position and writes `sheetFields.json`. Re-run it if Paizo updates the sheet.
- **Fills:** statistics, skills, strikes, proficiency ranks, feats and gear, the portrait in the Character Sketch box, deity, campaign, and spells.
- **Viewing:** the PDF opens in a new tab, with a "Download instead" link.
- **Fixes made along the way:**
  - some one-line fields were marked multi-line, so viewers hid their text behind a "+" marker,
  - `pdf-lib` pausing on timers made it crawl in a background tab,
  - `createImageBitmap` and `img.decode()` stalled in headless Chrome.

### 9. Responsive design
- **Approach:** mobile first, with the layout switching at 768px (tablet) and 1024px (desktop).
- **Desktop:** two columns, the play-screen nav becomes top tabs, and the content area widens to 1180px.
- **Components:** sized by the space they actually have (container queries).
- **Touch and comfort:** larger tap targets on touch screens, hover effects only with a mouse, phone notch and home-bar areas respected, and reduced-motion support.

### 10. Builder art
- **Classes:** portraits are Paizo's Remaster iconics, and the 16 tile icons are Adventure Card Game emblems. The Investigator and Swashbuckler icons were cut from coin photos.
- **Saved for later:** art for classes not yet in the builder: animist, commander, exemplar, guardian, gunslinger, inventor, kineticist, magus and summoner.
- **Ancestries:** eight borrow a class iconic for now (`BORROWED` in `art.js`), and the rest use the placeholder or a letter. Human uses Valeros, with a hand-tuned tile crop in `TILE_FOCUS`.
- **Adding art:** files are found by name in `client/src/assets/art/`, as `<kind>-<slug>.webp` for portraits and `<kind>-<slug>-icon.webp` for icons. `npm run art:import` converts them and warns about icons whose corners aren't transparent. Full guide: `docs/adding-art.md`.

### 11. Scalability work (steps 0–2 and 6 of the roadmap)
- **Step 0, art discovered by file name:** see above.
- **Step 1, corrections files:** all book-specific rules moved out of the engine into per-book JSON. The importer applies them and reports gaps.
- **Step 2, stable IDs:**
  - every rules item carries Foundry's `_id`,
  - builds save choices by ID (build `v: 2`),
  - `migrateBuild()` converts older name-based builds.

  The builder converts drafts on load, and `db:setup` converts saved characters.
- **Verification:** 23,632 sample characters produced identical sheets before and after the refactor.
- **Step 6, the build sweep:** `packages/rules/test/sweep.test.js` builds a character for every class with every ancestry and heritage, every background, every subclass option and every compatible deity (about 4,400 builds, ~3 seconds). It runs:
  - with `npm test`,
  - after every `npm run data:import`,
  - on every push and pull request on GitHub (`.github/workflows/ci.yml`, which also builds the client).

  Writing it caught a step 2 bug: heritages still named their ancestry by slug, so the Ancestry step showed only the versatile heritages. The importer now links them by ID, and `buildProblems` rejects a heritage from another ancestry.

---

## Key decisions and why

| Decision | Why |
| --- | --- |
| Rules data imported from Foundry, not typed by hand | Complete and accurate. Typing hundreds of feats from memory risked wrong numbers. |
| Corrections as per-book data | New books add data, not engine code; each book's fixes are on one page. |
| Foundry IDs for saved choices | Names change and collide across books; IDs don't. |
| Shared rules package | The client and server compute the same numbers. |
| Presigned direct uploads | Files never pass through the API; the same flow for local and S3. |
| Demo mode in the browser tab | No account needed, nothing to clean up on the server. |
| Server stores only key, never URL | Switching storage (local, S3, CloudFront) changes no data. |
| PDF built in the browser | Works in demo mode, no server load, the template stays local. |
| Art found by file name | Adding art needs no code changes. |

---

## Licensing and content rules

- **Rules text:** Player Core and Player Core 2 are under Paizo's **ORC License**. The README credits this. Each imported item records its license.
- **Class art and icons:** Paizo's Community Use Package, under the [Community Use Policy](https://paizo.com/licenses/communityuse). It's allowed for free, non-commercial fan projects **with Paizo's required notice**. That notice isn't on the site yet, and RollBound must stay free while it uses this art.
- **The character sheet PDF:** "Permission granted to photocopy for personal use only." Fine for you and your group. **Don't host it publicly** without checking the policy or asking Paizo. It's gitignored.
- **The placeholder hero:** Monster Hunter art, © Capcom. Gitignored, and never to be published.
- **Other Paizo art,** such as rulebook illustrations, isn't covered by the policy. Don't use it.

---

## Testing and verification

- `npm test`: 105 rules tests, covering the engine, builder rules, ID migration, ID uniqueness, the corrections, and an empty import report.
- **Build sweep** (`test/sweep.test.js`): every class with every ancestry, heritage, background, subclass option and deity must produce a valid character with a complete sheet. A failure names the combinations that broke.
- **GitHub Actions** runs the tests and a client build on every push and pull request.
- **UI checks:** done with headless Windows Chrome screenshots from WSL, using a small proxy that sets demo or sign-in state. Tap-specific behavior wasn't testable this way.
- **S3:** tested against Versity Gateway locally, not real AWS.

---

## Gotchas

- **Postgres stops after WSL restarts.** Run `sudo service postgresql start`. Several features were finished while it was down, so their database parts are verified by tests rather than a live run: the GM avatar on campaigns, and converting saved character builds.
- **Re-running the importer** pulls the latest Foundry data. Check the corrections report every time. The data file records which commit it came from.
- **The PDF field map** is tied to the exact template. Replace the template, then re-run `map-sheet-fields.mjs`; it stops with an error if any field moved.
- **The ancestry fallbacks** (`BORROWED`, `TILE_FOCUS` in `art.js`) stop mattering once real ancestry files exist. Delete those entries then.
- **The old art files** were committed under `client/public/art/`, and were moved to `client/src/assets/art/`. Stage the move with `git add -A` so git records it as renames.
- **A spot I couldn't test:** the profile picture step on Create account, and a full join between two real accounts in the browser.

---

## Open items

**Needs you:**
- [ ] Start Postgres and run `npm run db:setup`, to convert saved character builds and confirm the GM avatar works.
- [ ] Send **ancestry art** for the remaining eight (catfolk, hobgoblin, kholo, kobold, leshy, lizardfolk, ratfolk, tripkee), plus round **icons for all 16 ancestries**, as square transparent PNGs of about 512px.
- [ ] Before publishing, add a **site footer** with the ORC credit and Paizo's Community Use notice, using the exact wording from Paizo's page.
- [ ] Decide on the **PDF sheet template** for a public deploy: get permission, or design a RollBound sheet.
- [ ] Set up **AWS S3** using `docs/aws-s3-setup.md`, then run its checklist.
- [ ] Add **Impossible Magic** once Foundry publishes it: add its title to `BOOKS`, import, and work through the report.

**Small features:**
- [ ] Use the campaign's party level on the GM screen (it uses the character's level today).
- [ ] Delete a campaign.
- [ ] Bonus spells from domains, the deity, wizard curriculum, and the witch's lesson.
- [ ] Record the specific Lore subcategory from feats like Additional Lore.
- [ ] Optional GM approval of uncommon and rare options.

---

## Scalability roadmap

From the planning discussion. Steps 0–2 and 6 are done.

| Step | What | Status |
| --- | --- | --- |
| 0 | Art discovered by file name, plus the `art:import` script | Done |
| 1 | Book-specific rules as corrections data, plus the import report | Done |
| 2 | Stable IDs for saved choices, plus migration | Done |
| 6 | The build sweep as a committed test that runs on every push (GitHub Actions) and after every import | Done |
| 3 | Stamp characters with the data version they were built with; flag choices that disappear after a re-import; "please re-pick" on the sheet | **Next**, before the third book or leveling |
| 4 | Split the data file per book and type; load per step; move to Postgres at about 5 MB | Before the third book or leveling |
| 5 | Each campaign chooses its allowed books; the builder filters by them | When GMs run games |
| 7 | Show licenses per item, a site footer, and refuse non-redistributable books by default | Before a public launch |

The biggest future jump is **leveling from 2 to 20**. It multiplies the feats, spells and features handled, so steps 1 and 6 matter even more then.
