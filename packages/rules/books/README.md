# Hand-made books

Books that Foundry's pf2e data doesn't have yet, or has only in an older edition (Dark Archive). Prefer Foundry whenever it has the right edition: check `system.publication.remaster` on its items. Each file is one book's level 1 content (classes, feats, spells, runes, and extra subclass options for existing classes), converted from the [Archives of Nethys](https://2e.aonprd.com), Paizo's official online rules reference.

`npm run data:import` merges these files with Foundry's data, so they go through the same corrections (`corrections/<book>.json`), import report, tests and split files.

## Adding a book

1. Run `npm run data:aon --workspace @rollbound/rules -- "<Book Title>"`, using the title exactly as AoN's Sources page shows it. This makes **one** request to AoN's search index and caches the result, so later runs don't touch AoN. Add `--refresh` to download it again, for example after errata.
2. Check the new file against the book itself. AoN occasionally leaves a field blank; the Dragon eidolon's skills were one example.
3. Put anything the converted data doesn't capture in `corrections/<book>.json`, such as spellcasting numbers, then run `npm run data:import` until the report is empty and the tests pass.

Don't edit these files by hand. Fixes go in corrections, so a re-run keeps them.

## When Foundry catches up

Add the book's title to `BOOKS` in `scripts/import-pf2e.js` and delete its file here; the importer stops with an error if both exist. Saved characters refer to the hand-made IDs (`aon-…`), so after switching, rules-data updates (roadmap step 3) will ask players to re-pick those choices. A small mapping from AoN IDs to Foundry IDs in `migrateBuild()` would avoid that.

## Licensing

Game mechanics are Paizo's, used under the ORC License. The descriptive text comes from Paizo's books by way of AoN. That's fine for personal use; check each book's ORC notice before a public launch.
