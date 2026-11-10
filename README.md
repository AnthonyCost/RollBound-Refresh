# RollBound

A Pathfinder Second Edition (Remaster) companion for your table, which **teaches the rules while you play**. Every number on a character sheet shows its math, every roll explains its degree of success, and every step of the character builder explains the rule it applies.

Built with **Postgres, Express, React and Node**. How it all fits together, and why, is in **[docs/how-rollbound-works.md](docs/how-rollbound-works.md)**.

## What's in it

**For players**

- **Character builder:** ancestry, heritage, background, class and its options (deity, doctrine, bloodline, school…), attribute boosts, skills, languages, feats, spells or runes, gear from the whole armory, and leveling up to 20. Or start from one of 24 of Paizo's iconic heroes. Drafts save as you go, and saved characters can be reopened and edited.
- **Character sheet:** tap any number to see how it's worked out and the rule behind it. It includes HP and shield tracking, conditions, a share link anyone can open read-only, and an export to Paizo's fillable PDF sheet.
- **Tabs for each character:** Feats, Spells (with daily preparation), Inventory (equipped slots, the pack, coins and Bulk, and a merchant selling every item in the game), Lore (backstory), and **Combat**: the three-action turn, Strikes with the multiple attack penalty, spells and potions, all rolled in a 3D dice drawer.
- **Campaigns:** join with a GM's invite code (the GM approves each request), see the party and the session logs, and follow a running fight from the Combat tab.

**For game masters**

- **Campaigns** from any of Paizo's 26 Adventure Paths, or homebrew, with a cover, backstory, party level and the books players may build from.
- **Session logs** the party can read.
- **Encounters:** build them from the bestiary, rated live against the party's XP budget, then **run** them in an initiative tracker. The tracker handles turns and rounds, HP and conditions, creature attacks against a target, and actions and reactions that the players see too.

**For everyone** (no account needed for the last three)

- **Bestiary** (Monster Core 1 and 2), **Spell Book** (every spell) and **Armory** (every item), each laid out as an open book with search and filters.
- **Rules Glossary:** 2,700+ rules, conditions, traits and actions, searchable by their pre-Remaster names too.
- **Learning the Game** lessons and a **Resources** page.
- **A demo:** "Try the demo" gives a temporary account with a character of every class and a table of pretend players to play with.
- **Accounts:** profile picture, password reset by email, and 18 color themes.

## Project layout

```
packages/rules   The rules engine (pure functions, shared by client and server) and all game data
client           The React app (Vite)
server           The Express API, the Postgres schema, and image and email services
infra/aws        S3 configuration files
docs             Guides, including how-rollbound-works.md
```

## Running it locally

You need **Node 24** and **Postgres 12 or newer**.

```bash
npm install

# 1. The database
sudo service postgresql start         # if Postgres isn't running (common after a restart)
createdb rollbound                    # or: sudo -u postgres createdb rollbound
cp server/.env.example server/.env    # then edit DATABASE_URL if needed
npm run db:setup                      # creates the tables (safe to re-run)

# 2. The API (port 3001) and the app (port 5173) together
npm run dev
```

Open http://localhost:5173. Create an account, or choose **Try the demo**.

Out of the box, uploaded images are saved on disk (`server/uploads/`) and emails are printed in the server's terminal, so nothing else needs setting up. The settings for S3 and Resend are in `server/.env.example`.

`npm run dev:server` and `npm run dev:client` run either half alone. `npm run dev:client -- --host` opens the app to a phone on the same Wi-Fi.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the API and the app |
| `npm test` | Runs the rules tests, including the build sweep |
| `npm run build` | Builds the app into `client/dist` (which the server serves in production) |
| `npm run db:setup` | Creates or updates the database tables (safe to re-run) |
| `npm run data:import` | Re-imports character-creation data from Foundry VTT, then runs the tests |
| `npm run data:bestiary -w @rollbound/rules` | Rebuilds the bestiary from the Archives of Nethys |
| `npm run data:armory -w @rollbound/rules` | Rebuilds the armory from the Archives of Nethys |
| `npm run data:glossary -w @rollbound/rules` | Rebuilds the rules glossary from the Archives of Nethys |
| `npm run pregens -w packages/rules` | Rebuilds the iconic heroes from `packages/rules/pregens/specs.js` |
| `npm run art:import -- <folder>` | Adds class, ancestry and Adventure Path art ([docs/adding-art.md](docs/adding-art.md)) |
| `npm run art:creatures -- <folder>` | Adds bestiary art |
| `npm run icons -w client` | Rebuilds the icon set after editing `client/scripts/build-icons.js` |
| `npm run inbox:post -- --title "…" --body "…"` | Posts an announcement to everyone's inbox |

## Tests

```bash
npm test
```

The rules tests (300+) cover the engine, the builder, leveling, combat, conditions, encounters, inventory and every data file. The **build sweep** builds a character for every combination of class, ancestry, heritage, background, subclass option and deity, so a data import can't quietly break one.

```bash
TEST_DATABASE_URL=postgres://localhost:5432/rollbound_test npm test -w server
```

The API access tests run against a throwaway database (they skip without one). They check that nobody can reach another person's characters or campaigns.

GitHub Actions runs the tests and a build on every push.

## Deploying

RollBound runs on [Render](https://render.com) as one web service (the API and the built app) plus a Postgres database, with images on AWS S3 and email through Resend. Pushing to `main` deploys.

- [docs/launch-prep.md](docs/launch-prep.md): the launch checklist, in order
- [docs/render-deployment.md](docs/render-deployment.md): first-time setup, and archiving an old project
- [docs/render-upkeep.md](docs/render-upkeep.md): updates, backups, resetting the database, a monthly checklist
- [docs/aws-s3-setup.md](docs/aws-s3-setup.md): image storage
- [docs/password-reset-email-setup.md](docs/password-reset-email-setup.md): email, and using Resend templates

## Guides

| Guide | About |
| --- | --- |
| [how-rollbound-works.md](docs/how-rollbound-works.md) | The whole system: how each part works and why |
| [database-schema.md](docs/database-schema.md) | The tables and how they connect |
| [HANDOFF.md](docs/HANDOFF.md) | The history of each feature, decisions made along the way, open items |
| [adding-art.md](docs/adding-art.md) | Adding class, ancestry and creature art |
| [character-sheet-pdf.md](docs/character-sheet-pdf.md) | Installing the PDF sheet template |
| [leveling-report.md](docs/leveling-report.md) | How leveling was checked against the rules |
| [shield-hit-points.md](docs/shield-hit-points.md) | How shield damage works, and what's left |

## Licensing

- **Game rules and rules text** come from Paizo's Pathfinder Second Edition Remaster books, published under the [ORC License](https://paizo.com/orclicense), by way of the [Foundry VTT pf2e system](https://github.com/foundryvtt/pf2e) and the [Archives of Nethys](https://2e.aonprd.com).
- **Class and iconic art** is from Paizo's Community Use Package, used under Paizo's [Community Use Policy](https://paizo.com/licenses/communityuse). That requires RollBound to stay free and non-commercial while it uses the art.
- **Icons** are from [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
- **Not in this repository:** Paizo's fillable character sheet PDF and Adventure Path covers, which aren't licensed for redistribution. Each is installed locally (see the guides above).

This is an unofficial fan project. *Pathfinder* is a trademark of Paizo Inc.
