// Builds the armory in armory/ from the Archives of Nethys: every piece of equipment
// (weapons, armor, shields, and every other item category), as AoN lists it with
// legacy items hidden: an item that has a Remaster version is left out in favour of it.
// Variants ("Healing Potion (Minor)") stay on their parent's page, as on AoN.
//   npm run data:armory --workspace @rollbound/rules   (add --refresh to re-download)
// Writes armory/index.json (categories), armory/items.json (what lists and filters
// need) and armory/details/<category>.json (each item's rules text, loaded on demand).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks, esc, unlink } from './aon-markdown.js';

const SEARCH = 'https://elasticsearch.aonprd.com/aon/_search';
const CATEGORIES = ['equipment', 'weapon', 'armor', 'shield'];
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'armory');
const CACHE = join(here, '..', '..', '..', 'node_modules', '.cache', 'aon-armory');
const refresh = process.argv.includes('--refresh');
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const PAGE = 1000;

const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function getJson(url, options) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    if (attempt >= 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

/** Every current (not legacy) parent item, a page at a time; cached between runs. */
async function fetchAll() {
  const file = join(CACHE, 'equipment.json');
  if (!refresh && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const query = {
    bool: {
      filter: [{ terms: { category: CATEGORIES } }],
      must_not: [{ exists: { field: 'remaster_id' } }, { exists: { field: 'item_parent_id' } }, { term: { exclude_from_search: true } }],
    },
  };
  const docs = [];
  for (let from = 0; ; from += PAGE) {
    const r = await getJson(SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, size: PAGE, sort: [{ 'id.keyword': 'asc' }], query }),
    });
    docs.push(...r.hits.hits.map((h) => h._source));
    if (r.hits.hits.length < PAGE) break;
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(docs));
  return docs;
}

// ---------- Prices ----------

const COIN = { cp: 1, sp: 10, gp: 100, pp: 1000 };
/** "1,200 gp" → 120000; "5 sp (50 ft.)" → 50; null when there's no price. */
const toCp = (raw) => {
  const m = /([\d,]+)\s*(cp|sp|gp|pp)/.exec(raw ?? '');
  return m ? Number(m[1].replace(/,/g, '')) * COIN[m[2]] : null;
};

// ---------- Rules text ----------

// Fields the page shows as numbers at the top, so they're left out of the text.
const SHOWN = new Set(['Source', 'Price', 'Bulk', 'Usage', 'Hands', 'Damage', 'Type', 'Category', 'Group', 'Favored Weapon', 'AC Bonus', 'Dex Cap', 'Strength', 'Check Penalty', 'Speed Penalty', 'Hardness', 'HP (BT)', 'Range', 'Reload', 'Ammunition']);
const fieldOf = (line) => /^\*\*([^*]+)\*\*/.exec(line.trim())?.[1] ?? null;

/** An item's header block (Source, Price, Activate...) as lines, without the fields shown elsewhere. */
function meta(column, { keepPrice = false } = {}) {
  const flat = column
    .replace(/<row>([\s\S]*?)<\/row>/g, '$1 ')
    .replace(/<row gap="tiny">([^\n]*?)<\/row>/g, '$1');
  const lines = [];
  for (const part of flat.replace(/<\/?(row|column)[^>]*>/g, '\n\n').split(/\n\s*\n/)) {
    const line = part.replace(/\s+/g, ' ').trim();
    const field = fieldOf(line);
    if (!line || (field && SHOWN.has(field) && !(keepPrice && field === 'Price'))) continue;
    lines.push(line);
  }
  return lines.join('\n\n');
}

/** The first <column> block in a section, and everything after it. */
function splitMeta(section) {
  const m = /<column gap="tiny">([\s\S]*?)<\/column>/.exec(section);
  if (!m) return { head: '', rest: section };
  return { head: m[1], rest: section.slice(m.index + m[0].length) };
}

/** The rules text: description and variants, as HTML. Generic weapon sections are left out. */
function details(md) {
  // Weapons and armor end with group-wide sections (critical specialization, specific
  // magic weapons): untitled-level <title level="2"> without a right-hand label.
  const cut = md.search(/<title level="2">/);
  const body = (cut >= 0 ? md.slice(0, cut) : md).replace(/<aside>[\s\S]*?<\/aside>/g, '');
  const titles = [...body.matchAll(/<title\s+([\s\S]*?)>\s*([\s\S]*?)\s*<\/title>/g)];
  let html = '';
  titles.forEach((t, i) => {
    const end = i + 1 < titles.length ? titles[i + 1].index : body.length;
    const section = body.slice(t.index + t[0].length, end).replace(/<traits>[\s\S]*?<\/traits>/g, '');
    const { head, rest } = splitMeta(section);
    const variant = /level="2"/.test(t[1]);
    if (variant) {
      const right = /right="([^"]*)"/.exec(t[1])?.[1] ?? '';
      html += `<h3 class="item-variant">${esc(unlink(t[2]).trim())}${right ? ` <span>${esc(right)}</span>` : ''}</h3>`;
    }
    html += blocks(`${meta(head, { keepPrice: variant })}\n\n${rest.replace(/^\s*---+\s*$/m, '')}`);
  });
  return html.replace(/<p>\s*<\/p>/g, '');
}

/** Each variant's name, level and price, for the list ("from 4 gp"). */
const variantsOf = (md) =>
  [...md.matchAll(/<title\s+level="2"\s+right="Item (\d+)"[\s\S]*?>\s*([\s\S]*?)\s*<\/title>([\s\S]*?)(?=<title|$)/g)].map((m) => ({
    name: unlink(m[2]).trim(),
    level: Number(m[1]),
    price: /\*\*Price\*\*\s*([^\n]+)/.exec(m[3])?.[1].trim() ?? null,
  }));

// ---------- Items ----------

const titleCase = (s) => (s ? s.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/ (And|Of|The) /g, (w) => w.toLowerCase()) : s);

function mapItem(doc) {
  const md = doc.markdown ?? '';
  const variants = variantsOf(md);
  const priced = variants.filter((v) => toCp(v.price) != null).sort((a, b) => toCp(a.price) - toCp(b.price));
  // AoN stores a free item (a club, a sling) as price 0 with no price text.
  const price = doc.price_raw ?? (doc.price === 0 ? 'Free' : priced[0] ? (variants.length > 1 ? `from ${priced[0].price}` : priced[0].price) : null);
  const item = {
    id: `aon-${doc.id}`,
    slug: slugOf(doc.name),
    name: doc.name,
    level: doc.level ?? 0,
    category: titleCase(doc.item_category ?? doc.category),
    subcategory: doc.item_subcategory ?? null,
    rarity: doc.rarity ?? 'common',
    traits: (doc.trait_raw ?? []).filter((t) => !RARITIES.includes(t.toLowerCase())),
    price,
    cp: doc.price ?? (priced[0] ? toCp(priced[0].price) : null),
    bulk: doc.bulk_raw ?? null,
    usage: doc.usage ?? null,
    hands: doc.hands ?? null,
    book: doc.primary_source,
    page: Number(/pg\.\s*(\d+)/.exec(doc.primary_source_raw ?? '')?.[1]) || null,
    formerly: doc.legacy_name?.[0] && doc.legacy_name[0] !== doc.name ? doc.legacy_name[0] : null,
    aon: `https://2e.aonprd.com${doc.url}`,
  };
  if (variants.length > 1) item.variants = variants;
  if (doc.category === 'weapon') {
    item.weapon = {
      category: doc.weapon_category ?? null,
      group: doc.weapon_group ?? null,
      type: doc.weapon_type ?? null,
      damage: doc.damage ?? null,
      range: doc.range_raw ?? (doc.range ? `${doc.range} ft.` : null),
      reload: doc.reload_raw ?? null,
    };
  }
  if (doc.category === 'armor') {
    item.armor = {
      category: doc.armor_category ?? null,
      group: doc.armor_group ?? null,
      ac: doc.ac ?? null,
      dexCap: doc.dex_cap ?? null,
      strength: doc.strength ?? null,
      checkPenalty: doc.check_penalty ?? null,
      speedPenalty: doc.speed_penalty ?? null,
    };
  }
  if (doc.category === 'shield') {
    item.shield = { ac: doc.ac ?? null, hardness: doc.hardness ?? null, hp: doc.hp_raw ?? null, speedPenalty: doc.speed_penalty ?? null };
  }
  return { item, html: details(md) };
}

// ---------- Main ----------

const docs = await fetchAll();
const mapped = docs.map(mapItem).sort((a, b) => a.item.name.localeCompare(b.item.name) || a.item.level - b.item.level);
// Two items with one name would make links ambiguous: give the later one its id.
const seen = new Set();
for (const { item } of mapped) {
  if (seen.has(item.slug)) item.slug = `${item.slug}-${item.id.replace(/\D/g, '')}`;
  seen.add(item.slug);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'details'), { recursive: true });
const byCategory = new Map();
for (const m of mapped) {
  if (!byCategory.has(m.item.category)) byCategory.set(m.item.category, []);
  byCategory.get(m.item.category).push(m);
}
const categories = [];
for (const [name, list] of [...byCategory].sort((a, b) => b[1].length - a[1].length)) {
  const file = `${slugOf(name)}.json`;
  for (const { item } of list) item.details = file;
  await writeFile(join(OUT, 'details', file), `${JSON.stringify(Object.fromEntries(list.map(({ item, html }) => [item.id, html])))}\n`);
  categories.push({ name, slug: slugOf(name), file, count: list.length });
}
await writeFile(join(OUT, 'items.json'), `${JSON.stringify(mapped.map((m) => m.item))}\n`);
const index = {
  source: 'Archives of Nethys (2e.aonprd.com): all equipment, legacy items replaced by their Remaster versions',
  license: 'Game mechanics © Paizo Inc., used under the ORC License.',
  generatedAt: new Date().toISOString(),
  count: mapped.length,
  categories,
};
await writeFile(join(OUT, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);

console.log(`${mapped.length} items in ${categories.length} categories:`);
for (const c of categories) console.log(`  ${c.name}: ${c.count}`);
const noText = mapped.filter((m) => !m.html);
if (noText.length) console.log(`\n${noText.length} item(s) without rules text: ${noText.slice(0, 15).map((m) => m.item.name).join(', ')}${noText.length > 15 ? '…' : ''}`);
const noPrice = mapped.filter((m) => m.item.price == null).length;
console.log(`${noPrice} item(s) without a price (artifacts, services and the like).`);
