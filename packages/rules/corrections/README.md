# Corrections

Foundry's data covers most rules, but a few live only in the rulebook text (Foundry's app handles them in its own code). Each file here fills those gaps for one book. `npm run data:import` merges them into the data, so the rules engine has no book-specific code.

## Files

One file per book, named after the book's title without "Pathfinder": `player-core.json`, `player-core-2.json`, and later `impossible-magic.json`, and so on. A book with nothing to correct needs no file.

Entries are keyed by the item's **slug** within that book. The importer fails if a slug doesn't exist, so a typo can't slip through.

## What you can correct

| Section | Field | Meaning |
| --- | --- | --- |
| `classes` | `casting` | 1st-level spellcasting: `kind` (`repertoire`, `prepared`, `spellbook`, `familiar`, or `focus`), `tradition` (`null` if a subclass sets it), how many `cantrips` and `spells` you choose, `slots` per day, and optional `prepares` for casters who prepare from a larger collection |
| `classes` | `divineFont` | `true` if the class chooses a heal/harm font from its deity |
| `classes` | `deityFavoredWeapon` | Proficiency rank with the deity's favored weapon, e.g. `"trained"` |
| `subclassOptions` | `proficiencies` | Ranks granted at 1st level, e.g. `{ "defenses.medium": "trained", "saves.fortitude": "expert" }`. Paths: `defenses.<category>`, `attacks.<category>`, `saves.<save>`, `perception` |
| `subclassOptions` | `keyAbility` | An extra key attribute this option allows, e.g. `"str"` |
| `heritages` | `featAncestries` | Other ancestries whose feats this heritage can take, e.g. `["elf"]` |
| `feats` | `grantedOnlyIf` | When something grants this feat automatically, only grant it if this condition holds. Known conditions: `deity-favored-weapon-simple` |

New kinds of correction need a small addition to the importer and engine. That happens once per kind of rule, not once per item.

## The import report

After importing, the importer lists anything that looks like it needs a correction, for example a spellcasting class with no `casting` entry, or a subclass whose text grants armor training that the data doesn't. Add corrections until the report is empty.
