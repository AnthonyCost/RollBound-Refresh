# Adding ancestry and class art

The character builder's **Ancestry** and **Class** steps show a large portrait of whatever is selected. Anything without its own art falls back to the placeholder. If the placeholder file is also missing, the builder shows a large letter instead.

Adding art for one ancestry or class takes two steps:

1. Put the image file in `client/public/art/`.
2. Add one line for it to `client/src/builder/art.js`.

You can add art one image at a time. Every ancestry and class you haven't covered keeps using the placeholder.

## What's in place

Every class has art: Paizo's Remaster iconics, saved as `client/public/art/class-<slug>.webp`. Seven more images are ready for classes RollBound doesn't offer yet: animist, commander, exemplar, guardian, gunslinger, inventor and kineticist. Those are registered in `art.js` under the class names Foundry uses, so they show up automatically once those classes are imported.

Class tiles show round emblem icons from the Adventure Card Game, saved as `class-<slug>-icon.webp` and registered in `ICONS` in `art.js`. All 16 classes have icons. Gunslinger, magus and summoner icons are saved for later.

Ancestries don't have art yet and still use the placeholder. Ancestry icons will follow the same `ancestry-<slug>-icon.webp` pattern.

## 1. Prepare the image

| | Recommendation | Why |
| --- | --- | --- |
| **Background** | Transparent | The figure sits on the builder's dark ember glow. A white or colored background shows up as a box. |
| **Format** | PNG, or WebP to keep the file small | These formats support transparency. JPEG doesn't. |
| **Shape** | Portrait, roughly 2:3 (for example 750 × 1180 px) | The art panel is tall. Wide images get shrunk to fit. |
| **Framing** | Full body, feet near the bottom edge, a little space above the head | The art is anchored to the bottom of the panel, over the glow. |
| **File size** | Aim for under 500 KB | Every visitor downloads it. Use a compressor such as [Squoosh](https://squoosh.app) if needed. |

To remove a background, use your editor's "remove background" tool (Photoshop, Affinity, GIMP) or a service like remove.bg. Check the gaps between the arms and the body, since background color often survives there.

## 2. Name the file and put it in place

Save it in `client/public/art/` and name it `<kind>-<slug>.<ext>`, for example:

```
client/public/art/class-wizard.png
client/public/art/ancestry-elf.webp
```

The name doesn't have to follow this pattern, but it keeps the folder tidy.

## 3. Register it in `art.js`

Open `client/src/builder/art.js` and add an entry under `ancestry` or `class`. The key is the **slug** from the tables below, and the value is the file's path starting at `/art/`:

```js
const ART = {
  ancestry: {
    elf: '/art/ancestry-elf.webp',
    dwarf: '/art/ancestry-dwarf.png',
  },
  class: {
    wizard: '/art/class-wizard.png',
  },
};
```

Each image you register is used in two places:

- **The large portrait** when that option is selected.
- **The option's small tile**, which shows a crop of the top of the image instead of a letter. Keep the face in the upper part of the image so the crop looks good.

## 4. Check it

Run `npm run dev:client`, open **New character**, and select the ancestry or class. If you still see the placeholder, check that:

- the slug matches the tables below exactly (lowercase),
- the path starts with `/art/`, not `/public/art/` or `client/...`,
- the file name in `art.js` matches the file on disk, including its extension.

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

If new books are imported later, their slugs are the `slug` fields in `packages/rules/data/pf2e-level1.json`. You can also list them with:

```bash
node -e 'const d=require("./packages/rules/data/pf2e-level1.json");console.log(d.ancestries.map(a=>a.slug).join(" "));console.log(d.classes.map(c=>c.slug).join(" "))'
```

## Changing the placeholder

The fallback image is `PLACEHOLDER_ART` in `art.js`, currently `/art/placeholder-hero.png`. To change it, point that at a different file.

## Licensing

The class art is Paizo's iconic character art. If it came from Paizo's Community Use Package, the [Community Use Policy](https://paizo.com/licenses/communityuse) allows it in free, non-commercial fan projects, as long as the site shows Paizo's required notice. The notice says the site uses Paizo's trademarks and copyrights under that policy, isn't published or endorsed by Paizo, and doesn't charge for access. Check the policy page for the exact wording before publishing, and keep RollBound free while it uses this art.

Only add art you have the right to publish, such as art you made, commissioned, or licensed. The current placeholder is Monster Hunter art owned by Capcom, so it's listed in `.gitignore` and never committed. Don't publish the site with it. Art you own can be committed normally; just don't add it to `.gitignore`.

Other Paizo art, such as illustrations from the rulebooks, isn't covered by the policy, so stick to the Community Use Package.
