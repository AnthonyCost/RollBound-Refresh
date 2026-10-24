// Builds a "hand-made book" for a book Foundry's data doesn't have yet, from the
// Archives of Nethys (2e.aonprd.com), Paizo's official online rules reference.
// Usage: npm run data:aon -- "Impossible Magic" [--refresh]
//
// It downloads the book's entries in a single request to AoN's search index
// (cached in node_modules/.cache/aon-import, so re-runs don't touch AoN), converts
// the level 1 content into RollBound's data format, and writes
// books/<book>.json. That file is committed and merged by `npm run data:import`,
// so it goes through the same corrections, report, tests and split as Foundry's data.
// Check the result against the book itself: AoN occasionally leaves fields blank.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEARCH = 'https://elasticsearch.aonprd.com/aon/_search';
const here = dirname(fileURLToPath(import.meta.url));
const BOOKS = join(here, '..', 'books');
const CACHE = join(here, '..', '..', '..', 'node_modules', '.cache', 'aon-import');

const SKILLS = [
  'acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine',
  'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery',
];
const ATTRIBUTES = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
// Class features every class has, which the builder covers with its own steps.
const GENERIC_FEATURES = ['Ancestry and Background', 'Attribute Boosts', 'Initial Proficiencies'];
// Class features that are a choice between subclass options, and the AoN category of those options.
const CHOICE_CATEGORIES = { 'Hybrid Study': 'hybrid-study', Eidolon: 'eidolon', 'Fatal Method': 'fatal-method', 'Grim Fascination': 'grim-fascination' };
// Subclass options for classes from other books, added to that class's existing choice.
const EXTRA_OPTIONS = { 'arcane-school': 'wizard-arcane-school' };
const ACTIONS = { 'Single Action': 1, 'Two Actions': 2, 'Three Actions': 3, Reaction: 'reaction', 'Free Action': 'free' };
const SPELL_ACTIONS = { 'Single Action': '1', 'Two Actions': '2', 'Three Actions': '3', Reaction: 'reaction', 'Free Action': 'free' };

const args = process.argv.slice(2);
const book = args.find((a) => !a.startsWith('--'));
if (!book) {
  console.error('Usage: npm run data:aon -- "<book title>" [--refresh]');
  process.exit(1);
}

const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lower = (list) => (list ?? []).map((x) => x.toLowerCase());
const idOf = (doc) => `aon-${doc.id}`;

async function download() {
  const file = join(CACHE, `${slugOf(book)}.json`);
  if (existsSync(file) && !args.includes('--refresh')) return JSON.parse(await readFile(file, 'utf8'));
  const res = await fetch(SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'rollbound-import' },
    body: JSON.stringify({ size: 5000, query: { bool: { filter: [{ match_phrase: { primary_source: book } }] } } }),
  });
  if (!res.ok) throw new Error(`AoN search failed: ${res.status}`);
  const docs = (await res.json()).hits.hits.map((h) => h._source).filter((d) => d.primary_source === book);
  if (!docs.length) throw new Error(`AoN has no entries for "${book}". Check the title on its Sources page.`);
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(docs));
  return docs;
}

/** AoN's markdown (with its own tags) to the plain HTML the rest of the data uses. */
function toHtml(markdown, { body = true } = {}) {
  let md = markdown ?? '';
  // The header (title, traits, source, stat lines) comes before the first rule; the rules text after it.
  if (body && md.includes('\n---\n')) md = md.slice(md.indexOf('\n---\n') + 5);
  md = md
    .replace(/<title[\s\S]*?<\/title>/g, '')
    .replace(/<actions string="([^"]+)"\s*\/>/g, (_m, a) => `[${a.toLowerCase()}]`)
    .replace(/<\/?(row|column|traits|trait|aside|additional-info|summary|document|center|br)[^>]*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const inline = (s) => s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_([^_]+)_/g, '$1<em>$2</em>');
  return md
    .split(/\n\s*\n|\n---\n/)
    .map((block) => block.trim().replace(/^---\s*/, ''))
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.every((l) => /^[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
      return `<p>${inline(lines.join(' '))}</p>`;
    })
    .join('\n');
}

/** A bold-labelled field from the markdown header, e.g. field(doc, 'Usage'). */
const field = (doc, label) => {
  const m = new RegExp(`\\*\\*${label}\\*\\*\\s*([^\\n]+)`).exec(doc.markdown ?? '');
  return m ? m[1].replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim() || null : null;
};

/** Feats a text grants outright: "You gain the general Shield Block feat". */
const grantedFeats = (text = '') => [...text.matchAll(/You gain the (?:general |skill )?([A-Z][\w' -]+?) (?:general |skill )?feat\b/g)].map((m) => slugOf(m[1]));

const rankOf = (text) => /^(Untrained|Trained|Expert|Master|Legendary)/i.exec(text ?? '')?.[1].toLowerCase() ?? 'untrained';
function proficiencyGroup(lines, names) {
  const out = Object.fromEntries(names.map((n) => [n, 'untrained']));
  for (const line of lines ?? []) {
    for (const n of names) if (new RegExp(`\\b${n}\\b`, 'i').test(line)) out[n] = rankOf(line);
  }
  return out;
}

function mapOption(doc, key) {
  const text = doc.text ?? '';
  const traditions = lower(doc.tradition);
  return {
    id: idOf(doc),
    slug: slugOf(doc.name),
    name: doc.name,
    tags: [key],
    skills: lower(doc.skill).filter((s) => SKILLS.includes(s)),
    skillChoice: null,
    feats: grantedFeats(text),
    proficiencies: {},
    tradition: traditions.length === 1 ? traditions[0] : null,
    traditionChoice: /Tradition (choose|Traits \(Variable\))/i.test(text) || traditions.length > 1,
    keyAbility: null,
    // Their focus spells (conflux, grave, link) are described in the text, like every class's focus spells.
    grantedSpells: [],
    description: toHtml(doc.markdown),
    source: book,
  };
}

function mapClass(doc, docs) {
  const features = docs
    .filter((d) => d.category === 'class-feature' && d.class === doc.name && (d.level ?? 1) === 1 && !GENERIC_FEATURES.includes(d.name))
    .sort((a, b) => Number(a.id.split('-').pop()) - Number(b.id.split('-').pop()))
    .map((f) => {
      const category = CHOICE_CATEGORIES[f.name];
      const key = `${slugOf(doc.name)}-${slugOf(f.name)}`;
      const options = category ? docs.filter((d) => d.category === category).sort((a, b) => a.name.localeCompare(b.name)) : [];
      return {
        name: f.name,
        description: toHtml(f.markdown),
        feats: grantedFeats(f.text),
        choice: options.length ? { key, options: options.map((o) => mapOption(o, key)) } : null,
      };
    });
  const skillLines = doc.skill_proficiency ?? [];
  const named = (line) => SKILLS.filter((s) => new RegExp(`\\b${s}\\b`, 'i').test(line));
  const choiceLine = skillLines.find((l) => /your choice of/i.test(l));
  return {
    id: idOf(doc),
    slug: slugOf(doc.name),
    name: doc.name,
    hp: doc.hp,
    keyAbility: lower(doc.attribute).map((a) => ATTRIBUTES[a]),
    perception: rankOf(doc.perception_proficiency),
    saves: { fortitude: rankOf(doc.fortitude_proficiency), reflex: rankOf(doc.reflex_proficiency), will: rankOf(doc.will_proficiency) },
    attacks: proficiencyGroup(doc.attack_proficiency, ['unarmed', 'simple', 'martial', 'advanced']),
    defenses: proficiencyGroup(doc.defense_proficiency, ['unarmored', 'light', 'medium', 'heavy']),
    trainedSkills: skillLines.filter((l) => !/choice|number|determined/i.test(l)).flatMap(named),
    skillChoice: choiceLine ? named(choiceLine) : null,
    additionalSkills: Number(/equal to (\d+) plus/.exec(skillLines.join(' '))?.[1] ?? 0),
    // A class feat at 1st level shows up as a "<Class> Feats" or "Evolution Feat" feature.
    classFeatAt1: features.some((f) => f.name === `${doc.name} Feats` || f.name === 'Evolution Feat'),
    deity: false,
    spellcasting: features.some((f) => /Spellcasting$/.test(f.name)),
    casting: null,
    divineFont: false,
    deityFavoredWeapon: null,
    features: features.filter((f) => f.name !== `${doc.name} Feats`),
    rarity: doc.rarity ?? 'common',
    description: toHtml(/_([^_]+)_/.exec(doc.markdown ?? '')?.[0] ?? '', { body: false }),
    source: book,
  };
}

function mapFeat(doc, classNames) {
  const traits = lower(doc.trait).filter((t) => !['common', 'uncommon', 'rare', 'unique'].includes(t));
  const groups = doc.trait_group ?? [];
  const category = traits.some((t) => classNames.includes(t))
    ? 'class'
    : traits.includes('general') ? (traits.includes('skill') ? 'skill' : 'general') : groups.includes('Ancestry') ? 'ancestry' : 'general';
  return {
    id: idOf(doc),
    slug: slugOf(doc.name),
    name: doc.name,
    level: doc.level,
    category,
    traits,
    rarity: doc.rarity ?? 'common',
    prerequisites: doc.prerequisite ? [doc.prerequisite.replace(/\.$/, '')] : [],
    actions: ACTIONS[doc.actions] ?? null,
    skills: [],
    feats: grantedFeats(doc.text),
    grantChoice: null,
    grantedOnlyIf: null,
    description: toHtml(doc.markdown),
    source: book,
  };
}

function mapSpell(doc) {
  const cantrip = doc.spell_type === 'Cantrip';
  return {
    id: idOf(doc),
    slug: slugOf(doc.name),
    name: doc.name,
    rank: cantrip ? 0 : doc.level,
    traditions: lower(doc.tradition),
    traits: lower(doc.trait).filter((t) => !['cantrip', 'common', 'uncommon', 'rare', 'unique'].includes(t)),
    rarity: doc.rarity ?? 'common',
    actions: SPELL_ACTIONS[doc.actions] ?? doc.actions?.toLowerCase() ?? '',
    range: doc.range_raw ?? null,
    area: field(doc, 'Area'),
    target: doc.target ?? null,
    defense: field(doc, 'Defense')?.toLowerCase() ?? null,
    duration: doc.duration_raw ?? null,
    description: toHtml(doc.markdown),
    source: book,
  };
}

function mapRune(doc) {
  return {
    id: idOf(doc),
    slug: slugOf(doc.name),
    name: doc.name,
    level: doc.level,
    traits: lower(doc.trait).filter((t) => !['common', 'uncommon', 'rare', 'unique'].includes(t)),
    rarity: doc.rarity ?? 'common',
    usage: field(doc, 'Usage'),
    description: toHtml(doc.markdown),
    source: book,
  };
}

const docs = await download();
const byName = (a, b) => a.name.localeCompare(b.name);
const level1 = (d) => (d.level ?? 1) <= 1;

const classes = docs.filter((d) => d.category === 'class').map((d) => mapClass(d, docs)).sort(byName);
const classNames = [...classes.map((c) => c.slug), 'wizard', 'witch', 'sorcerer', 'bard', 'cleric', 'druid', 'oracle', 'champion', 'fighter', 'ranger', 'rogue', 'monk', 'barbarian', 'alchemist', 'investigator', 'swashbuckler'];
const out = {
  $comment: `Level 1 content from ${book}, converted from the Archives of Nethys by scripts/import-aon.js. Regenerate rather than editing by hand; put fixes in corrections/.`,
  book,
  classes,
  heritages: [], // This book's heritages are for ancestries RollBound doesn't import yet (see the report).
  feats: docs.filter((d) => d.category === 'feat' && d.level === 1).map((d) => mapFeat(d, classNames)).sort(byName),
  spells: docs.filter((d) => d.category === 'spell' && level1(d) && ['Spell', 'Cantrip'].includes(d.spell_type) && d.tradition?.length).map(mapSpell).sort(byName),
  runes: docs.filter((d) => d.category === 'runesmith-rune' && level1(d)).map(mapRune).sort(byName),
  subclassOptions: Object.fromEntries(
    Object.entries(EXTRA_OPTIONS).map(([category, key]) => [key, docs.filter((d) => d.category === category).map((d) => mapOption(d, key)).sort(byName)]),
  ),
  skipped: {
    heritages: docs.filter((d) => d.category === 'heritage').map((d) => d.name).sort(),
  },
};

await mkdir(BOOKS, { recursive: true });
const file = join(BOOKS, `${slugOf(book)}.json`);
await writeFile(file, `${JSON.stringify(out, null, 1)}\n`);
const counts = ['classes', 'feats', 'spells', 'runes'].map((k) => `${k} ${out[k].length}`);
const extra = Object.entries(out.subclassOptions).map(([k, v]) => `${k} +${v.length}`);
console.log(`Wrote ${file}\n  ${[...counts, ...extra].join(', ')}`);
