// Converts art for the builder into web-ready files in client/src/assets/art/.
//   npm run art:import -- <folder>
// Name each PNG/JPG/WebP in <folder> after its target, e.g. class-wizard.png or
// ancestry-elf-icon.png. Adventure Path covers (adventure-<slug>.jpg) become wide
// campaign covers in client/src/assets/adventure-paths/ (see the README there).
// Portraits are trimmed and capped at 1200px tall. Class icons
// (finished round emblems) are fitted into 192x192 with transparency. Ancestry icons
// are cropped to fill a 192x192 square, since the app draws their circular frame.
import { readdirSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadRulesData } from '@rollbound/rules/load';
import { adventurePath } from '@rollbound/rules';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'assets', 'art');
const COVERS = join(here, '..', 'src', 'assets', 'adventure-paths');
const COVER = { width: 1600, height: 900 };
const NAME = /^(ancestry|class)-([a-z0-9-]+?)(-icon)?$/;

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run art:import -- <folder of images>');
  process.exit(1);
}

const data = loadRulesData({ types: ['ancestries', 'classes'] });
const known = { ancestry: new Set(data.ancestries.map((a) => a.slug)), class: new Set(data.classes.map((c) => c.slug)) };

const files = readdirSync(input).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) console.log(`No images found in ${input}.`);

for (const file of files) {
  const name = basename(file, extname(file)).toLowerCase();
  // A book cover is portrait and campaign covers are wide: set it over a blurred,
  // darkened copy of itself instead of cropping it.
  const path = /^adventure-([a-z0-9-]+)$/.exec(name)?.[1];
  if (path) {
    const source = join(input, file);
    const backdrop = await sharp(source).resize(COVER.width, COVER.height, { fit: 'cover' }).blur(28).modulate({ brightness: 0.45 }).toBuffer();
    const front = await sharp(source).resize({ height: COVER.height - 60, width: COVER.width, fit: 'inside' }).toBuffer();
    const dest = join(COVERS, `${path}.webp`);
    const info = await sharp(backdrop).composite([{ input: front, gravity: 'centre' }]).webp({ quality: 82, effort: 6 }).toFile(dest);
    const note = adventurePath(path) ? '' : `  (no Adventure Path "${path}" in adventurePaths.js)`;
    console.log(`saved  adventure-paths/${path}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB${note}`);
    continue;
  }
  const m = NAME.exec(name);
  if (!m) {
    console.log(`skip   ${file}: name it like class-wizard.png, ancestry-elf-icon.png or adventure-wardens-of-wildwood.jpg`);
    continue;
  }
  const [, kind, slug, icon] = m;
  const framed = icon && kind === 'ancestry';
  const image = sharp(join(input, file)).ensureAlpha().trim({ threshold: 1 });
  const resized = !icon
    ? image.resize({ height: 1200, withoutEnlargement: true })
    : framed
      ? image.resize(192, 192, { fit: 'cover', position: 'attention' })
      : image.resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  const dest = join(OUT, `${name}.webp`);
  const info = await resized.webp({ quality: icon ? 85 : 82, alphaQuality: icon ? 95 : 90, effort: 6 }).toFile(dest);

  // Round icons need everything outside the circle transparent, or a box shows behind them.
  let opaqueCorner = false;
  if (icon && !framed) {
    const { data: px, info: dim } = await sharp(dest).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const r = dim.width / 2;
    let outside = 0;
    let solid = 0;
    for (let y = 0; y < dim.height; y++) {
      for (let x = 0; x < dim.width; x++) {
        if (Math.hypot(x + 0.5 - r, y + 0.5 - dim.height / 2) <= r + 1) continue;
        outside++;
        if (px[(y * dim.width + x) * 4 + 3] > 32) solid++;
      }
    }
    opaqueCorner = solid / outside > 0.05;
  }
  const notes = [
    !known[kind].has(slug) && `no ${kind} "${slug}" in the imported books yet (kept for later)`,
    opaqueCorner && 'the area outside the circle is not transparent, so a box will show behind it',
  ].filter(Boolean);
  console.log(`saved  ${name}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB${notes.length ? `  (${notes.join('; ')})` : ''}`);
}
