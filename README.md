# RollBound

A Pathfinder 2e (Remaster) table companion that **teaches the rules while you play**. Every number on the sheet shows its math, the turn helper tracks your three actions and the multiple attack penalty, and every roll explains its degree of success.

Built with the PERN stack: **Postgres, Express, React, Node**.

## Screens

| Screen | What it teaches |
| --- | --- |
| **Sheet** | Tap AC, a save, or Perception to see the breakdown: ability, proficiency rank + level, item bonus, armor's Dex cap, and condition penalties. |
| **Turn** | The 3-action economy. Strikes show the multiple attack penalty as it grows; conditions like Frightened apply to the numbers and tick down when you end your turn. |
| **Roll** | Rolls a Strike against the GM's target AC and shows where it landed on the four degrees of success, including natural 20/1 shifts and crit damage. |
| **GM** | Encounter XP budget for your party size and level, initiative order, and the DC for a level-appropriate challenge. |

## Project layout

```
packages/rules   Pure-function rules engine (no dependencies) + tests
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
npm run db:setup                      # creates tables, seeds a level 1 fighter

# 2. Run the API (port 3001) and the client (port 5173)
npm run dev:server
npm run dev:client                    # in a second terminal
```

Open http://localhost:5173. If the API isn't running, the client falls back to the bundled sample character so you can still try every screen.

## Tests

```bash
npm test
```

Runs the rules engine tests with Node's built-in test runner: proficiency, AC with Dex caps, saves, strikes and MAP, degrees of success, condition stacking, encounter budgets, and DCs by level.

## API

| Method | Path | |
| --- | --- | --- |
| GET | `/api/characters` | List characters (with derived max HP and AC) |
| GET | `/api/characters/:id` | One character |
| POST | `/api/characters` | Create (validated) |
| PUT | `/api/characters/:id` | Update (validated) |
| DELETE | `/api/characters/:id` | Delete |

## Licensing

Game mechanics come from the Pathfinder Second Edition Remaster rules, which Paizo publishes under the [ORC License](https://paizo.com/community/blog/v5748dyo6sico). RollBound reimplements mechanics only. It doesn't include Paizo's art, logos, or setting material.

This is an unofficial fan project. *Pathfinder* is a trademark of Paizo Inc.; see Paizo's [Community Use Policy](https://paizo.com/community/communityuse).
