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
- create an account (with an optional profile picture), or try a demo, which makes a temporary account,
- build a level 1 character in a 9-step builder using Player Core and Player Core 2,
- play that character from its sheet (Sheet, Spell Book, Inventory, Lore), with Turn and Roll waiting for the encounter tracker,
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
npm test                             # 173 rules tests, including the full build sweep
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run data:import` | Re-imports rules data from Foundry plus the hand-made books, prints the corrections report, then runs the tests and build sweep |
| `npm run data:aon --workspace @rollbound/rules -- "<Book>"` | Converts a book Foundry doesn't have from the Archives of Nethys into `packages/rules/books/` |
| `npm run art:import -- <folder>` | Converts art named like `class-wizard.png` into the app |
| `npm run db:migrate-builds --workspace @rollbound/server` | Upgrades saved characters' builds on their own |
| `npm run dev:client -- --host` | Opens the dev server to your phone on the same Wi-Fi |
| `npm run data:bestiary --workspace @rollbound/rules` | Rebuilds the bestiary from the Archives of Nethys (Monster Core and Monster Core 2), checking Monster Core against Foundry |
| `npm run art:creatures -- <folder>` | Adds bestiary art (a full picture and a face-cropped thumbnail), matching each image to a creature by its file name |
| `npm run inbox:post -- --title "…" --body "…"` | Posts an announcement to everyone's inbox. Add `--kind patch-notes` for patch notes, or `--body-file notes.txt` for a longer body (line breaks are kept) |

The settings go in `server/.env`; see `server/.env.example`. Key ones are `DATABASE_URL`, `UPLOAD_SECRET`, and the commented S3 block.

**Local files that aren't in git** (each machine needs its own copy):
- `client/src/assets/art/placeholder-hero.png`: Capcom placeholder art, never publish it,
- `client/public/sheets/pf2e-remaster-character-sheet.pdf`: Paizo's fillable sheet, see `docs/character-sheet-pdf.md`,
- `server/uploads/`: local stand-in for S3,
- `server/.env`.

---

## How the code is organized

The database's tables and how they connect are drawn in [database-schema.md](database-schema.md). Update it when `server/db/schema.sql` changes.

```
packages/rules/        Rules engine: pure functions, no dependencies. Shared by client and server.
  src/                   proficiency, character stats, combat, conditions, GM math, builder.js,
                         data.js (how the data is split and reassembled), load.js (Node loader)
  data/                  Imported rules data (committed): <book>/<type>.json plus index.json
  corrections/           Per-book rule corrections (see below)
  scripts/import-pf2e.js The importer
  test/                  rules.test.js, builder.test.js, sweep.test.js, data.test.js
client/                React app (Vite)
  src/pages/             Login, Register, Characters, Campaigns, Account, Builder, Campaign pages, Sheet/Turn/Roll/GM
  src/builder/           Builder steps, Showcase (character select), OptionList, art.js
  src/sheet/             PDF export: fill logic, field map, open/download
  src/state/             Auth, table state, campaign service, portraits, inbox
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
- **Demo mode:** "Try the demo" (`POST /api/auth/demo`) makes a real, temporary account for each visitor and signs them in, so the demo runs the same code as everyone else (`server/src/demo.js`).
  - **What it comes with:** "Traveler" runs *Wolves at the Ford* with Mira in the party. Mira is now built in the builder, so she can be edited. A pretend player, **Sam**, has asked to bring his ranger **Kestrel** in, so a join request waits in the inbox. Sam also runs *The Sunken Vault*; the welcome message gives its invite code, and Sam accepts requests to it about five seconds later (`answerBotRequests`, run when the inbox or character list loads). The characters' builds are `SAMPLE_BUILDS` in the rules package, and a test keeps them valid.
  - **Separate worlds:** a demo only finds its own campaigns' invite codes, and nobody else finds them (`canJoin`).
  - **Lifetime:** demo accounts are deleted, with Sam, their characters, campaigns, messages and uploads, when the visitor exits the demo, or after 24 hours (`scheduleDemoCleanup`, hourly and on start). The banner shows the hours left.
  - **Ending:** a demo's sign-in stops working at exactly 24 hours (`userForToken`), and the hourly cleanup deletes it afterwards. In the last hour the banner turns red, counts down the minutes, and offers **Create an account**, which ends the demo and opens sign-up. When time runs out the banner checks with the server and the app signs out by itself.
- **Signed out mid-session:** any "not signed in" (401) answer while the app thinks you're signed in sends you to sign-in with a note: "Your demo has ended…" for a demo, or "You were signed out…" for an account (`SIGNED_OUT_EVENT` in `api.js`, handled in `AuthContext`). The browser remembers whether it was last in a demo or an account (`rollbound.lastSession`), so someone returning after their demo ended sees the note too. Signing out on purpose shows nothing.
  - **Limits:** 20 demos per IP address per hour (in memory). Demo accounts have a made-up `@demo.invalid` address that's never shown, and no password, so they can't sign in again after exiting.
  - The demo needs the API running now; the old in-browser imitation is gone.
- **Profile:** the Account page (`/account`) sets the display name and profile picture. Sign-up has an optional picture too; it uploads after the account exists, and if that fails the user lands on the Account page with a note.

### 2. Home, Characters and Campaigns pages
- **Home** (`/home`, `pages/HomePage.jsx`) is where signing in lands and where the wordmark goes.
  - **Order, top to bottom, one full-width row each:** the welcome band, Explore, My Characters, Campaigns.
  - **Welcome band:** the greeting over a black-and-white map (`client/src/assets/home-map.webp`) under a dark wash (no buttons).
  - **Explore:** tiles (icon, name, one line) for the Bestiary, Spell Book, Learning The Game and Resources: four across on wide screens, two on tablets, one on phones.
  - **My Characters:** cards (`CharacterCard`, shared with `/characters`) with **+ New** and **See All**.
  - **Campaigns:** one list of compact rows (`CampaignRow`), hosted ones first, each once, with a **Game Master** or **Player** badge, cover, Adventure Path or Homebrew, player count, who runs it, and which of your characters plays; one across on phones, two or more on wider screens. Edit, Encounters and Delete live on `/campaigns` and the campaign page.
- **Hover and focus:** character cards, campaign cards, campaign rows and Explore tiles get a red border and gold name on hover or keyboard focus. Card art leans in slightly (none with reduced motion), matching the Resources tiles.
- **Characters** (`/characters`, `pages/CharactersPage.jsx`) is the full list of your characters.
  - It shows only your characters, as cards: the class's card strip behind the portrait (`class-<slug>-card.webp`, a detail-picked crop of the 1920×1080 banner made by `npm run art:import`, falling back to the class portrait, faded; see `docs/adding-art.md`), name, "Level · Ancestry · Class", and campaign (plus "Asked to join …" or "Rules updated").
  - Each card has **View** (the sheet), **Edit** (the builder; off for characters without builder choices) and **Delete** (asks first; `DELETE /api/characters/:id`).
  - Search covers name, level, ancestry, class and campaign. Sort by name, level, or created newest or oldest; the choice is remembered (`rollbound.characterSort`). **Create a Character** sits top right.
- **Campaigns** (`/campaigns`, `pages/CampaignsPage.jsx`) has two sections:
  - **Campaigns I'm Hosting:** View, Edit, Encounters, and Delete (asks first). Deleting from the campaign's Edit page also lands here, with a notice.
  - **Campaigns I'm Playing:** campaigns your characters are in, including any you also host, with View and Session Logs, followed by the join-a-campaign box.
  - Cards show the cover, the party's portraits (up to six, then "+N"), Adventure Path or Homebrew, the start date, the player count, and your role ("Role: Game Master" or "Run by …"). The campaign list API now includes each campaign's party (`party`: id, name, level, portrait, and whether it's yours).
- The old Player Mode / Game Master Mode toggle is gone; the header's menus and the breadcrumbs ("Characters", "Campaigns") lead to these pages.
- Each character opens at `/play/:id/sheet` (with `spells`, `inventory`, `lore`, and the hidden `turn` and `roll`). Anyone with a character's share link can view it at `/sheets/:shareId`.

### 3. Character builder (`/create`)
- **Nine steps:** Ancestry, Background, Class, Attributes, Skills, Feats, Spells, Gear, Review.
- **Teaching:** each step has a short note explaining its rule.
- **Drafts:** the draft is saved in `localStorage`, and Reset (in the header) clears it.
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
- **Saving:** sends the character to the API, with an optional portrait.

### 3a. Builder start: build your own or a pregenerated hero
- A new character opens on **How do you want to start?** (`builder/StartStep.jsx`), before step 1: **Build your own** goes to the steps; **Play a pregenerated hero** opens a gallery of Paizo's iconics. Picking one loads their build (cleared of anything a campaign's books rule out) and jumps to Review, where it can be renamed and saved like any character. Back on step 1, or Reset, returns to the start screen. The draft remembers the choice (`start`); drafts from before this screen count as Build your own.
- **Pregens:** 18 of Paizo's 23 level 1 iconics, every one whose class the builder offers (Grimmyr, Nahoa, Samo, Ulka and Yoon wait on Guardian, Exemplar, Animist, Commander and Kineticist). Each is transcribed by name from its sheet in `packages/rules/pregens/specs.js`; `npm run pregens -w packages/rules` (`scripts/build-pregens.js`) finds every choice in the rules data, solves the attribute boosts that give the sheet's attributes, splits skills into granted and chosen, checks the build with `buildProblems()`, compares HP, AC, Perception and saves with the sheet (all 18 match), and writes `src/pregens.js` (`PREGENS`: `{ slug, name, ancestry, heritage, className, classSlug, pdf, notes?, build }`). A test keeps every pregen valid.
- **Where they differ from the sheet** (the script prints these as notes): regional languages (Kelish, Mwangi, Varisian…) aren't in the builder's language list; skills trained by feats the builder doesn't model are left off (Harsk, Sajan and Seelah's Stealth, Nhalmika and Seelah's Society); a few spells the class or muse grants differently are trimmed; Fumbus uses Courier for Pathfinder Hopeful, Korakai a staff for the khakkara, and Nhalmika drops the reinforced stock to stay within 15 gp. Wizard and witch spellbooks/familiars are filled out beyond the sheet's prepared spells.
- **Builder fixes found on the way:** Versatile Human now gets its 1st-level general feat (a bonus slot keyed by the heritage's ID; Mira took Toughness), and Armor Proficiency and Weapon Proficiency now actually train light/medium/heavy armor and martial weapons (`proficienciesOf`).
- **Original sheets** are in `client/public/pregens/` (`Pregens-<Hero>-Lvl1.pdf`); the gallery links each one.
- **Gallery cards** show each hero's whole class portrait, fitted (not cropped), with the name below.
- **Headshot portraits:** picking a hero preloads a square headshot as their portrait (saved with the character like an upload; it can be changed or removed on Review). The headshots are `client/src/assets/pregens/<slug>.webp`, cut from the class portraits by `npm run art:pregens -w client` (`scripts/pregen-headshots.mjs`): it finds the head as the topmost wide, solid shape in the transparent art, with hand-set crops in `FOCUS` for Jirelle, Korakai and Nhalmika.

### 4. Rules data import
- **Source:** the Foundry VTT pf2e system's open data, filtered to the books in `BOOKS` (Player Core, Player Core 2 and Guns & Gears) and pinned to an upstream commit recorded in `meta.commit`.
- **Hand-made books:** Impossible Magic and Dark Archive (Remastered) aren't in Foundry (or only in an older edition), so they come from the Archives of Nethys (`packages/rules/books/`, sections 12–13). When Foundry adds it, follow `books/README.md` to switch over.
- **Deities:** these come from Foundry's `core-gods` folder, which is Player Core's list.
- **Items:** general gear of every level (`items`: adventuring gear, consumables, containers, kits, treasure; 536 across Player Core, Player Core 2 and Guns & Gears) for the Inventory tab. Weapons, armor and shields stay level 0–1 for the builder. The hand-made books don't have items yet.
- **Re-importing the same commit:** `PF2E_COMMIT=<sha> npm run data:import -w @rollbound/rules` re-imports from that commit instead of the latest master. That's how items were added without changing anything else; the current sha is `meta.commit` in `data/index.json`.
- **Corrections:** rules Foundry encodes only in its own code come from `packages/rules/corrections/<book>.json`. After each import, a report lists anything that looks like it needs a correction.

### 5. Playing a character
- **Sheet:** defenses, saves, Perception, skills (including the armor check penalty), class DC, and spell attack and DC. Tapping a number shows its breakdown. It also has the portrait editor and the PDF export button.
- **Backdrop:** on the Sheet tab, the class's banner fills the page under the tabs at full width and its 16:9 shape, at 25% opacity so the page's red-to-black gradient shows through, then fades out (`components/SheetBackdrop.jsx`, in both the play shell and the read-only sheets). Classes without a banner have none. Older characters without a `classSlug` (the seeded sample) get theirs from the class name (`classSlugOf`).
- **Hit points:** the globe fills to current over max HP (10 of 20 is half full), with max HP printed under it. It pulses at 25% or less, and glows gold for a moment whenever HP goes up. The Hit points panel takes damage, heals, or restores to full. Current HP is saved in `characters.current_hp` (NULL means full, so a higher max after a level-up stays full) via `PUT /api/characters/:id/hp`, half a second after the last change. A change still waiting is sent when you leave the character or close the tab (`keepalive`). Demo characters keep HP for the visit only.
- **Edit character:** the owner's sheet links to the builder's edit mode (`/characters/:id/edit`). Only the owner can load or save a character (the server checks), and the shared link never shows the button. Characters without saved builder choices (the sample Mira, seeded characters) can't be edited, so they don't get the button.
- **Campaign:** the sheet names the one campaign the character is in, linked to its page ("No campaign yet" otherwise).
- **Share link:** every character has a random `share_id` (16 URL-safe characters, 96 bits, so links can't be guessed). `/sheets/:shareId` shows the sheet read-only to anyone, signed in or not, through the public `GET /api/sheets/:shareId`. That returns only what the sheet shows: no owner, user or campaign ids. The shared view has no HP controls, portrait editor, rules notice, share panel or play tabs, and starts with no conditions. The owner's sheet has a Share panel with Copy and **Make a new link**, which replaces the link (`POST /api/characters/:id/share-link`) so the old one stops working. `db:setup` gives older characters a link.
- **Strikes:** the Sheet lists each equipped weapon's attack bonus, damage and traits; tapping one shows the attack math. With the Turn tab hidden, this is where attacks show.
- **No starting conditions:** characters used to open with a sample Frightened 1. With the Turn tab hidden there was no way to clear it, so they now start with none.
- **Tabs:** Sheet, Spell Book, Inventory and Lore, at `/play/:id/sheet|spells|inventory|lore`. The shared link has the same four at `/sheets/:shareId/...`, read-only.
- **Spell Book:** every spell the character knows (`character.spellcasting` cantrips and rank 1), grouped by rank, with spell attack, DC, slots and how the class casts. Opening a spell shows its traits, range, area, targets, defense, duration and full rules text, looked up in the rules data by id. Non-casters get a short note.
- **Inventory:** items and coins (pp, gp, sp, cp) in `characters.inventory`, via `PUT /api/characters/:id/inventory` and checked by `inventoryProblems` (`packages/rules/src/inventory.js`). Until first edited (NULL) it shows `startingInventory`: the builder's gear and what's left of the 15 gp. Search the rules' gear to **Add** it, or **Buy** it, which pays from the coins and makes change (`payCoins`); custom items take a name, quantity and Bulk. Rows open for quantity, a note, Remove, and the item's rules text. Bulk totals the Pathfinder way (10 L = 1) against the encumbered (5 + Str) and maximum (10 + Str) limits. The campaign's books limit what can be added; custom items are always allowed. **Equipping:** weapons, armor and shields have Equip/Unequip (Wear/Take off for armor), with any number of weapons and one armor and one shield at a time (`toggleEquipped`). The sheet everyone reads is `equipCharacter(built sheet, inventory, gear data)`: Strikes from the equipped weapons (a fist if none), AC from the worn armor and shield. `TableContext` exposes it as `character`, and keeps the built sheet as `baseCharacter` for rules updates and the builder. The server uses it for the hub card's AC (`equippedSheet` in `routes/characters.js`). The builder's gear starts equipped, and so does gear from an inventory saved before equipping existed (no `equipped` flags). The client spells out every flag when it saves. Armor or weapons the character isn't trained with get an **Untrained** tag and a warning, since wearing untrained armor can lower AC.
- **Lore:** the player's backstory (`characters.backstory`, up to 20,000 characters, `PUT /api/characters/:id/backstory`), which saves a second after you stop typing. Below it are the character's origins and their background's rules text, attribute boosts (and the ones chosen), trained skills and skill feat.
- **Saving:** HP, inventory and backstory all go through `useDelayedSave` (`client/src/state/useDelayedSave.js`): a moment after the last change, and again when leaving or closing the tab. Builder edits don't touch them.
- **Encounter screens (hidden for now):** Turn and Roll below only show while the character is in an active encounter. `ENCOUNTER_ACTIVE` in `TableContext.jsx` is `false` until the campaign manager gets its encounter tracker. Then it should be true when the character's campaign has an encounter with an active status that includes them. While it's false, those tabs and the round counter are hidden and `/play/:id/turn|roll` go back to the sheet (`EncounterOnly` in `App.jsx`).
- **Turn:** the 3-action economy, the multiple attack penalty, and conditions.
- **Roll:** degrees of success, with the correct Strength damage for melee, thrown, propulsive and ranged weapons.
- **GM:** encounter budget and initiative. It still uses the character's level, not the campaign's party level.

### 6. Campaigns
- **Fields:** title, backstory, party level and cover image, all editable by the GM.
- **Invite codes:**
  - format `XXXX-XXXX`, with no look-alike characters (0/O, 1/I/L),
  - unique in the database, accepted in any case with or without the dash,
  - **permanent:** once generated a code never changes (the replace route and button are gone),
  - only the GM sees it: the campaign page, list and invite preview leave it out for everyone else.
- **Joining:** a player previews the campaign from its code, then picks a character and **asks to join**. The GM accepts or rejects it (section 15). The GM's own characters join their campaign directly. A character is in one campaign at a time.
- **Campaign page:** cover, backstory, the party (portraits and player avatars), and the invite code (GM only).
- **Party sheets:** each party card's portrait and name open that character's sheet. Your own opens your playable sheet (`/play/:id`). Anyone else's opens read-only at `/campaigns/:id/characters/:characterId`, with all four tabs. The server (`GET /api/campaigns/:id/characters/:characterId`) only returns it to the campaign's GM and players with a character in it, which includes the character's own player. The public share link (`/sheets/:shareId`) is separate: it's for owners sharing outside the campaign.
- **GM controls:** **Remove** on other players' characters, with a confirm (`POST /api/campaigns/:id/remove`). The character stays with its player, in no campaign, and its player can rejoin with the code. **Delete campaign** is at the bottom of the Edit page, with a confirm (`DELETE /api/campaigns/:id`). Its characters stay with their players, in no campaign; the cover image is deleted and the hub says so. Players can still Leave with their own characters.

### 6a. Creating a campaign, step by step
- **Steps** (`pages/CampaignCreatePage.jsx`), with diamonds like the character builder's:
  1. Adventure Path or Homebrew.
  2. For an Adventure Path, which one.
  3. The details (the same `CampaignForm` as before, with a Back button).

  Homebrew skips step 2.
- **Adventure Paths** (`packages/rules/src/adventurePaths.js`): all 26 Second Edition Adventure Paths, newest first. That's 14 for the Remastered rules plus the 12 written before it (Age of Ashes, 2019, through Sky King's Tomb, 2023), which are flagged `preRemaster` and tagged **Pre-Remaster**. The Remastered ones run from Seven Dooms for Sandpoint and Wardens of Wildwood (2024) through Bastion of Blasphemies (July 2026), the remastered Gatewalkers and Season of Ghosts hardcovers, and Vaultlines (out 4 November 2026, marked Coming soon).
  - Each has its level range, setting, the first volume's date (or the hardcover's for one-book editions), and flags for mythic rules, editions, sequels and `preRemaster` (with a note when chosen).
  - Gatewalkers and Season of Ghosts appear once, as their remastered hardcovers.
  - Tests keep the list newest first and check that everything from before November 2023 is tagged Pre-Remaster.
  - Facts are from PathfinderWiki and the Archives of Nethys. Add new paths there as Paizo releases them; a test checks the list.
- **Themes:** each path has theme tags from `THEMES` (Beginner friendly, Dungeon crawl, Horror, Mystery, War, Rebellion, Diplomacy, Intrigue, Wilderness, Exploration, Small town, City, Kingdom building, Heist, Magic school, Tournament, Mythology). The filter buttons start with **Remastered** and **Pre-Remaster**. **High level** is added automatically for paths starting at level 10 or more (`pathThemes`). Buttons above the grid filter by theme; on phones they're one row that scrolls sideways.
  - **Beginner friendly** is only on paths Paizo's store points new players to: Abomination Vaults and Season of Ghosts.
  - The other tags come from each path's researched premise. Adjust them in `adventurePaths.js`; a test checks every tag is known.
- **Choosing one** opens its premise in its card, with notes: the starting level when it isn't 1 (the builder only makes level 1 characters), mythic rules RollBound doesn't track, an upcoming release, or a story it continues.
- **Prefilled, never final:** the details step fills in the title (the path's name), the party level (its starting level), the backstory (its premise) and the cover (its cover, if there is one). Notes say they're a starting point, and **start from blank** clears the backstory. Nothing is saved until **Create campaign**, and the cover uploads like one the GM picked.
- **Premises** are our own, short and spoiler-free, because players read a campaign's backstory. Paizo's product text is theirs, and their GM synopses give away twists.
- **Covers aren't included.** They're Paizo art with the Pathfinder logo, which neither the ORC license nor the Community Use Policy covers. Add them locally with `npm run art:import` (`adventure-<slug>.jpg`), which turns each portrait cover into a 1600×900 wide one. The files are git-ignored; see `client/src/assets/adventure-paths/README.md`. Without a cover, the path shows a title card and the campaign starts with no cover.
- **Stored:** `campaigns.adventure_path` (the slug, or NULL for homebrew), set at creation. The Overview shows it with its levels and setting.

### 6b. Campaign tabs: Session logs and Encounters
- **Tabs:** a campaign has **Overview** (the page it always had), **Session logs**, and **Encounters** for the GM only, in GitHub's underlined style under the header. `CampaignLayout` in `pages/CampaignPage.jsx` loads the campaign once and hands it to each tab (`useCampaign()`), and each tab adds its own breadcrumbs (`useCampaignCrumbs`).
- **Session logs** (`session_logs` table, `server/src/routes/sessionLogs.js`, `pages/SessionLogPages.jsx`):
  - The GM writes, edits and deletes blog-style recaps: a title, the date played, and the text (up to 50,000 characters; a blank line starts a new paragraph).
  - The GM and players with a character in the campaign read them; anyone else gets a 404, and players get a 403 for writing.
  - Logs are numbered "Session 1, 2, …" by the date played (undated ones last), and the list shows them newest first with an excerpt.
  - They belong to their campaign only, and deleting the campaign deletes them.
  - Routes: `/campaigns/:id/logs`, `logs/new`, `logs/:logId`, `logs/:logId/edit`. API: `GET|POST /api/campaigns/:id/logs`, `GET|PUT|DELETE /api/campaigns/:id/logs/:logId`.
  - DATE columns come back from Postgres as text (`db.js`), so a session's date can't shift by a day across time zones.
- **Encounters** (`encounters` table, `server/src/routes/encounters.js`, `pages/EncountersPage.jsx`), for the GM only: players don't get the tab, and the API answers 404 to anyone else.
  - **The tab** lists the campaign's saved encounters, newest first, each with its creatures, XP and threat. **New encounter** opens the editor at `/campaigns/:id/encounters/new`; a saved one opens at `/campaigns/:id/encounters/:encounterId`.
  - **The editor** has a name and notes. Creatures come from the bestiary or are homebrew (a name and a level); adding the same bestiary creature again raises its count. Each row has a count stepper, its XP, and Remove, and bestiary creatures link to their page (`/bestiary/creature/:id` finds them by ID).
  - **Rating:** XP and threat update live on the budget bar. Up to 40 kinds of creature, 20 of each.
  - **The bestiary picker** searches by name or trait and, by default, shows only creatures the budget can price (party level −4 to +4), nearest first.
  - **The party** follows the campaign automatically: its characters' count and their average level, or four at the campaign's party level before anyone joins. The party panel shows both as two number tiles. Typing a number sets it for that encounter (the tile turns bronze, with **Reset to N**), and typing the party's own number goes back to following it. NULL in the database means "follow the party", so it keeps up as characters join, leave and level up.
  - **Saving:** Save, Unsaved changes, and Delete with a confirm. The XP budget with what each threat means, a collapsible "what creatures are worth" table, and the level DC stay beside it.
  - API: `GET|POST /api/campaigns/:id/encounters`, `GET|PUT|DELETE /api/campaigns/:id/encounters/:encounterId`. Deleting the campaign deletes its encounters.
  - The mock GM tab on character screens, with its made-up initiative list, is gone. Running an encounter (initiative, turns) belongs to the encounter tracker, which will start from a saved encounter.

### 6c. Bestiary
- **What:** every creature in Monster Core (445) and Monster Core 2 (395), levels −1 to 25, at `/bestiary`, linked from the ☰ menu. Signed-in users only.
- **Data** (`packages/rules/bestiary/`, one JSON file per book plus `index.json`): built by `npm run data:bestiary -w @rollbound/rules` (`scripts/import-bestiary.js`) from the Archives of Nethys search index, cached in `node_modules/.cache/aon-bestiary` (`--refresh` re-downloads).
  - Each creature has its numbers for filtering and encounters: level, HP, AC, Perception, saves, attributes, size, rarity, traits, family, speed, immunities, resistances and weaknesses.
  - It also has its lore, Recall Knowledge DCs, sidebars, book and page, an AoN link, its pre-Remaster name (an Adamant Sentinel was an Adamantine Golem), and the whole stat block as HTML with Pathfinder's action symbols.
  - It's kept apart from the builder's rules data so it doesn't count toward the 5 MB budget or slow the builder. The client loads both books only when the Bestiary opens (about 400 KB compressed each).
- **Checked:** the import compares Monster Core against Foundry VTT's independent copy. Of 418 creatures in both, 413 agree on level, HP, AC, Perception and saves; 5 don't (Air Scamp Fortitude, Dero Stalker AC, Giant Monitor Lizard AC, Centaur Herbalist HP and Will, Azuretzi HP), likely errata applied in one source and not the other. Foundry has no Monster Core 2 yet, so it's AoN only. `test/bestiary.test.js` checks every creature has its numbers and a clean stat block.
- **Pages:** `pages/BestiaryPage.jsx` has search (name, old name, or trait), filters for level range, creature type, size, rarity and book, and Clear filters. The filters live in the address, so a filtered list can be bookmarked. It shows 60 at a time. `pages/CreaturePage.jsx` (`/bestiary/mc/:slug`, `/bestiary/mc2/:slug`) shows quick stats, lore, Recall Knowledge, sidebars, the stat block, the book and page, and the creature's family with a filtered-list link.
- **Used by** the Encounters tab's creature picker.
- **Art** (optional, per creature), in `client/src/assets/creatures/`:
  - `<slug>.webp` is the whole picture, fitted inside 900×1600 (9:16 art keeps its shape). It shows uncropped at the top of the creature page's lore column, up to 640px tall, and opens full size when tapped.
  - `<slug>-thumb.webp` is a 192×192 square, cut around the most detailed part of the picture (sharp's `attention` crop, usually the face). It's used on bestiary cards (with the level as a corner badge) and in the encounter picker.
  - Creatures without art look as before.
  - Add art with `npm run art:creatures -- <folder>` (`client/scripts/import-creature-art.mjs`). It matches files by creature name in any style ("Goblin Warrior.webp", "goblin_warrior.png", or a pre-Remaster name), makes both files, and lists unmatched files with suggestions.

### 6d. Spell Book
- **What:** every spell in the rules data (1,028 from Player Core, Player Core 2, Impossible Magic and Dark Archive: 725 cantrips and spells of ranks 1–10, 272 focus spells and 31 rituals) at `/spells`, linked from the ☰ menu as **Spell Book**. The breadcrumb reads "Spells".
- **List** (`pages/SpellBookPages.jsx`, built like the Bestiary): search by name or trait, filter by type (Spells, Focus Spells, Rituals), rank (cantrips, 1–10), tradition, rarity and book. The filters live in the address. Ordinary spells come first, then focus spells, then rituals, each by rank, 60 at a time. Each card shows rank, cast time (action symbols), notable traits, traditions and defense.
- **Each spell's page** (`/spells/:slug`; `/spells/id/:spellId` finds one by ID) shows "Cantrip 1", "Spell 3", "Focus 1" or "Ritual 5" as the books do, the traits, traditions, cast time, range, area, targets, defense and duration, then the full rules text, the book, and an Archives of Nethys search link.
- **Character pages:** the character tab formerly called Spell Book is now **Spells** (`pages/CharacterSpellsPage.jsx`), and each spell there links to its Spell Book page.
- **Every spell is imported:** all of Foundry's spell folders (`PACK_PATTERNS` in `scripts/import-pf2e.js`), and every spell, focus spell and ritual from the AoN books (`import-aon.js`). Each spell has a `kind`: `spell`, `focus` or `ritual`. The builder's `spellOptions` still offers only ordinary common cantrips and rank 1 spells, and a test checks that no focus spell, ritual or higher rank reaches a level 1 character. The builder's Spells step now downloads more data (about 1.3 MB, roughly 300 KB compressed).

### 6e. Learning The Game and Resources
- **Open to everyone:** both pages work signed out (their routes sit outside the sign-in guard in `App.jsx`), so visitors can read them without an account. The ☰ menu links to both.
- **Learning The Game** (`/learn/:topic`, `pages/LearnPage.jsx`; `/learn` opens Overview): a single reading column, with a sticky "On this page" list of the tab's lessons beside it on wide screens (it marks the lesson being read). Tabs for Overview, Character Creation, Combat, Skills & Exploration, Spells and Game Mastering. The content is data in `client/src/learn/lessons.js`: each lesson has paragraphs and optionally a list, a small table, an "In RollBound" tip linking to the feature that helps (builder, Spell Book, Bestiary, campaigns), and an Archives of Nethys link. Rules follow the Remaster (Player Core, GM Core). Each tab ends with a link to the next.
- **Resources** (`/resources`, `pages/ResourcesPage.jsx`): a "New to Pathfinder? Start here" strip (Learning The Game, Paizo's free demo adventure, Archives of Nethys), then tiles linking out, in new tabs, to Paizo's free downloads (demo adventure, pregenerated heroes), Archives of Nethys, the Paizo store and Foundry VTT's Pathfinder system. Each tile is headed by a class's card crop (`RESOURCES[].art`) and shows its site and tags (Free, Official, Paid, Play online).
- **Fix found while writing it:** the encounter builder's Low threat added 15 XP per extra character. GM Core says 20 (Table 10-1), so `THREATS` in `packages/rules/src/gm.js` and its test were corrected.
- **Server rules reload:** `server/src/rules.js` reloads the rules data when `packages/rules/data/index.json` changes. Before, a running server kept the version it started with, so demo characters made after a data re-import showed "Rules updated" straight away.

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

### 8b. Fonts
- **Beaufort for LOL** (`--display` and `--body`) everywhere: 400 for body text, 500 medium, 700 for headings, card names, labels, buttons and tabs, and 900 (heavy) for page titles (`.title`), the sheet's character name and the wordmark. Italics at 400 and 700.
- **Old Fenris** is kept in `@font-face` and as `--accent-font` for some future one-off element. Nothing uses it yet, so browsers don't download it.
- The files are self-hosted in `client/src/assets/fonts/` as WOFF2, trimmed to Latin characters with `pyftsubset` (about 215 KB together, Old Fenris being 108 KB of it). Google Fonts (Cinzel, Spectral) is no longer loaded.

### 9. Responsive design
- **Approach:** mobile first, with the layout switching at 768px (tablet) and 1024px (desktop).
- **Desktop:** two columns, and the content area widens to 1180px.
- **Components:** sized by the space they actually have (container queries).
- **Touch and comfort:** larger tap targets on touch screens, hover effects only with a mouse, phone notch and home-bar areas respected, and reduced-motion support.

### 9b. Header (laid out like GitHub's)
- **One header everywhere:** `components/TopBar.jsx`, used by `PageShell`, the hub, the play screens, the builder and the read-only sheets.
- **Left:** the ☰ button opens a side menu (`SideNav.jsx`): Home, Characters, Campaigns, Bestiary, New Character, New Campaign, Your Account, Sign Out / Exit Demo. Menu items are in Title Case. Next come the ROLLBOUND wordmark (home) and breadcrumbs, such as `Characters / Mira Ashvale` or `Campaigns / Ashen Road / Edit`. Each page passes its crumbs: "Characters" links to `/characters` and "Campaigns" to `/campaigns`. Phones show only the last crumb, and hide the wordmark when there's a crumb to make room.
- **Right:** page actions (Edit, Cancel, Reset, Close, View only), the **+** menu (New Character, New Campaign), the inbox, and the avatar menu (name, Your Account, Home, Characters, Campaigns, Sign Out / Exit Demo). Signed out (a shared sheet), it shows only the wordmark, crumbs and Sign in.
- **Menus** (`Menu.jsx`): Escape or a click outside closes them, arrow keys move between items, and focus returns to the button.
- **Tabs:** the character tabs (Sheet, Spell Book, Inventory, Lore) sit under the header on every screen size as an underlined row, scrolling sideways on narrow phones. They used to be a bottom bar on phones.

### 10. Builder art
- **Classes:** portraits are Paizo's Remaster iconics, and the 16 tile icons are Adventure Card Game emblems. The Investigator and Swashbuckler icons were cut from coin photos.
- **Saved for later:** art for classes not yet in the builder: animist, commander, exemplar, guardian, gunslinger, inventor, kineticist, magus and summoner.
- **Ancestries:** eight borrow a class iconic for now (`BORROWED` in `art.js`), and the rest use the placeholder or a letter. Human uses Valeros, with a hand-tuned tile crop in `TILE_FOCUS`.
- **Adding art:** files are found by name in `client/src/assets/art/`, as `<kind>-<slug>.webp` for portraits and `<kind>-<slug>-icon.webp` for icons. `npm run art:import` converts them and warns about icons whose corners aren't transparent. Full guide: `docs/adding-art.md`.

### 11. Scalability work (steps 0–6 of the roadmap)
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

### 14. Campaign books (roadmap step 5)
- **What the GM sees:** a "Books" field on the campaign form, either *every book, including ones added later* (the default) or *only these books* with Player Core always in.
  - Stored in `campaigns.books` (`TEXT[]`, `NULL` = every book), and validated against the real book list.
  - Shown on the campaign page and in the invite preview.
  - Editing a campaign without sending `books` keeps the current list.
- **Building for a campaign:**
  - Open `/create?invite=CODE`, using the "Build a new character for…" link in the join panel or the GM's "Build a character for this campaign" button, or enter a code in the builder's campaign bar.
  - The builder then offers only that campaign's books, clears choices from other books with a note saying which, and saving also asks to join the campaign (or joins it, for the GM's own characters; see section 15).
  - The draft remembers the campaign across reloads.
- **Joining** is refused if a character picked anything from a book the campaign doesn't allow. The error names each choice, for example "Gunslinger (Guns & Gears)". The server checks this for accounts, and the demo store does the same check.
- **When the GM narrows the books later:** the roster flags characters who no longer fit, and the owner gets an **Edit** link. Editing a character in a campaign offers only its books and lists the choices to re-pick, each with the reason.
- **How the filtering works (`campaignData` in `src/data.js`):**
  - It filters the *options* players pick from.
  - Feats and spells that allowed content *grants* stay, whichever book prints them. For example, a Dark Archive background grants a Player Core 2 feat.
  - Support books (Divine Mysteries' deities, older feats a class grants) always load.
  - `bookIssues()` names the choices from outside books.
- **Tests:** 162 in total. The sweep now also builds every book as its own campaign (Player Core plus that book) and checks nothing comes from outside it.
- **Verified live:**
  - The API was run against a real Postgres: a private instance in the scratch folder, since the system one needs sudo. That covered create, validation, invite preview, join refusal and acceptance, editing, and roster flags. `db:setup`, including the build migration, also ran cleanly there for the first time.
  - The demo flow was clicked through in Chrome: 15 checks, from creating a campaign to editing a flagged character.

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

### 15. Inbox and join requests
- **Inbox:** a button next to your avatar in every top bar (`components/Inbox.jsx`, in the header), with an unread badge. It loads on page load, every minute, when the tab comes back into view, and when something changes (`state/inbox.js` sends a window event). Opening it marks what's there as read. The panel drops down on desktop and spans the screen on phones; Escape or a click outside closes it.
- **Messages** (`messages` table): `user_id` NULL is for everyone (`announcement`, `patch-notes`); otherwise it's one user's (`join-request`, `join-accepted`, `join-rejected`). `message_reads` records who read what. Messages for everyone from before you signed up count as read, so new accounts don't open to a backlog. The newest 100 show. `GET /api/inbox`, `POST /api/inbox/read { ids }`.
- **Posting announcements and patch notes:** `npm run inbox:post` (see Running it). There's no admin screen yet.
- **Join requests** (`join_requests` table, `server/src/joinRequests.js`):
  - Entering an invite code no longer joins. `POST /api/campaigns/join` checks the books and answers `202 { status: 'pending' }`, and the GM gets a message naming the character, their ancestry, class and level, and the player.
  - **Accept** (in the inbox, or under **Waiting to join** on the campaign page) adds the character to the party. **Reject** doesn't. Either way the player gets a message back. `POST /api/join-requests/:id/accept|reject`, GM only.
  - Accepting re-checks the campaign's books. If they changed since the request, it explains why and the request stays pending, so the GM can reject it.
  - A character has one pending request at a time: asking another campaign withdraws the first (a unique index enforces it), and asking the same one again changes nothing.
  - The GM's own characters join their own campaign straight away (`200 { status: 'joined' }`); the invite preview's `isGm` tells the client which button to show.
  - The hub's character card says "Asked to join …" while waiting (`joinRequest` on the character).
  - Deleting a campaign or character deletes its requests and their messages.
- **Demo mode:** the demo comes with a real request from Sam to answer, and Sam answers the visitor's requests (section 1).
- **Why:** a leaked invite code can no longer get a stranger into a party, since the GM decides who joins.

## Key decisions and why

| Decision | Why |
| --- | --- |
| Rules data imported from Foundry, not typed by hand | Complete and accurate. Typing hundreds of feats from memory risked wrong numbers. |
| Corrections as per-book data | New books add data, not engine code; each book's fixes are on one page. |
| Foundry IDs for saved choices | Names change and collide across books; IDs don't. |
| Shared rules package | The client and server compute the same numbers. |
| Presigned direct uploads | Files never pass through the API; the same flow for local and S3. |
| Demo mode as a temporary server account | The demo runs the real code, with no copy to keep in sync, and can show features that need a second person (join requests). The cost: it needs the API, and the server cleans demos up. |
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

- `npm test`: 162 rules tests, covering the engine, builder rules, ID migration, ID uniqueness, the corrections, rules-data updates, the data files and their size budget, and an empty import report.
- **Build sweep** (`test/sweep.test.js`): every class with every ancestry, heritage, background, subclass option and deity must produce a valid character with a complete sheet. A failure names the combinations that broke.
- **GitHub Actions** runs the tests and a client build on every push and pull request.
- **UI checks:** done with headless Windows Chrome screenshots from WSL, using a small proxy that sets demo or sign-in state. Tap-specific behavior wasn't testable this way.
- **S3:** tested against Versity Gateway locally, not real AWS.

---

## Gotchas

- **Postgres stops after WSL restarts.** Run `sudo service postgresql start`. For testing without sudo, a throwaway instance works: `initdb -D <dir> -U rollbound --auth=trust`, then `pg_ctl -D <dir> -o "-p 5433 -c unix_socket_directories=''" start`, and point `DATABASE_URL` at `postgres://rollbound@localhost:5433/<db>`. That's how `db:setup` (including converting saved builds) and the campaign-books API were run live.
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
- [ ] Bonus spells from domains, the deity, wizard curriculum, and the witch's lesson.
- [ ] Record the specific Lore subcategory from feats like Additional Lore.
- [ ] Optional GM approval of uncommon and rare options.
- [ ] Backgrounds with a skill choice (Scholar: Arcana, Nature, Occultism or Religion) and a chosen skill feat: the builder doesn't ask, so the Lore tab lists only the fixed Lore.
- [ ] Adventure Path covers: get permission to publish them (or design RollBound title cards), then stop ignoring `client/src/assets/adventure-paths/*.webp`.
- [ ] Settle the 5 Monster Core creatures where AoN and Foundry disagree, against the book (listed in section 6c).
- [ ] Hands: equipping doesn't check that weapons and a shield fit in two hands.
- [ ] Item batches (ammunition's Bulk is per 10, not each), and items for the hand-made books.
- [ ] Put the inventory and backstory on the PDF export.

---

## Scalability roadmap

From the planning discussion. Steps 0–6 are done.

| Step | What | Status |
| --- | --- | --- |
| 0 | Art discovered by file name, plus the `art:import` script | Done |
| 1 | Book-specific rules as corrections data, plus the import report | Done |
| 2 | Stable IDs for saved choices, plus migration | Done |
| 6 | The build sweep as a committed test that runs on every push (GitHub Actions) and after every import | Done |
| 3 | Stamp characters with the data version they were built with; flag choices that disappear after a re-import; "please re-pick" on the sheet | Done |
| 4 | Split the data file per book and type; load per step; move to Postgres at about 5 MB | Done; Postgres waits for the 5 MB test to fail |
| 5 | Each campaign chooses its allowed books; the builder filters by them | Done |
| 7 | Show licenses per item, a site footer, and refuse non-redistributable books by default | **Next**, before a public launch |

The biggest future jump is **leveling from 2 to 20**. It multiplies the feats, spells and features handled, so steps 1 and 6 matter even more then.
