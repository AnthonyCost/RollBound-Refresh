# Adding ancestry and class art

The character builder's **Ancestry** and **Class** steps use two images per option:

- **Portrait**: full-length art shown in the large panel when the option is selected.
- **Icon**: a round emblem shown on the option's selection tile.

Art is found by file name, so adding it needs no code changes:

1. Name each image after what it's for, for example `class-wizard.png` or `ancestry-elf-icon.png`.
2. Put the images in a folder and run:

   ```bash
   npm run art:import -- path/to/folder
   ```

3. Restart `npm run dev:client` if it's running. The new art shows up on its own.

You can add art one image at a time. Anything without its own art falls back as described in [Fallbacks](#fallbacks).

## File names

| File | Used for |
| --- | --- |
| `<kind>-<slug>.png` | Portrait (`kind` is `ancestry` or `class`) |
| `<kind>-<slug>-icon.png` | Tile icon |
| `class-<slug>-banner.png` | Background of that class's character cards (Home and Characters) and of the Sheet tab |

**Class icons** are finished round emblems with their own ring, so send them with transparent corners. **Ancestry icons** can be any picture, square or not: the app clips them to a circle and draws the ring, so every ancestry tile looks the same. Keep the face near the middle.

**Class banners** are **1920 × 1080** (16:9) backgrounds, made dark and muted so text reads on top of them. Two places use them:

- **The Sheet tab:** the banner fills the page under the tabs at full width and its own shape, at 25% opacity over the page's dark red to black gradient, then fades out, so long sheets end on the page's usual background.
- **Character cards:** a closer 2.7:1 strip (`class-<slug>-card.webp`, about 1.3× zoom) sits behind the portrait, name and campaign. The import picks the strip with the most detail, so it lands on figures and effects rather than empty sky or the faded bottom. The left side is under a dark fade.

Dropped a banner straight into `client/src/assets/art/`? Run `npm run art:import -w client` with no folder to make its card strip. Strips are remade whenever their banner changes.

A class without a banner shows its portrait, faded, on cards and nothing behind the sheet.

Slugs are listed [below](#slugs). PNG, JPG and WebP all work as input.

`art:import` saves web-ready WebP files in `client/src/assets/art/` with the same names:

- **Portraits** are trimmed to the figure and capped at 1200px tall.
- **Class icons** are trimmed and fitted into 192 × 192, keeping their transparency.
- **Ancestry icons** are cropped to fill a 192 × 192 square, centered on the most detailed area (usually the face).
- **Class banners** are cropped to fill 1920 × 1080, centered on the most detailed area.

It warns you about:
- files named in a way it doesn't recognize (those are skipped),
- slugs that aren't in the imported books yet (those are kept for later),
- class icons whose area outside the circle isn't transparent, which would show as a box behind them.

You can also save finished WebP files straight into `client/src/assets/art/` yourself. The script is only a convenience.

## Preparing images

| | Portrait | Icon |
| --- | --- | --- |
| **Background** | Transparent | Class: transparent outside the circle. Ancestry: anything |
| **Shape** | Portrait, roughly 2:3 | Square, about 512 × 512 or larger |
| **Framing** | Full body, head near the top | Class: the emblem filling the square. Ancestry: the face near the middle, no ring |

Portraits are anchored to the top of a 2:3 panel with an even margin, so heads line up across options.

To remove a background, use your editor's "remove background" tool (Photoshop, Affinity, GIMP) or a service like remove.bg. Check the gaps between the arms and the body, since background color often survives there.

## What's in place

- **Classes:** all 16 have a portrait (Paizo's Remaster iconics) and an icon (Adventure Card Game emblems).
- **Saved for later:** portraits for animist, commander, exemplar, guardian, gunslinger, inventor and kineticist, and icons for gunslinger, magus and summoner. They appear automatically once those classes are imported.
- **Ancestries:** none have their own art yet. Eight borrow a class iconic's portrait for now (see below), and the rest use the fallbacks.

## Fallbacks

When an option has no art of its own:

1. **Borrowed portrait:** `BORROWED` in `client/src/builder/art.js` can point an option at another image, such as Human at `class-fighter` (Valeros). Once the option gets its own file, that file wins and the entry is ignored, so delete it then.
2. **Placeholder:** `placeholder-hero.png` in `client/src/assets/art/`, if present.
3. **Letter:** if there's no placeholder either, the panel and tile show the option's first letter.

A tile without an icon shows a round crop from the top of the portrait. If that crop misses the face, `TILE_FOCUS` in `art.js` can recenter it, for example `human: { x: 45, y: 10, zoom: 2.6 }`:
- `x` and `y` are the point to center on, as a percentage across and down the image,
- `zoom` is how many tiles wide the image is drawn.

An icon file makes this unnecessary.

## Slugs

**Ancestries:**

| Slug | Ancestry | Slug | Ancestry |
| --- | --- | --- | --- |
| `catfolk` | Catfolk | `human` | Human |
| `dwarf` | Dwarf | `kholo` | Kholo |
| `elf` | Elf | `kobold` | Kobold |
| `gnome` | Gnome | `leshy` | Leshy |
| `goblin` | Goblin | `lizardfolk` | Lizardfolk |
| `halfling` | Halfling | `orc` | Orc |
| `hobgoblin` | Hobgoblin | `ratfolk` | Ratfolk |
| `tengu` | Tengu | `tripkee` | Tripkee |

**Classes:**

| Slug | Class | Slug | Class |
| --- | --- | --- | --- |
| `alchemist` | Alchemist | `investigator` | Investigator |
| `barbarian` | Barbarian | `monk` | Monk |
| `bard` | Bard | `oracle` | Oracle |
| `champion` | Champion | `ranger` | Ranger |
| `cleric` | Cleric | `rogue` | Rogue |
| `druid` | Druid | `sorcerer` | Sorcerer |
| `fighter` | Fighter | `swashbuckler` | Swashbuckler |
| `witch` | Witch | `wizard` | Wizard |

If new books are imported later, their slugs are the `slug` fields in the `ancestries.json` and `classes.json` files under `packages/rules/data/`. You can also list them with:

```bash
node --input-type=module -e 'import { loadRulesData } from "@rollbound/rules/load"; const d = loadRulesData({ types: ["ancestries", "classes"] }); console.log(d.ancestries.map((a) => a.slug).join(" ")); console.log(d.classes.map((c) => c.slug).join(" "))'
```

## Licensing

The class art is Paizo's iconic character art, and the icons are Adventure Card Game emblems. If they came from Paizo's Community Use Package, the [Community Use Policy](https://paizo.com/licenses/communityuse) allows them in free, non-commercial fan projects, as long as the site shows Paizo's required notice. The notice says the site uses Paizo's trademarks and copyrights under that policy, isn't published or endorsed by Paizo, and doesn't charge for access. Check the policy page for the exact wording before publishing, and keep RollBound free while it uses this art.

Only add art you have the right to publish, such as art you made, commissioned, or licensed. Other Paizo art, such as illustrations from the rulebooks, isn't covered by the policy, so stick to the Community Use Package.

The placeholder is Monster Hunter art owned by Capcom, so `client/src/assets/art/placeholder-hero.png` is listed in `.gitignore` and never committed. Don't publish the site with it. Art you own can be committed normally.
