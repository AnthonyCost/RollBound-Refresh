# Adventure Path covers

When a GM starts a campaign from an Adventure Path, its cover here is offered as
the campaign's cover image (they can keep it, replace it, or remove it).

- Add covers with `npm run art:import -- <folder>`, naming each file after the path's
  slug: `adventure-wardens-of-wildwood.jpg`. The slugs are in
  `packages/rules/src/adventurePaths.js`. The import turns each portrait book cover
  into a wide 1600×900 image (the cover over a blurred, darkened copy of itself), saved
  here as `<slug>.webp`.
- A path without a cover still works: the builder shows a title card and the campaign
  starts with no cover.
- **These files are git-ignored.** Adventure Path covers are Paizo's art and carry the
  Pathfinder logo, which the ORC license doesn't cover and Paizo's Community Use Policy
  doesn't allow. Keep them local until you have permission to publish them.
