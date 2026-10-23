// Converts art for the builder into web-ready files in client/src/assets/art/.
//   npm run art:import -- <folder>
// Name each PNG/JPG/WebP in <folder> after its target, e.g. class-wizard.png or
// ancestry-elf-icon.png. Portraits are trimmed and capped at 1200px tall. Class icons
// (finished round emblems) are fitted into 192x192 with transparency. Ancestry icons
// are cropped to fill a 192x192 square, since the app draws their circular frame.
import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'src', 'assets', 'art');
const DATA = join(here, '..', '..', 'packages', 'rules', 'data', 'pf2e-level1.json');
const NAME = /^(ancestry|class)-([a-z0-9-]+?)(-icon)?$/;

const input = process.argv[2];
if (!input) {
  console.error('Usage: npm run art:import -- <folder of images>');
  process.exit(1);
}

const data = JSON.parse(readFileSync(DATA, 'utf8'));
const known = { ancestry: new Set(data.ancestries.map((a) => a.slug)), class: new Set(data.classes.map((c) => c.slug)) };

const files = readdirSync(input).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!files.length) console.log(`No images found in ${input}.`);

for (const file of files) {
  const name = basename(file, extname(file)).toLowerCase();
  const m = NAME.exec(name);
  if (!m) {
    console.log(`skip   ${file}: name it like class-wizard.png or ancestry-elf-icon.png`);
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
