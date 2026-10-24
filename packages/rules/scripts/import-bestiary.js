// Builds the bestiary in bestiary/ from the Archives of Nethys: every creature in
// Monster Core and Monster Core 2, with its numbers (for filtering and the encounter
// builder) and its whole stat block. Monster Core is checked against the Foundry VTT
// pf2e system's independent copy, and anything that disagrees is listed.
// Usage: npm run data:bestiary --workspace @rollbound/rules (add --refresh to re-download)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEARCH = 'https://elasticsearch.aonprd.com/aon/_search';
const FOUNDRY = 'https://raw.githubusercontent.com/foundryvtt/pf2e';
const FOUNDRY_TREE = 'https://api.github.com/repos/foundryvtt/pf2e/git/trees/master?recursive=1';
const BOOKS = ['Monster Core', 'Monster Core 2'];
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'bestiary');
const CACHE = join(here, '..', '..', '..', 'node_modules', '.cache', 'aon-bestiary');
const refresh = process.argv.includes('--refresh');

const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const fileOf = (book) => slugOf(book);
const unlink = (s = '') => s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
const RARITIES = ['common', 'uncommon', 'rare', 'unique'];
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const ACTION_ICONS = { 'Single Action': ['1', 'one action'], 'Two Actions': ['2', 'two actions'], 'Three Actions': ['3', 'three actions'], Reaction: ['r', 'reaction'], 'Free Action': ['f', 'free action'] };

async function cached(name, fetcher) {
  const file = join(CACHE, name);
  if (!refresh && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const data = await fetcher();
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data));
  return data;
}

async function getJson(url, options) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    if (attempt >= 4 || res.status === 404) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

const creaturesOf = (book) =>
  cached(`${fileOf(book)}.json`, () =>
    getJson(SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size: 1000, query: { bool: { filter: [{ term: { category: 'creature' } }, { term: { 'primary_source.keyword': book } }] } } }),
    }),
  ).then((r) => r.hits.hits.map((h) => h._source));

// ---------- Stat block markdown to HTML ----------

const esc = (s) => s.replace(/&(?!(?:[a-z]+|#\d+);)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline markdown: links become plain text, **bold** and _italic_ become tags, action glyphs become icons. */
function inline(text) {
  return esc(unlink(text))
    .replace(/&lt;actions string="([^"]+)"\s*\/&gt;/g, (_m, a) => {
      const [k, label] = ACTION_ICONS[a] ?? ['', a];
      return `<span class="act act--${k}" role="img" aria-label="${label}"></span>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/ {2,}/g, ' ')
    .replace(/(^|[\s(])_([^_]+)_(?=[\s),.;:]|$)/g, '$1<em>$2</em>');
}

/**
 * Turns a run of stat block markdown into paragraphs, lists and rules. Lines that
 * continue a list item (a spell rank's spells) or a labelled field (Languages, then
 * the languages) are joined to it.
 */
function blocks(md) {
  const out = [];
  const paragraphs = md
    .replace(/<\/?(row|column|traits|trait|document|br|center)[^>]*\/?>/g, '\n')
    .replace(/<table>[\s\S]*?<\/table>/g, (t) => `\n${t.replace(/\n/g, ' ')}\n`)
    // "**Melee** ◆ jaws +21 (reach 10 feet)," and its "**Damage** 2d12+9 piercing" are one line.
    .replace(/,\n\*\*Damage\*\*/g, ' **Damage**')
    .split(/\n\s*\n/);
  for (const raw of paragraphs) {
    const text = raw.trim();
    if (!text) continue;
    if (/^---+$/.test(text)) {
      out.push('<hr>');
      continue;
    }
    if (text.startsWith('<table>')) {
      out.push(text.replace(/<(\/?)(table|tr|td|th)[^>]*>/g, '<$1$2>').replace(/>([^<]+)</g, (_m, t) => `>${inline(t)}<`));
      continue;
    }
    const lines = [];
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      // A Strike's **Damage** stays on its attack's line, as in the book.
      const starts = /^[-*] /.test(line) || (/^\*\*[^*]+\*\*/.test(line) && !/^\*\*Damage\*\*/.test(line));
      if (/^---+$/.test(line)) lines.push('---');
      else if (starts || !lines.length) lines.push(line);
      else lines[lines.length - 1] += ` ${line}`;
    }
    let list = [];
    const flush = () => {
      if (list.length) out.push(`<ul>${list.map((l) => `<li>${inline(l)}</li>`).join('')}</ul>`);
      list = [];
    };
    for (const line of lines) {
      if (line === '---') {
        flush();
        out.push('<hr>');
      } else if (/^[-*] /.test(line)) list.push(line.slice(2));
      else {
        flush();
        out.push(`<p>${inline(line)}</p>`);
      }
    }
    flush();
  }
  // A few AoN entries have unbalanced bold markers or a link the parser missed; tidy those last.
  return out
    .join('')
    .replace(/\[([^\]]*)\]\(\/[^)]*\)/g, '$1')
    .replace(/\*\*/g, '');
}

/** The stat block: everything from the second title (traits onward), without the source line and sidebars. */
function statBlock(md) {
  const start = md.indexOf('<title level="2"');
  let block = start >= 0 ? md.slice(start) : md;
  block = block
    .replace(/<aside>[\s\S]*?<\/aside>/g, '')
    .replace(/<title[\s\S]*?<\/title>/g, '')
    .replace(/<traits>[\s\S]*?<\/traits>/g, '')
    .replace(/^\*\*Source\*\*.*$/m, '')
    // Stat rows ("**AC** 29 / **Fort** +19 ...") read as one line, separated by semicolons.
    .replace(/<row gap="medium">([\s\S]*?)<\/row>/g, (_m, row) =>
      `\n\n${row.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean).join('; ')}\n\n`,
    );
  return blocks(block);
}

/** Sidebars ("Dragon Turtle Rides"): lore and tips that sit beside the stat block. */
function sidebars(md) {
  return [...md.matchAll(/<aside>([\s\S]*?)<\/aside>/g)]
    .map(([, inner]) => ({ title: unlink(/<title[^>]*>([\s\S]*?)<\/title>/.exec(inner)?.[1] ?? '').trim(), html: blocks(inner.replace(/<title[\s\S]*?<\/title>/, '')) }))
    .filter((s) => s.html);
}

/** The lore before the stat block, and the Recall Knowledge DCs listed with it. */
function intro(md) {
  const start = md.indexOf('<title level="2"');
  const head = (start >= 0 ? md.slice(0, start) : '').replace(/<title[\s\S]*?<\/title>/g, '');
  const recall = [...head.matchAll(/\*\*\[?(Recall Knowledge[^\]*]*|Unspecific Lore|Specific Lore)\]?(?:\([^)]*\))?\*\*\s*(?:\(([^)]*\)?)\))?\s*:\s*DC (\d+)/g)].map((m) => ({
    label: m[1].trim(),
    skills: m[2] ? unlink(m[2]).replace(/\)$/, '').trim() : null,
    dc: Number(m[3]),
  }));
  const lore = head.replace(/<column gap="tiny">[\s\S]*?<\/column>/g, '');
  return { description: blocks(lore), recall };
}

const sum = (o) => Object.values(o ?? {}).filter((v) => typeof v === 'number');

function mapCreature(doc) {
  const md = doc.markdown ?? '';
  const traits = (doc.trait_raw ?? []).filter((t) => !RARITIES.includes(t.toLowerCase()));
  const { description, recall } = intro(md);
  return {
    id: `aon-${doc.id}`,
    slug: slugOf(doc.name),
    name: doc.name,
    level: doc.level,
    book: doc.primary_source,
    page: Number(/pg\.\s*(\d+)/.exec(doc.primary_source_raw ?? '')?.[1]) || null,
    rarity: doc.rarity ?? 'common',
    size: (doc.size ?? []).find((s) => SIZES.includes(s)) ?? null,
    traits,
    family: unlink(doc.creature_family_markdown ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    summary: unlink(doc.summary ?? '').replace(/\s+/g, ' ').trim(),
    perception: doc.perception ?? null,
    senses: unlink(doc.sense_markdown ?? '') || null,
    languages: unlink(doc.language_markdown ?? '').replace(/\s+/g, ' ').trim() || null,
    ac: doc.ac ?? null,
    hp: doc.hp ?? null,
    saves: { fortitude: doc.fortitude_save ?? null, reflex: doc.reflex_save ?? null, will: doc.will_save ?? null },
    abilities: { str: doc.strength, dex: doc.dexterity, con: doc.constitution, int: doc.intelligence, wis: doc.wisdom, cha: doc.charisma },
    speed: doc.speed_raw ?? null,
    immunities: doc.immunity ?? [],
    weaknesses: unlink(doc.weakness_markdown ?? '') || null,
    resistances: doc.resistance_raw?.replace(/\s+/g, ' ').trim() || null,
    attack: Math.max(0, ...(doc.attack_bonus ?? [])) || null,
    spellcaster: /Spells\*\*/.test(md),
    formerly: doc.legacy_name?.[0] && doc.legacy_name[0] !== doc.name ? doc.legacy_name[0] : null,
    description,
    recall,
    statBlock: statBlock(md),
    sidebars: sidebars(md),
    aon: `https://2e.aonprd.com${doc.url}`,
  };
}

// ---------- Cross-check Monster Core against Foundry ----------

async function foundryMonsterCore() {
  const tree = await cached('foundry-tree.json', () => getJson(FOUNDRY_TREE, { headers: { 'User-Agent': 'rollbound-import' } }));
  const paths = tree.tree.filter((e) => e.type === 'blob' && /^packs\/(pf2e\/)?pathfinder-monster-core\/[^/]+\.json$/.test(e.path)).map((e) => e.path);
  const out = [];
  for (let i = 0; i < paths.length; i += 24) {
    const batch = await Promise.all(
      paths.slice(i, i + 24).map((p) => cached(`foundry/${p.split('/').pop()}`, () => getJson(`${FOUNDRY}/${tree.sha}/${p}`, { headers: { 'User-Agent': 'rollbound-import' } }))),
    );
    out.push(...batch);
  }
  return out.filter((c) => c.type === 'npc');
}

function crossCheck(creatures, foundry) {
  const byName = new Map(foundry.map((f) => [f.name.toLowerCase(), f]));
  const issues = [];
  let matched = 0;
  for (const c of creatures) {
    const f = byName.get(c.name.toLowerCase());
    if (!f) continue;
    matched++;
    const s = f.system;
    const theirs = {
      level: s.details?.level?.value,
      hp: s.attributes?.hp?.max,
      ac: s.attributes?.ac?.value,
      perception: s.perception?.mod,
      fortitude: s.saves?.fortitude?.value,
      reflex: s.saves?.reflex?.value,
      will: s.saves?.will?.value,
    };
    const ours = { level: c.level, hp: c.hp, ac: c.ac, perception: c.perception, ...c.saves };
    const diff = Object.keys(theirs).filter((k) => theirs[k] != null && ours[k] != null && theirs[k] !== ours[k]);
    if (diff.length) issues.push(`${c.name}: ${diff.map((k) => `${k} ${ours[k]} here, ${theirs[k]} in Foundry`).join('; ')}`);
  }
  return { matched, issues };
}

// ---------- Main ----------

await mkdir(OUT, { recursive: true });
const index = { source: 'Archives of Nethys (2e.aonprd.com), checked against the Foundry VTT pf2e system', license: 'Game mechanics © Paizo Inc., used under the ORC License.', generatedAt: new Date().toISOString(), books: [] };
const all = [];
for (const book of BOOKS) {
  const creatures = (await creaturesOf(book)).map(mapCreature).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  // Two creatures with one name would make links ambiguous: give the later one its id.
  const seen = new Set();
  for (const c of creatures) {
    if (seen.has(c.slug)) c.slug = `${c.slug}-${c.id.replace(/\D/g, '')}`;
    seen.add(c.slug);
  }
  const file = `${fileOf(book)}.json`;
  await writeFile(join(OUT, file), `${JSON.stringify(creatures)}\n`);
  index.books.push({ book, file, count: creatures.length, levels: [creatures[0].level, creatures.at(-1).level] });
  all.push(...creatures);
  console.log(`${book}: ${creatures.length} creatures, levels ${creatures[0].level} to ${creatures.at(-1).level}`);
}
await writeFile(join(OUT, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);

const empty = all.filter((c) => !c.statBlock || c.hp == null || c.ac == null);
if (empty.length) console.log(`\n${empty.length} creature(s) missing a stat block, HP or AC: ${empty.map((c) => c.name).join(', ')}`);

const foundry = await foundryMonsterCore();
const { matched, issues } = crossCheck(all.filter((c) => c.book === 'Monster Core'), foundry);
console.log(`\nChecked ${matched} Monster Core creatures against Foundry's ${foundry.length}: ${issues.length ? `${issues.length} disagree` : 'all agree'} on level, HP, AC, Perception and saves.`);
for (const line of issues) console.log(`  - ${line}`);
