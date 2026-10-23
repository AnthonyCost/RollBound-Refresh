# Exporting the Pathfinder character sheet

The character sheet screen has an **Open character sheet (PDF)** button. It fills in Paizo's official form-fillable Remaster Player Core character sheet with the character's details and opens it in a new browser tab, where the browser's PDF viewer can print or save it. A **Download instead** link saves it directly. If the browser blocks the new tab, the sheet downloads instead.

The PDF stays fillable, so players can keep editing it in any PDF reader.

Everything happens in the browser, demo mode included, and the server isn't involved. The PDF code (`pdf-lib`) loads only when someone exports.

## Installing the template

The blank sheet isn't in the repo (see [Licensing](#licensing)). Each environment needs a copy:

1. Download the form-fillable **Pathfinder Player Core character sheet** from Paizo.
2. Save it as `client/public/sheets/pf2e-remaster-character-sheet.pdf`.

If the file is missing, the export button says so instead of failing.

## What gets filled in

| Page | Filled |
| --- | --- |
| 1 · Statistics | Name, player, level, hero points, ancestry, heritage, size, background, class (with key attribute and subclass), attributes, AC with its breakdown, shield, armor and weapon proficiency ranks, saves, max and current HP, Perception, senses, speed, languages, every skill with its breakdown, armor check penalty and rank, two Lore skills, up to 3 melee and 2 ranged Strikes (attack, breakdown, damage and type, traits), the cleric's favored weapon, and Class DC |
| 2 · Abilities and inventory | Ancestry and heritage abilities, ancestry feat, background skill feat, class features and feats, held items, worn armor |
| 3 · Notes | The character's portrait in the Character Sketch box, deity, campaign |
| 4 · Spells | Tradition, prepared or spontaneous, spell attack and spell DC with ranks, cantrips per day and cantrip rank, spell slots, cantrips (with actions), and spells (with action cost and rank) |

Some one-line boxes in Paizo's PDF (name, ancestry, level, and similar) are marked multi-line. Viewers like Edge and Acrobat then decide the text doesn't fit and hide it behind a "+" marker, so the export makes boxes too short for two lines single-line before filling them.

Every number comes from the same rules engine as the in-app sheet, so the PDF and the app always agree. Proficiency ranks are marked cumulatively, so expert ticks T and E. Temporary effects like conditions aren't included.

Left blank for players: XP, partial boosts, the Actions and Reactions blocks, focus spells, wealth and Bulk, and personality fields.

## How it works

Paizo's sheet has 517 form fields with random names (such as `textarea_1mgbu`).

- **Field map:** `client/scripts/map-sheet-fields.mjs` works out what each field is from its position on the page and writes `client/src/sheet/sheetFields.json`, which gives each one a readable key like `skill.arcana.total`.
- **Filling:** `client/src/sheet/characterSheetPdf.js` fills the form by those keys.
- **Download:** `client/src/sheet/exportSheet.js` loads the template, adds the portrait and downloads the result.

If Paizo publishes an updated sheet, replace the template and re-run the mapper:

```bash
node client/scripts/map-sheet-fields.mjs
```

It stops with a clear error if any field moved, so nothing gets silently filled into the wrong box.

## Licensing

The sheet is © Paizo Inc. and marked *"Permission granted to photocopy for personal use only."* That's why the template is listed in `.gitignore` and isn't committed.

Running the app for yourself and your group is in the spirit of that permission. Hosting the PDF on a public site redistributes it, though, so before deploying RollBound publicly, check Paizo's [Community Use Policy](https://paizo.com/community/communityuse) or ask Paizo for permission. Without that, the alternative is a RollBound-designed sheet, which `fillCharacterSheet` could target with its own field map.
