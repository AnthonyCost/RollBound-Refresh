# RollBound

A Pathfinder 2e (Remaster) table companion that **teaches the rules while you play**. Every number on the sheet shows its math, the turn helper tracks your three actions and the multiple attack penalty, and every roll explains its degree of success.

Built with the PERN stack: **Postgres, Express, React, Node**.

## Screens

| Screen | What it teaches |
| --- | --- |
| **Hub** | Home after sign-in, with a Player Mode / Game Master Mode switch. Player Mode shows your characters (with HP and AC at a glance) and the campaigns they're in; Game Master Mode shows the campaigns you run. |
| **Builder** | Step-by-step level 1 character creation from Player Core and Player Core 2: ancestry, heritage, background, class and subclass, deity, attribute boosts, skills, languages, feats (with prerequisite checks and bonus feats), spells, and 15 gp of gear. Each step explains the rule it applies. Demo users can build and play a character for the rest of their session. |
| **Campaigns** | GMs create and edit a campaign's title, party level, backstory, and cover image, and get a unique invite code to share. Players enter the code on their hub to bring a character in. Demo users can try the whole flow; their campaigns last until the tab closes. |
| **Sheet** | Tap AC, a save, or Perception to see the breakdown: ability, proficiency rank + level, item bonus, armor's Dex cap, and condition penalties. The health globe fills to current HP; take damage or heal from the sheet. Shows the character's campaign, has a share link anyone can open read-only, and lets the owner reopen the character in the builder to edit it. Lists Strikes for the equipped weapons. |
| **Spell Book** | Every spell the character knows, by rank, with spell attack and DC and each spell's full rules text. |
| **Inventory** | Items and coins. Equip weapons and wear armor or a shield, and the sheet's Strikes and AC follow. Search the rules' gear to add or buy (paying from the coins), add custom items, and track quantity, notes and Bulk against your limits. |
| **Lore** | The player's backstory, plus the character's origins and background rules. |
| **Turn** | *(Hidden until the encounter tracker exists; shows during an active encounter.)* The 3-action economy. Strikes show the multiple attack penalty as it grows; conditions like Frightened apply to the numbers and tick down when you end your turn. |
| **Roll** | *(Hidden, like Turn.)* Rolls a Strike against the GM's target AC and shows where it landed on the four degrees of success, including natural 20/1 shifts and crit damage. |
| **GM** | *(Hidden, like Turn.)* Encounter XP budget for your party size and level, initiative order, and the DC for a level-appropriate challenge. |

## Project layout

```
packages/rules   Pure-function rules engine (no dependencies) + tests
                 data/: imported character-creation data, one file per book and type
client           Vite + React app (gothic dark-fantasy theme)
server           Express API + Postgres schema and seed data
```

The rules engine is shared: the client uses it for live math, and the server uses it to validate characters and return derived stats.

## Getting started

Requires Node 20+ and Postgres 14+.

```bash
npm install

# 1. Database
createdb rollbound
cp server/.env.example server/.env    # then edit DATABASE_URL if needed
npm run db:setup                      # creates tables, seeds a level 1 fighter (safe to re-run)

# 2. Run the API (port 3001) and the client (port 5173)
npm run dev:server
npm run dev:client                    # in a second terminal
```

Open http://localhost:5173 to reach the sign-in page. Create an account, or choose **Try the demo** to skip sign-in and play as the bundled sample character. Demo mode works even when the API isn't running.

`createdb` is a Postgres command-line tool, so run it in your terminal. If your OS user has no Postgres role, run `sudo -u postgres createdb rollbound` instead.

## Rules data

The builder reads the rules data in `packages/rules/data/`, generated from the open data in the [Foundry VTT pf2e system](https://github.com/foundryvtt/pf2e). It's one file per book and type (such as `player-core/feats.json`), plus `index.json`, which lists them and holds the data version. In code, load it with `loadRulesData()` from `@rollbound/rules/load` (Node) or `loadRules()` in `client/src/state/rulesData.js` (browser). Books Foundry doesn't have yet (currently *Impossible Magic* and *Dark Archive (Remastered)*) come from the Archives of Nethys as hand-made books in `packages/rules/books/`; see the README there. The files are committed, so you only need to regenerate them to pick up upstream fixes or new books:

```bash
npm run data:import    # set GITHUB_TOKEN to avoid API rate limits
```

The importer keeps content from the books listed in `BOOKS` in `packages/rules/scripts/import-pf2e.js` (currently Player Core and Player Core 2) and records the upstream commit it used.

A few rules live only in the rulebook text, not in Foundry's data, such as a Warpriest's armor training or each class's starting spells. Those are filled in from one corrections file per book in `packages/rules/corrections/`, so the rules engine has no book-specific code. After each import, the importer prints a report of anything that looks like it needs a correction. See [packages/rules/corrections/README.md](packages/rules/corrections/README.md).

Every rules item keeps Foundry's stable ID, and characters save their choices by ID, so renames and new books can't scramble them. Characters saved by older versions store names instead. The builder converts drafts automatically, and `npm run db:setup` converts saved characters (or run `npm run db:migrate-builds --workspace @rollbound/server`). It keeps level 1 feats, cantrips and 1st-rank spells, gear of level 1 or lower, and any feat something else grants. Deities come from Foundry's `core-gods` folder, which is Player Core's deity list (Foundry files it under *Lost Omens Divine Mysteries*).

## Character sheet PDF

The sheet screen can download the character as Paizo's official fillable Remaster character sheet, filled in. The template isn't in the repo; see [docs/character-sheet-pdf.md](docs/character-sheet-pdf.md) to install it.

## Builder art

The ancestry and class steps show portrait art and tile icons, found by file name in `client/src/assets/art/`. To add more, run `npm run art:import -- <folder>`; see [docs/adding-art.md](docs/adding-art.md).

## Image uploads

Campaign covers, account profile images, and character portraits use presigned uploads: `POST /api/uploads` (with `kind` = `cover`, `avatar`, or `portrait`) returns a short-lived signed URL, the browser `PUT`s the file straight to it, and the record stores only the object key. Replaced or removed images are deleted.

`STORAGE_DRIVER` in `server/.env` picks where files go:

- `local` (default): saved under `server/uploads/` (ignored by git), with signed URLs the API checks itself. Set `UPLOAD_SECRET` so links survive restarts.
- `s3`: uploaded straight to an AWS S3 bucket and served through CloudFront. Follow [docs/aws-s3-setup.md](docs/aws-s3-setup.md). The bucket, CORS, lifecycle, and IAM configs are in `infra/aws/`.

Both drivers live in `server/src/storage/`. The client and database are the same either way.

## Tests

```bash
npm test
```

Runs the rules engine tests with Node's built-in test runner: proficiency, AC with Dex caps, saves, strikes and MAP, degrees of success, condition stacking, encounter budgets, and DCs by level.

## API

| Method | Path | |
| --- | --- | --- |
| POST | `/api/auth/register` | Create an account and sign in (`displayName`, `email`, `password`) |
| POST | `/api/auth/login` | Sign in; sets an HTTP-only session cookie |
| POST | `/api/auth/logout` | End the session |
| GET | `/api/auth/me` | The signed-in user, or 401 |
| GET | `/api/characters` | Your characters (with campaign name and derived max HP and AC) |
| GET | `/api/characters/:id` | One character |
| POST | `/api/characters` | Create (validated) |
| PUT | `/api/characters/:id` | Update (validated) |
| DELETE | `/api/characters/:id` | Delete |
| GET | `/api/campaigns` | `{ running, playing }`: campaigns you GM and campaigns your characters are in |
| POST | `/api/campaigns` | Create (`name`, `backstory`, `partyLevel`, optional `coverKey`); returns the invite code |
| GET | `/api/campaigns/:id` | One campaign with its party (GM or members only; only the GM sees the code) |
| PATCH | `/api/campaigns/:id` | GM: edit `name`, `backstory`, `partyLevel`; `coverKey` replaces the cover, `null` removes it, omitted keeps it |
| POST | `/api/campaigns/:id/invite-code` | GM: replace the invite code (the old one stops working) |
| GET | `/api/campaigns/invites/:code` | Preview a campaign from its invite code |
| POST | `/api/campaigns/join` | Bring one of your characters in (`code`, `characterId`) |
| POST | `/api/campaigns/:id/leave` | Take your character out (`characterId`) |
| POST | `/api/uploads` | Get a signed upload URL (`kind`: `cover`, `avatar`, or `portrait`; `contentType`; `size`) |
| PATCH | `/api/auth/me` | Update your `displayName` and/or `avatarKey` (`null` removes it) |
| PUT | `/api/characters/:id/portrait` | Set (`portraitKey`) or remove (`null`) a character's portrait |

Character and campaign routes require a signed-in session and only touch the signed-in user's own rows.

## Licensing

Game mechanics come from the Pathfinder Second Edition Remaster rules, which Paizo publishes under the [ORC License](https://paizo.com/community/blog/v5748dyo6sico). RollBound reimplements mechanics only. The rules text in the builder comes from Player Core and Player Core 2, which Paizo publishes under the ORC License. The class art is Paizo's iconic character art from the Community Use Package, used under Paizo's [Community Use Policy](https://paizo.com/licenses/communityuse). See [docs/adding-art.md](docs/adding-art.md).

This is an unofficial fan project. *Pathfinder* is a trademark of Paizo Inc.; see Paizo's [Community Use Policy](https://paizo.com/community/communityuse).
