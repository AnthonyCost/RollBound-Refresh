# RollBound

A Pathfinder 2e (Remaster) table companion that **teaches the rules while you play**. Every number on the sheet shows its math, the turn helper tracks your three actions and the multiple attack penalty, and every roll explains its degree of success.

Built with the PERN stack: **Postgres, Express, React, Node**.

## Screens

| Screen | What it teaches |
| --- | --- |
| **Hub** | Home after sign-in: your characters (with HP and AC at a glance) and the campaigns you run as GM. |
| **Builder** | Step-by-step level 1 character creation from Player Core and Player Core 2: ancestry, heritage, background, class and subclass, deity, attribute boosts, skills, languages, feats (with prerequisite checks and bonus feats), spells, and 15 gp of gear. Each step explains the rule it applies. Demo users can build and play a character for the rest of their session. |
| **Sheet** | Tap AC, a save, or Perception to see the breakdown: ability, proficiency rank + level, item bonus, armor's Dex cap, and condition penalties. |
| **Turn** | The 3-action economy. Strikes show the multiple attack penalty as it grows; conditions like Frightened apply to the numbers and tick down when you end your turn. |
| **Roll** | Rolls a Strike against the GM's target AC and shows where it landed on the four degrees of success, including natural 20/1 shifts and crit damage. |
| **GM** | Encounter XP budget for your party size and level, initiative order, and the DC for a level-appropriate challenge. |

## Project layout

```
packages/rules   Pure-function rules engine (no dependencies) + tests
                 data/pf2e-level1.json: imported character-creation data
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

The builder reads `packages/rules/data/pf2e-level1.json`, generated from the open data in the [Foundry VTT pf2e system](https://github.com/foundryvtt/pf2e). The file is committed, so you only need to regenerate it to pick up upstream fixes or new books:

```bash
npm run data:import    # set GITHUB_TOKEN to avoid API rate limits
```

The importer keeps content from the books listed in `BOOKS` in `packages/rules/scripts/import-pf2e.js` (currently Player Core and Player Core 2) and records the upstream commit it used. It keeps level 1 feats, cantrips and 1st-rank spells, gear of level 1 or lower, and any feat something else grants. Deities come from Foundry's `core-gods` folder, which is Player Core's deity list (Foundry files it under *Lost Omens Divine Mysteries*).

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
| GET | `/api/campaigns` | Campaigns you run as GM (with character count) |

Character and campaign routes require a signed-in session and only touch the signed-in user's own rows.

## Licensing

Game mechanics come from the Pathfinder Second Edition Remaster rules, which Paizo publishes under the [ORC License](https://paizo.com/community/blog/v5748dyo6sico). RollBound reimplements mechanics only. The rules text in the builder comes from Player Core and Player Core 2, which Paizo publishes under the ORC License. It doesn't include Paizo's art, logos, or setting material.

This is an unofficial fan project. *Pathfinder* is a trademark of Paizo Inc.; see Paizo's [Community Use Policy](https://paizo.com/community/communityuse).
