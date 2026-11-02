// Cuts a square headshot from each pregenerated hero's portrait, for the portrait the
// builder preloads when a player picks them, and demo characters use. Writes public/stock/<slug>.webp. The
// portrait is the hero's own art in src/assets/pregens/portraits/<slug>.webp if there is
// one (their class art shows someone else), otherwise their class portrait.
//   npm run art:pregens
// The portraits are transparent and trimmed to the figure, so the head is the topmost
// wide, solid shape: rows are scanned from the top for an opaque run at least HEAD_MIN of
// the width (thinner things above it, like staffs and blades, are skipped). FOCUS
// overrides that for art where it guesses wrong: { x, y, size } as fractions of the image.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { PREGENS } from '@rollbound/rules';

const here = dirname(fileURLToPath(import.meta.url));
const ART = join(here, '..', 'src', 'assets', 'art');
const OUT = join(here, '..', 'public', 'stock');
const OWN = join(here, '..', 'src', 'assets', 'pregens', 'portraits');
const SIZE = 256;
const HEAD_MIN = 0.14;
const FOCUS = {
  ija: { x: 0.77, y: 0.4, size: 0.32 },
  jirelle: { x: 0.6, y: 0.1, size: 0.34 },
  korakai: { x: 0.47, y: 0.13, size: 0.36 },
  nhalmika: { x: 0.52, y: 0.19, size: 0.4 },
  usharak: { x: 0.37, y: 0.17, size: 0.36 },
};

mkdirSync(OUT, { recursive: true });
for (const p of PREGENS) {
  const own = join(OWN, `${p.slug}.webp`);
  const source = existsSync(own) ? own : join(ART, `class-${p.classSlug}.webp`);
  const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const opaque = (x, y) => data[(y * width + x) * 4 + 3] > 128;
  // The widest opaque run in a row: [start, end].
  const widest = (y) => {
    let best = [0, -1];
    let start = -1;
    for (let x = 0; x <= width; x++) {
      if (x < width && opaque(x, y)) {
        if (start < 0) start = x;
      } else if (start >= 0) {
        if (x - 1 - start > best[1] - best[0]) best = [start, x - 1];
        start = -1;
      }
    }
    return best;
  };
  let focus = FOCUS[p.slug];
  if (!focus) {
    let top = 0;
    while (top < height * 0.5 && widest(top)[1] - widest(top)[0] < width * HEAD_MIN) top++;
    // Centre on the head a little below where it starts, and frame head and shoulders.
    const size = Math.round(width * 0.42);
    const [a, b] = widest(Math.min(height - 1, top + Math.round(size * 0.25)));
    focus = { x: (a + b) / 2 / width, y: (top + size * 0.42) / height, size: size / width };
  }
  const side = Math.round(focus.size * width);
  const left = Math.max(0, Math.min(width - side, Math.round(focus.x * width - side / 2)));
  const top = Math.max(0, Math.min(height - side, Math.round(focus.y * height - side / 2)));
  await sharp(source)
    .extract({ left, top, width: side, height: side })
    .flatten({ background: '#1e0d0a' })
    .resize(SIZE, SIZE)
    .webp({ quality: 85, effort: 6 })
    .toFile(join(OUT, `${p.slug}.webp`));
  console.log(`saved  stock/${p.slug}.webp  (from ${side}px at ${left},${top})`);
}
