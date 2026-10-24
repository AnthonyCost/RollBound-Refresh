# Corrections

Foundry's data covers most rules, but a few live only in the rulebook text (Foundry's app handles them in its own code). Each file here fills those gaps for one book. `npm run data:import` merges them into the data, so the rules engine has no book-specific code.

## Files

One file per book, named after the book's title without "Pathfinder": `player-core.json`, `player-core-2.json`, and later `impossible-magic.json`, and so on. A book with nothing to correct needs no file.

Entries are keyed by the item's **slug** within that book. The importer fails if a slug doesn't exist, so a typo can't slip through.

## What you can correct

| Section | Field | Meaning |
| --- | --- | --- |
| `classes` | `casting` | 1st-level spellcasting: `kind` (`repertoire`, `prepared`, `spellbook`, `familiar`, or `focus`), `tradition` (`null` if a subclass sets it), how many `cantrips` and `spells` you choose, `slots` per day, and optional `prepares` for casters who prepare from a larger collection. Optional: `ability` when spells use a different attribute than the key attribute (magus: `"int"`), `grantedSpells` the class always knows (necromancer: `["harm"]`), and `listName` for the spell collection (`"dirge"`) |
| `classes` | `divineFont` | `true` if the class chooses a heal/harm font from its deity |
| `classes` | `deityFavoredWeapon` | Proficiency rank with the deity's favored weapon, e.g. `"trained"` |
| `classes` | `lores` | Lore skills the class trains, e.g. `["Undead Lore"]` |
| `classes` | `classFeatTraits` | Traits the 1st-level class feat must have, e.g. `["evolution"]` for the summoner |
| `classes` | `runes` | A runic repertoire instead of spells: `{ "known": 4 }` |
| `classes` | `loreAbilities` | Lores rolled with another attribute than Int, e.g. `{ "Esoteric Lore": "cha" }` |
| `classes` | `weaponGroups` | Ranks for weapon groups within categories, e.g. a gunslinger's `[{ "groups": ["firearm", "crossbow"], "categories": ["simple", "martial"], "rank": "expert" }]` |
| `subclassOptions` | `proficiencies` | Ranks granted at 1st level, e.g. `{ "defenses.medium": "trained", "saves.fortitude": "expert" }`. Paths: `defenses.<category>`, `attacks.<category>`, `saves.<save>`, `perception` |
| `subclassOptions` | `keyAbility` | An extra key attribute this option allows, e.g. `"str"` |
| `subclassOptions` | `skills` | Skills the option trains, when the data has none |
| `subclassOptions` | `keyAbilityOnly` | The option sets the key attribute outright (a psychic's subconscious mind) |
| `subclassOptions` | `traditionSkills` | A skill that depends on the chosen tradition, e.g. a dragon eidolon's `{ "arcane": "arcana", "occult": "occultism", ... }` |
| `heritages` | `featAncestries` | Other ancestries whose feats this heritage can take, e.g. `["elf"]` |
| `heritages` | `ancestryHp` | Ancestry Hit Points this heritage uses instead, e.g. `10` for Defensive Automaton |
| `backgrounds` | `lore` | The background's Lore, e.g. `["<Past life> Lore"]` for a Lore the player names |
| `feats` | `grantedOnlyIf` | When something grants this feat automatically, only grant it if this condition holds. Known conditions: `deity-favored-weapon-simple` |

New kinds of correction need a small addition to the importer and engine. That happens once per kind of rule, not once per item.

## The import report

After importing, the importer lists anything that looks like it needs a correction, for example a spellcasting class with no `casting` entry, or a subclass whose text grants armor training that the data doesn't. Add corrections until the report is empty.
