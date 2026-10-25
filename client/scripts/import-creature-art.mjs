// Adds bestiary art: matches each image in a folder to a creature by its file name and
// saves two copies in client/src/assets/creatures/: <slug>.webp, the whole picture for
// the creature's page (fitted inside 900x1600, roomy for 9:16 art), and
// <slug>-thumb.webp, a 192x192 square for cards and the encounter picker, cut around
// the most detailed part of the picture (usually the face).
//   npm run art:creatures -- <folder>
// "Goblin Warrior.webp", "goblin-warrior.webp" and "goblin_warrior.png" all match the
// Goblin Warrior; so does a creature's pre-Remaster name ("Adamantine Golem" finds the
// Adamant Sentinel). Creatures without an image just show without one.
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'assets', 'creatures');
const BESTIARY = join(here, '..', '..', 'packages', 'rules', 'bestiary');
const FULL = { width: 900, height: 1600 };
// Thumbnails show at most 64px; 192 keeps them sharp on high-density screens.
const THUMB = 192;

const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const input = process.argv[2];
if (!input || !existsSync(input)) {
  console.error('Usage: npm run art:creatures -- <folder of images>');
  process.exit(1);
}

const index = JSON.parse(await readFile(join(BESTIARY, 'index.json'), 'utf8'));
const creatures = (await Promise.all(index.books.map(async (b) => JSON.parse(await readFile(join(BESTIARY, b.file), 'utf8'))))).flat();
const bySlug = new Map();
for (const c of creatures) {
  bySlug.set(c.slug, c);
  if (c.formerly && !bySlug.has(slugOf(c.formerly))) bySlug.set(slugOf(c.formerly), c);
}

const files = readdirSync(input).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
if (!files.length) console.log(`No images found in ${input}.`);
const unmatched = [];
let saved = 0;
for (const file of files.sort()) {
  const c = bySlug.get(slugOf(basename(file, extname(file))));
  if (!c) {
    unmatched.push(file);
    continue;
  }
  const source = join(input, file);
  const info = await sharp(source)
    .resize({ ...FULL, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(join(OUT, `${c.slug}.webp`));
  // 'attention' crops around the busiest, most saturated area: on creature art, the head.
  await sharp(source)
    .resize(THUMB, THUMB, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80, effort: 6 })
    .toFile(join(OUT, `${c.slug}-thumb.webp`));
  saved++;
  console.log(`saved  ${c.slug}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB, plus its thumbnail  (${c.name})`);
}

const have = new Set(readdirSync(OUT).filter((f) => f.endsWith('.webp') && !f.endsWith('-thumb.webp')).map((f) => basename(f, '.webp')));
console.log(`\nSaved ${saved} of ${files.length} image(s). ${have.size} of ${creatures.length} creatures now have art.`);
if (unmatched.length) {
  console.log(`\n${unmatched.length} file(s) didn't match a creature's name, so they were skipped:`);
  for (const f of unmatched) {
    const words = slugOf(basename(f, extname(f))).split('-').filter((w) => w.length > 3);
    const near = creatures.filter((c) => words.some((w) => c.slug.includes(w))).slice(0, 3).map((c) => c.name);
    console.log(`  - ${f}${near.length ? `  (did you mean: ${near.join(', ')}?)` : ''}`);
  }
}
