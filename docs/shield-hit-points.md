# Shield Hit Points

A character with a shield equipped sees its Hit Points on the Sheet tab and can track damage to it: Shield Block an attack, repair it, and see when it breaks. This is a first version; [What's left](#whats-left) lists the gaps.

## The rules it follows

From Player Core:

- A shield has **Hit Points**, **Hardness** and a **Broken Threshold (BT)** of half its Hit Points, rounded down. A Steel Shield has 20 HP, Hardness 5 and BT 10.
- **Shield Block** (a reaction while the shield is raised): the shield's Hardness reduces the damage, and the shield and you each take whatever is left. An 8-damage hit on a Steel Shield: Hardness stops 5, and the shield and you each take 3.
- At or below its BT the shield is **broken**: it can't be raised or used to Shield Block until it's repaired. At 0 HP it's **destroyed** and can't be repaired.

## What players see

| Where | What |
| --- | --- |
| Sheet tab, defense band | A **Shield** box beside Hit Points: current / max HP, and "Hardness 5 · BT 10" beneath. It turns red and says **Broken** at or below the BT, and **Destroyed** at 0. Only shown with a shield equipped. Read-only views (shared and party sheets) show it too. |
| Sheet tab, under the HP tracker | The **shield tracker** (owner only). Enter an attack's damage and press **Shield Block**: the shield loses the damage minus its Hardness, and a line explains the result. **Repair** restores that many HP; **Repair fully** restores all of it. Warnings appear when it's broken or destroyed. |
| Inventory tab, Equipped | The shield's slot card adds its HP: "+2 AC raised · Hardness 5 · HP 14/20". |

Shield Block doesn't change the character's own HP. The result line says how much they take; they apply it with the HP tracker.

## How it's stored

Damage is saved on the shield's entry in the character's inventory (`characters.inventory`, a JSONB column), as an optional `damage` field: the Hit Points it has lost. No field means no damage.

```json
{ "key": "a1b2…", "kind": "shield", "id": "Yr9yCuJiAlFh3QEB", "name": "Steel Shield", "qty": 1, "bulk": 1, "price": 200, "note": "", "equipped": true, "damage": 6 }
```

- Storing damage rather than current HP means a shield's maximum can change with a rules update without leaving it over full.
- Damage belongs to that one shield. Buy a second shield and it starts undamaged; switch back and the first is as damaged as you left it.
- No database migration was needed.

## How it works

| Piece | File | What it does |
| --- | --- | --- |
| `shieldState(inv, data)` | `packages/rules/src/inventory.js` | The equipped shield's `{ key, name, hardness, max, current, brokenAt, broken, destroyed }`, or `null` without one. Current HP is max minus damage, never below 0. |
| `setItemDamage(inv, key, damage)` | same | Returns the inventory with that item's damage set (rounded, and kept from 0 to `LIMITS.damage`, 9,999). |
| `inventoryProblems` | same | Rejects `damage` that isn't a whole number from 0 to 9,999. |
| `PUT /characters/:id/inventory` | `server/src/routes/characters.js` | Keeps `damage` when it rebuilds each item from its known fields (it used to drop anything not on the list). Leaves it off when it's 0. |
| `shield`, `setShieldDamage` | `client/src/state/TableContext.jsx` | The shield's state for the open character, and a setter that saves through the existing inventory save. Before the inventory is first edited, it starts from the builder's gear (`startingInventory`), as the Inventory tab does. |
| `ShieldTracker` | `client/src/components/ShieldTracker.jsx` | The Shield Block and Repair panel. |
| Shield box | `client/src/pages/SheetPage.jsx` | The box in the defense band; `.sheet-def--shield` and `.sheet-def--broken` in `theme.css`. |

Tests: `packages/rules/test/inventory.test.js`, "shield damage" (full HP, breaking at the BT, destroyed at 0, saving and checking damage).

## What's left

- **Raising a shield ignores the shield.** `armorClass` adds a flat +2 when `shieldRaised` is set (`packages/rules/src/character.js`), so a Buckler gives +2 instead of +1, and a broken or destroyed shield can still be raised on the Turn screen. It should use `character.shield.acBonus` and refuse when the shield is broken.
- **Shield Block isn't tied to the raised shield or the reaction.** The tracker works any time. When the Turn screen tracks reactions, Shield Block should need a raised shield and use the reaction.
- **The character's own damage isn't applied.** Blocking could take the leftover damage off the character's HP in the same step (with an undo), instead of asking the player to enter it again.
- **The PDF export shows full HP.** `client/src/sheet/characterSheetPdf.js` fills the sheet's shield HP box with the maximum; it should use `shieldState`'s current HP.
- **Destroyed shields stay equipped.** A destroyed shield could be unequipped automatically, or flagged on the Inventory tab.
- **Repairs are free.** Repairing takes the Repair activity (a Crafting check, 10 minutes) in the rules; the tracker just adds HP. A note or a roll could come later.
- **Shield runes and special shields.** Reinforcing runes and shields with their own HP, Hardness or abilities (such as a tower shield's Take Cover) aren't modeled; `shieldState` reads only the shield's base numbers.
