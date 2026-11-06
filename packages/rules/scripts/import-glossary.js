// Builds the rules glossary in glossary/ from the Archives of Nethys: the rulebooks' rules
// sections, conditions and traits, and the basic, skill and specialty actions from the core
// books. Legacy entries that have a Remaster version are left out in favour of it, and the
// Remaster entry keeps its old name ("Off-Guard, formerly Flat-Footed"), so either finds it.
//   npm run data:glossary --workspace @rollbound/rules   (add --refresh to re-download)
// Writes glossary/index.json (kinds and counts), glossary/entries.json (what lists and search
// need) and glossary/details/<kind>.json (each entry's text as HTML, loaded on demand).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blocks } from './aon-markdown.js';

const SEARCH = 'https://elasticsearch.aonprd.com/aon/_search';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'glossary');
const CACHE = join(here, '..', '..', '..', 'node_modules', '.cache', 'aon-glossary');
const refresh = process.argv.includes('--refresh');
const PAGE = 1000;
const CORE = ['Player Core', 'Player Core 2', 'GM Core'];

// What's in the glossary, by AoN category: rules, conditions and traits from the rulebooks;
// actions only from the core books (the rest belong to feats and items).
const KINDS = [
  { kind: 'Rule', category: 'rules', file: 'rules.json', filter: [{ term: { primary_source_category: 'Rulebooks' } }] },
  { kind: 'Condition', category: 'condition', file: 'conditions.json', filter: [{ term: { primary_source_category: 'Rulebooks' } }] },
  { kind: 'Trait', category: 'trait', file: 'traits.json', filter: [{ term: { primary_source_category: 'Rulebooks' } }] },
  { kind: 'Action', category: 'action', file: 'actions.json', filter: [{ terms: { 'primary_source.keyword': CORE } }] },
];
const KIND_ORDER = ['Condition', 'Action', 'Rule', 'Trait'];
// AoN page links, as the ids of the entries they point at.
const LINK_PREFIX = { Rules: 'rules', Conditions: 'condition', Traits: 'trait', Actions: 'action' };

const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const listOf = (v) => (Array.isArray(v) ? v : v ? [v] : []);

async function getJson(url, options) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res.json();
    if (attempt >= 4) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

/** Every current (not legacy) record of one kind, a page at a time; cached between runs. */
async function fetchKind({ category, filter }) {
  const file = join(CACHE, `${category}.json`);
  if (!refresh && existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const query = {
    bool: {
      filter: [{ term: { category } }, ...filter],
      must_not: [{ exists: { field: 'remaster_id' } }, { term: { exclude_from_search: true } }],
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

// ---------- Text ----------

/** Plain text from AoN markdown, for summaries and search. */
const plain = (md = '') =>
  md
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\*\*|_/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** A summary of at most about 200 characters, cut at a word. */
function summaryOf(doc, md) {
  const text = plain(doc.summary_markdown ?? doc.summary ?? '') || plain(md).slice(0, 400);
  if (text.length <= 200) return text;
  return `${text.slice(0, 200).replace(/\s+\S*$/, '')}…`;
}
console.assert(summaryOf({ summary: 'A [b](/x) **c**.' }, '') === 'A b c.', 'summaryOf');

/**
 * An entry's text as HTML: its title and Source line are shown elsewhere, sidebars become
 * headed sections, and links to other glossary entries stay links (data-glossary="slug");
 * the rest become plain text.
 */
function details(md, slugById) {
  const marked = md
    .replace(/<title level="1"[\s\S]*?<\/title>/, '')
    .replace(/<traits>[\s\S]*?<\/traits>/g, '')
    .replace(/^\*\*Source\*\*[^\n]*$/m, '')
    .replace(/<\/?aside>/g, '\n\n')
    .replace(/<title[^>]*>\s*([\s\S]*?)\s*<\/title>/g, (_m, t) => `\n\n@@H@@${plain(t)}\n\n`)
    // A link to an entry in the glossary keeps its target, as a marker the HTML step can't mangle.
    .replace(/\[([^\]]*)\]\(\/(\w+)\.aspx\?ID=(\d+)[^)]*\)/g, (m, text, page, id) => {
      const slug = LINK_PREFIX[page] && slugById.get(`${LINK_PREFIX[page]}-${id}`);
      return slug ? `@@L${slug}@@${text}@@E@@` : text;
    });
  return blocks(marked)
    .replace(/<p>@@H@@([\s\S]*?)<\/p>/g, '<h3 class="glossary-sub">$1</h3>')
    .replace(/@@L([a-z0-9-]+)@@([\s\S]*?)@@E@@/g, '<a href="/glossary/$1" data-glossary="$1">$2</a>')
    .replace(/@@[A-Z]@@/g, '')
    .replace(/<p>\s*<\/p>/g, '');
}

// ---------- Main ----------

const fetched = [];
for (const k of KINDS) fetched.push(...(await fetchKind(k)).map((doc) => ({ doc, k })));

// Slugs first, so text can link to any entry; an entry's legacy ids point at it too.
const seen = new Set();
const slugById = new Map();
const rows = fetched
  // Same name: the condition or action gets the plain address (/glossary/grapple), the trait a suffix.
  .sort((a, b) => a.doc.name.localeCompare(b.doc.name) || KIND_ORDER.indexOf(a.k.kind) - KIND_ORDER.indexOf(b.k.kind))
  .map(({ doc, k }) => {
    let slug = slugOf(doc.name);
    if (seen.has(slug)) slug = `${slug}-${k.kind.toLowerCase()}`;
    if (seen.has(slug)) slug = `${slug}-${doc.id.replace(/\D/g, '')}`;
    seen.add(slug);
    slugById.set(doc.id, slug);
    for (const legacy of listOf(doc.legacy_id)) slugById.set(legacy, slug);
    return { doc, k, slug };
  });

const entries = rows.map(({ doc, k, slug }) => {
  const md = doc.markdown ?? '';
  const crumbs = listOf(doc.breadcrumbs);
  const formerly = listOf(doc.legacy_name)[0];
  return {
    entry: {
      id: doc.id,
      slug,
      name: doc.name,
      kind: k.kind,
      summary: summaryOf(doc, md),
      // Where a rule sits in its book (AoN's breadcrumbs are its parents): "Chapter 8: Playing the Game › Movement".
      ...(crumbs.length && { path: crumbs.join(' › ') }),
      ...(doc.actions && { actions: doc.actions }),
      ...(doc.trait_raw?.length && k.kind === 'Action' && { traits: doc.trait_raw }),
      ...(formerly && formerly !== doc.name && { formerly }),
      book: doc.primary_source,
      page: Number(/pg\.\s*(\d+)/.exec(doc.primary_source_raw ?? '')?.[1]) || null,
      aon: `https://2e.aonprd.com${doc.url}`,
      details: k.file,
    },
    html: details(md, slugById),
  };
});

// Chapter headings with no text of their own go; links to them become plain text.
const kept = new Set(entries.filter((e) => e.html).map((e) => e.entry.slug));
const dropped = entries.filter((e) => !e.html).map((e) => e.entry.name);
entries.splice(0, entries.length, ...entries.filter((e) => e.html));
for (const e of entries) e.html = e.html.replace(/<a href="\/glossary\/([a-z0-9-]+)" data-glossary="\1">([\s\S]*?)<\/a>/g, (m, slug, text) => (kept.has(slug) ? m : text));

await rm(OUT, { recursive: true, force: true });
await mkdir(join(OUT, 'details'), { recursive: true });
const kinds = [];
for (const k of KINDS) {
  const list = entries.filter((e) => e.entry.kind === k.kind);
  await writeFile(join(OUT, 'details', k.file), `${JSON.stringify(Object.fromEntries(list.map((e) => [e.entry.id, e.html])))}\n`);
  kinds.push({ kind: k.kind, file: k.file, count: list.length });
}
await writeFile(join(OUT, 'entries.json'), `${JSON.stringify(entries.map((e) => e.entry))}\n`);
await writeFile(
  join(OUT, 'index.json'),
  `${JSON.stringify(
    {
      source: 'Archives of Nethys (2e.aonprd.com): rulebook rules, conditions and traits, and the core books’ actions; legacy entries replaced by their Remaster versions',
      license: 'Game mechanics © Paizo Inc., used under the ORC License.',
      generatedAt: new Date().toISOString(),
      count: entries.length,
      kinds,
    },
    null,
    1,
  )}\n`,
);

console.log(`${entries.length} entries:`);
for (const k of kinds) console.log(`  ${k.kind}: ${k.count}`);
if (dropped.length) console.log(`Left out ${dropped.length} heading(s) with no text: ${dropped.join(', ')}`);
