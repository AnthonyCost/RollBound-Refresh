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
npm test                             # 154 rules tests, including the full build sweep
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run data:import` | Re-imports rules data from Foundry plus the hand-made books, prints the corrections report, then runs the tests and build sweep |
| `npm run data:aon --workspace @rollbound/rules -- "<Book>"` | Converts a book Foundry doesn't have from the Archives of Nethys into `packages/rules/books/` |
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
  src/                   proficiency, character stats, combat, conditions, GM math, builder.js,
                         data.js (how the data is split and reassembled), load.js (Node loader)
  data/                  Imported rules data (committed): <book>/<type>.json plus index.json
  corrections/           Per-book rule corrections (see below)
  scripts/import-pf2e.js The importer
  test/                  rules.test.js, builder.test.js, sweep.test.js, data.test.js
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
- **Source:** the Foundry VTT pf2e system's open data, filtered to the books in `BOOKS` (Player Core, Player Core 2 and Guns & Gears) and pinned to an upstream commit recorded in `meta.commit`.
- **Hand-made books:** Impossible Magic and Dark Archive (Remastered) aren't in Foundry (or only in an older edition), so they come from the Archives of Nethys (`packages/rules/books/`, sections 12–13). When Foundry adds it, follow `books/README.md` to switch over.
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

### 11. Scalability work (steps 0–4 and 6 of the roadmap)
- **Step 0, art discovered by file name:** see above.
- **Step 1, corrections files:** all book-specific rules moved out of the engine into per-book JSON. The importer applies them and reports gaps.
- **Step 2, stable IDs:**
  - every rules item carries Foundry's `_id`,
  - builds save choices by ID (build `v: 2`),
  - `migrateBuild()` converts older name-based builds.

  The builder converts drafts on load, and `db:setup` converts saved characters.
- **Verification:** 23,632 sample characters produced identical sheets before and after the refactor.
- **Step 6, the build sweep:** `packages/rules/test/sweep.test.js` builds a character for every class with every ancestry and heritage, every background, every combination of subclass options (a wizard's school and thesis, a necromancer's fatal method and grim fascination), every tradition where an option offers a choice (a dragon eidolon), and every compatible deity (about 5,600 builds, ~5 seconds). New classes and books are included automatically, since it reads the class list from the data. It runs:
  - with `npm test`,
  - after every `npm run data:import`,
  - on every push and pull request on GitHub (`.github/workflows/ci.yml`, which also builds the client).

  Writing it caught a step 2 bug: heritages still named their ancestry by slug, so the Ancestry step showed only the versatile heritages. The importer now links them by ID, and `buildProblems` rejects a heritage from another ancestry.
- **Step 3, rules-data versions:**
  - Each import gets a `meta.version`, a fingerprint of the rules content, kept in the tiny `data/index.json`. The same data always gets the same version.
  - `buildCharacter` stamps every sheet with `dataVersion` and `choiceNames` (the name of each chosen item, so a removed one can still be named).
  - `reviewCharacter(character, data)` sorts an outdated character into `restamp` (nothing changed), `refresh` (numbers or text changed) or `repick` (choices gone or no longer valid).
  - On the sheet, `RulesUpdateNotice` checks only when the stamp differs: it restamps quietly, offers **Update sheet**, or lists the lost choices with **Re-pick in the builder**. The hub marks outdated characters "Rules updated".
  - The builder has an edit mode at `/characters/:id/edit`. It opens a saved character with the missing choices cleared, starts on the first step needing attention, and saves over the same character, keeping its portrait and campaign. Drafts left over from before an update also have stale picks cleared.
  - Checked in Chrome in demo mode. Account mode uses the existing `PUT /characters/:id` but wasn't run live (Postgres was down).
- **Step 4, split data:**
  - The importer writes one file per book and type (`data/player-core/feats.json`, 21 files today) plus `data/index.json` with the meta, version and file list. `src/data.js` splits and reassembles; reassembled data is identical to the old single file, and the version didn't change.
  - Loaders take an optional filter, `{ types, books }`: `loadRulesData()` from `@rollbound/rules/load` in Node, and `loadRules()` in `client/src/state/rulesData.js` in the browser, where each file is its own chunk, downloaded once.
  - The builder loads `EARLY_TYPES` first (about 100 KB compressed of the 181 KB total), so Ancestry, Background and Class show before feats, spells and gear arrive. Checked in Chrome with those files held back 3 seconds.
  - **Postgres is deferred on purpose.** The data is 0.7 MB, and the plan was to move at about 5 MB. `test/data.test.js` fails past 5 MB with a message pointing here, so CI says when it's time.
  - The `books` filter is ready for step 5.

### 13. Guns & Gears and Dark Archive (Remastered)
- **Guns & Gears** comes from Foundry, whose version is the remaster: it's in `BOOKS`. It adds the Gunslinger and Inventor, the Automaton ancestry (4 heritages), 39 backgrounds and firearms. One correction: the Gunslinger is expert with simple and martial firearms and crossbows and trained with advanced ones, so weapon proficiency can now be set by weapon group (`weaponGroups`).
- **Dark Archive (Remastered)** is a hand-made book from AoN, since Foundry only has the 2022 original. It adds:
  - the Psychic, whose subconscious mind sets the key attribute and whose conscious mind adds spells,
  - the Thaumaturge, with Esoteric Lore rolled with Charisma and the Dubious Knowledge feat,
  - Reflection, a versatile heritage that opens its own ancestry feats,
  - 4 backgrounds, 18 feats and 4 spells.
- **Automaton unlocked Impossible Magic's heritages:** Defensive Automaton (10 ancestry HP and Toughness) and Newly Minted Automaton, plus its 4 Automaton feats.
- **Importer changes:**
  - Feats and spells that a hand-made book grants from other books are pulled in from Foundry, for example *Kinetic Ram* and Concealing Legerdemain.
  - Hand-made heritages wait until their ancestry exists.
- **Engine fix:** granted spells now come from every chosen subclass option, not just the one that sets the tradition. The psychic's conscious mind needed this.
- **Not checked against a PDF:** I didn't have Dark Archive. The Psychic's 1 spell slot at 1st level comes from AoN's text ("Each day, you can cast one 1st-rank spell"), since AoN doesn't show the spells-per-day table. Confirm it against your book if you have it.
- **Partial:** Reborn Soul grants two Lores of your choice, and the builder records one.
- **Verified:** 154 tests, with the sweep over 24 classes. In Chrome, a character of each new class plus a Defensive Automaton fighter was built and saved; HP, the gunslinger's expert pistol (+7), the thaumaturge's Charisma-based Esoteric Lore and the psychic's granted spells all match the engine.
- **Art:** Gunslinger and Inventor use art you'd already provided. Psychic, Thaumaturge and Automaton show letters for now.

### 12. Impossible Magic (the first hand-made book)
- **Source:** Foundry doesn't have the book, so `scripts/import-aon.js` converts it from the Archives of Nethys: one request to AoN's search index, cached, written to `books/impossible-magic.json`. The importer merges hand-made books before corrections, so everything downstream treats them like Foundry's books. Guide: `packages/rules/books/README.md`.
- **Cross-checked against the PDF** (your copy, kept out of the repo): every feat, spell and rune name and level, class HP and proficiencies, and subclass options. The PDF filled one gap AoN left blank: the Dragon eidolon's skills.
- **What's in:**
  - the Magus, Necromancer, Runesmith and Summoner, with their 1st-level features and choices: 7 hybrid studies, 2 fatal methods, 4 grim fascinations and 13 eidolons;
  - 25 class feats at 1st level, 37 cantrips and 1st-rank spells, 16 runes;
  - 4 new wizard arcane schools.
- **Engine additions,** all driven by `corrections/impossible-magic.json`:
  - a spellcasting attribute separate from the key attribute (magus: Int),
  - spells a class always knows (necromancer: *harm*),
  - class Lore skills (Undead Lore),
  - a trait filter on the 1st-level class feat (summoner: evolution),
  - tradition-dependent subclass skills (dragon eidolon),
  - runes, a new data type with a picker on the Spells step ("Runes" for runesmiths), on the sheet and in the PDF's class features box.
- **Prerequisite phrasings:** "You aren't holy/unholy" and "Trained in X, Trained in Y, or …" are now understood.
- **Not in yet:**
  - the two Automaton heritages and four Automaton feats, because the Automaton ancestry isn't imported;
  - focus spells (conflux, grave, link), which are feature text, as with every class;
  - eidolon and thrall stat blocks;
  - art for the Necromancer and Runesmith, which show letters for now.
- **Verified:**
  - 136 rules tests, including the sweep over all 20 classes;
  - in Chrome, a character of each new class built and saved, with matching numbers on the sheet. The magus spell DC shows "Intelligence".

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

- `npm test`: 154 rules tests, covering the engine, builder rules, ID migration, ID uniqueness, the corrections, rules-data updates, the data files and their size budget, and an empty import report.
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
- [ ] When Foundry publishes **Impossible Magic**, switch from the hand-made book (`packages/rules/books/README.md`), ideally mapping AoN IDs to Foundry IDs so nobody has to re-pick.
- [ ] Send **art for the Necromancer, Runesmith, Psychic and Thaumaturge** (portrait and icon) and the **Automaton** ancestry, named `class-necromancer.png`, `ancestry-automaton.png` and so on.
- [ ] Confirm the **Psychic's 1st-level spell slots** (1, from AoN's text) against Dark Archive (Remastered).

**Small features:**
- [ ] Use the campaign's party level on the GM screen (it uses the character's level today).
- [ ] Delete a campaign.
- [ ] Bonus spells from domains, the deity, wizard curriculum, and the witch's lesson.
- [ ] Record the specific Lore subcategory from feats like Additional Lore.
- [ ] Optional GM approval of uncommon and rare options.

---

## Scalability roadmap

From the planning discussion. Steps 0–4 and 6 are done.

| Step | What | Status |
| --- | --- | --- |
| 0 | Art discovered by file name, plus the `art:import` script | Done |
| 1 | Book-specific rules as corrections data, plus the import report | Done |
| 2 | Stable IDs for saved choices, plus migration | Done |
| 6 | The build sweep as a committed test that runs on every push (GitHub Actions) and after every import | Done |
| 3 | Stamp characters with the data version they were built with; flag choices that disappear after a re-import; "please re-pick" on the sheet | Done |
| 4 | Split the data file per book and type; load per step; move to Postgres at about 5 MB | Done; Postgres waits for the 5 MB test to fail |
| 5 | Each campaign chooses its allowed books; the builder filters by them | **Next**, when GMs run games |
| 7 | Show licenses per item, a site footer, and refuse non-redistributable books by default | Before a public launch |

The biggest future jump is **leveling from 2 to 20**. It multiplies the feats, spells and features handled, so steps 1 and 6 matter even more then.
