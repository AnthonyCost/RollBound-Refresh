// Builds data/pf2e-level1.json from the Foundry VTT pf2e system's open data.
// Usage: npm run data:import --workspace @rollbound/rules
// Set GITHUB_TOKEN to raise the GitHub API rate limit.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Add "Impossible Magic" here once the Foundry data includes it; the run logs
// any skipped title containing "Impossible" so you can copy the exact string.
const BOOKS = ['Pathfinder Player Core', 'Pathfinder Player Core 2'];

const REPO = 'foundryvtt/pf2e';
const BRANCH = 'master';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'data', 'pf2e-level1.json');
const CACHE = join(here, '..', '..', '..', 'node_modules', '.cache', 'pf2e-import');

const SKILLS = [
  'acrobatics', 'arcana', 'athletics', 'crafting', 'deception', 'diplomacy', 'intimidation', 'medicine',
  'nature', 'occultism', 'performance', 'religion', 'society', 'stealth', 'survival', 'thievery',
];
const RANK_NAMES = ['untrained', 'trained', 'expert', 'master', 'legendary'];

const PACK_PATTERNS = [
  /^packs\/ancestries\/[^/]+\.json$/,
  /^packs\/heritages\/.+\.json$/,
  /^packs\/backgrounds\/.+\.json$/,
  /^packs\/classes\/[^/]+\.json$/,
  /^packs\/classfeatures\/[^/]+\.json$/,
  /^packs\/feats\/(ancestry|class|general|skill)\/.+\.json$/,
  /^packs\/equipment\/[^/]+\.json$/,
];

const headers = { 'User-Agent': 'rollbound-import' };
if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res.json();
    if (attempt >= 4 || res.status === 404) throw new Error(`${res.status} ${url}`);
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
}

async function fetchPack(sha, path) {
  const file = join(CACHE, sha, path);
  if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
  const json = await getJson(`https://raw.githubusercontent.com/${REPO}/${sha}/${path}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(json));
  return json;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        if (++done % 500 === 0) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
  return out;
}

// ---------- Description cleanup ----------

const ALLOWED_TAGS = new Set(['p', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'hr', 'br', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'h2', 'h3', 'h4']);

function cleanDescription(html = '') {
  return html
    .replace(/@UUID\[[^\]]+\]\{([^}]+)\}/g, '$1')
    .replace(/@UUID\[[^\]]*?([^.\]]+)\]/g, '$1')
    .replace(/@Check\[([^\]|]+)[^\]]*\](\{([^}]+)\})?/g, (_m, type, _b, label) => label ?? `${type.replace(/^type:/, '')[0].toUpperCase()}${type.replace(/^type:/, '').slice(1)} check`)
    .replace(/@Damage\[([^\]]*(?:\[[^\]]*\][^\]]*)*)\](\{([^}]+)\})?/g, (_m, expr, _b, label) => label ?? expr.replace(/\[([^\]]+)\]/g, ' $1').replace(/[()]/g, ''))
    .replace(/@Template\[([^\]]+)\](\{([^}]+)\})?/g, (_m, spec, _b, label) => {
      if (label) return label;
      const type = /type:(\w+)/.exec(spec)?.[1] ?? '';
      const dist = /distance:(\d+)/.exec(spec)?.[1];
      return dist ? `${dist}-foot ${type}` : type;
    })
    .replace(/\[\[\/(\w+)\s+([^\]]+?)(?:\s*#[^\]]*)?\]\](\{([^}]+)\})?/g, (_m, cmd, args, _b, label) => {
      if (label) return label;
      if (cmd === 'act') return args.split(/\s+/)[0].split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
      return args.replace(/[{}]/g, '');
    })
    .replace(/@Localize\[[^\]]+\]/g, '')
    .replace(/@\w+\[[^\]]*\](\{([^}]+)\})?/g, (_m, _b, label) => label ?? '')
    .replace(/<(\/?)([a-z0-9]+)\b[^>]*>/gi, (_m, close, tag) => (ALLOWED_TAGS.has(tag.toLowerCase()) ? `<${close}${tag.toLowerCase()}>` : ''))
    .replace(/<p>\s*<\/p>/g, '')
    .trim();
}

// ---------- Mappers ----------

const source = (item) => item.system.publication.title.replace(/^Pathfinder /, '');
const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const boostSlots = (boosts = {}) => Object.values(boosts).map((b) => b.value).filter((v) => v.length);

function skillChoice(rules = []) {
  const choice = rules.find((r) => r.key === 'ChoiceSet');
  const upgradesSkill = rules.some((r) => r.key === 'ActiveEffectLike' && String(r.path).startsWith('system.skills.'));
  if (!choice || !upgradesSkill) return null;
  if (choice.choices?.config === 'skills') return { any: true };
  if (Array.isArray(choice.choices)) {
    const values = choice.choices.map((c) => c.value);
    if (values.every((v) => SKILLS.includes(v))) return { options: values };
  }
  return null;
}

function mapAncestry(a) {
  const s = a.system;
  return {
    slug: a.system.slug ?? slugOf(a.name),
    name: a.name,
    hp: s.hp,
    size: s.size,
    speed: s.speed,
    vision: s.vision,
    boosts: boostSlots(s.boosts),
    flaws: Object.values(s.flaws ?? {}).flatMap((f) => f.value),
    languages: s.languages.value,
    additionalLanguages: { count: s.additionalLanguages.count, options: s.additionalLanguages.value },
    traits: s.traits.value,
    rarity: s.traits.rarity,
    description: cleanDescription(s.description.value),
    source: source(a),
  };
}

function mapHeritage(h) {
  const s = h.system;
  return {
    slug: s.slug ?? slugOf(h.name),
    name: h.name,
    ancestry: s.ancestry?.slug ?? null,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    skillChoice: skillChoice(s.rules),
    description: cleanDescription(s.description.value),
    source: source(h),
  };
}

function mapBackground(b) {
  const s = b.system;
  return {
    slug: s.slug ?? slugOf(b.name),
    name: b.name,
    boosts: boostSlots(s.boosts),
    skills: s.trainedSkills?.value ?? [],
    lore: s.trainedSkills?.lore ?? [],
    feats: Object.values(s.items ?? {}).map((i) => slugOf(i.name)),
    rarity: s.traits.rarity,
    description: cleanDescription(s.description.value),
    source: source(b),
  };
}

function mapFeat(f) {
  const s = f.system;
  return {
    slug: s.slug ?? slugOf(f.name),
    name: f.name,
    level: s.level.value,
    category: s.category,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    prerequisites: (s.prerequisites?.value ?? []).map((p) => p.value),
    actions: s.actionType.value === 'passive' ? null : s.actionType.value === 'action' ? s.actions.value : s.actionType.value,
    description: cleanDescription(s.description.value),
    source: source(f),
  };
}

function mapClass(c, featuresByName, featuresByTag) {
  const s = c.system;
  const features = Object.values(s.items ?? {})
    .filter((i) => i.level === 1)
    .map((i) => featuresByName.get(i.name))
    .filter(Boolean)
    .map((feature) => {
      const choiceRule = feature.system.rules?.find((r) => r.key === 'ChoiceSet' && Array.isArray(r.choices?.filter));
      const tag = choiceRule?.choices.filter.find((x) => typeof x === 'string' && x.startsWith('item:tag:'))?.slice('item:tag:'.length);
      const options = tag ? (featuresByTag.get(tag) ?? []) : [];
      return {
        name: feature.name,
        description: cleanDescription(feature.system.description.value),
        choice: options.length
          ? {
              key: tag,
              options: options.map((o) => ({ slug: o.system.slug ?? slugOf(o.name), name: o.name, description: cleanDescription(o.system.description.value) })),
            }
          : null,
      };
    });

  const classSkill = skillChoice(s.rules);
  return {
    slug: s.slug ?? slugOf(c.name),
    name: c.name,
    hp: s.hp,
    keyAbility: s.keyAbility.value,
    perception: RANK_NAMES[s.perception],
    saves: Object.fromEntries(Object.entries(s.savingThrows).map(([k, v]) => [k, RANK_NAMES[v]])),
    attacks: Object.fromEntries(['unarmed', 'simple', 'martial', 'advanced'].map((k) => [k, RANK_NAMES[s.attacks[k]]])),
    defenses: Object.fromEntries(['unarmored', 'light', 'medium', 'heavy'].map((k) => [k, RANK_NAMES[s.defenses[k]]])),
    trainedSkills: s.trainedSkills.value,
    skillChoice: classSkill?.options ?? null,
    additionalSkills: s.trainedSkills.additional,
    classFeatAt1: s.classFeatLevels.value.includes(1),
    spellcasting: Boolean(s.spellcasting),
    features,
    rarity: s.traits.rarity,
    description: cleanDescription(s.description.value),
    source: source(c),
  };
}

const priceCp = ({ gp = 0, sp = 0, cp = 0 } = {}) => gp * 100 + sp * 10 + cp;

function mapWeapon(w) {
  const s = w.system;
  return {
    slug: s.slug ?? slugOf(w.name),
    name: w.name,
    level: s.level?.value ?? 0,
    category: s.category,
    group: s.group,
    die: Number(String(s.damage.die).replace('d', '')) || null,
    damageType: s.damage.damageType,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    hands: s.usage?.value === 'held-in-two-hands' ? 2 : 1,
    range: s.range ?? null,
    price: priceCp(s.price?.value),
    bulk: s.bulk?.value ?? 0,
    source: source(w),
  };
}

function mapArmor(a) {
  const s = a.system;
  return {
    slug: s.slug ?? slugOf(a.name),
    name: a.name,
    level: s.level?.value ?? 0,
    category: s.category,
    acBonus: s.acBonus,
    dexCap: s.dexCap,
    strength: s.strength,
    checkPenalty: s.checkPenalty,
    speedPenalty: s.speedPenalty,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    price: priceCp(s.price?.value),
    bulk: s.bulk?.value ?? 0,
    source: source(a),
  };
}

function mapShield(sh) {
  const s = sh.system;
  return {
    slug: s.slug ?? slugOf(sh.name),
    name: sh.name,
    acBonus: s.acBonus,
    hardness: s.hardness,
    hp: s.hp?.max,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    price: priceCp(s.price?.value),
    bulk: s.bulk?.value ?? 0,
    source: source(sh),
  };
}

// ---------- Main ----------

const commit = await getJson(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`);
const sha = commit.sha;
console.log(`Foundry pf2e @ ${sha.slice(0, 10)} (${commit.commit.committer.date})`);

const tree = await getJson(`https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1`);
if (tree.truncated) throw new Error('GitHub truncated the file tree; cannot import reliably.');
const paths = tree.tree.filter((e) => e.type === 'blob' && PACK_PATTERNS.some((p) => p.test(e.path))).map((e) => e.path);
console.log(`Fetching ${paths.length} files (cached in ${CACHE})`);

const items = await mapLimit(paths, 32, async (path) => ({ path, item: await fetchPack(sha, path) }));

const skippedImpossible = new Set();
const inBooks = items.filter(({ item }) => {
  const title = item.system?.publication?.title ?? '';
  if (/impossible/i.test(title) && !BOOKS.includes(title)) skippedImpossible.add(title);
  return BOOKS.includes(title);
});
if (skippedImpossible.size) console.log('Skipped titles mentioning "Impossible":', [...skippedImpossible]);

const byPack = (re) => inBooks.filter(({ path }) => re.test(path)).map(({ item }) => item);

const classFeatures = byPack(/^packs\/classfeatures\//);
const featuresByName = new Map(classFeatures.map((f) => [f.name, f]));
const featuresByTag = new Map();
for (const f of classFeatures) {
  for (const tag of f.system.traits?.otherTags ?? []) {
    if (!featuresByTag.has(tag)) featuresByTag.set(tag, []);
    featuresByTag.get(tag).push(f);
  }
}

const byName = (a, b) => a.name.localeCompare(b.name);
const backgrounds = byPack(/^packs\/backgrounds\//).map(mapBackground).sort(byName);
const level1Feats = byPack(/^packs\/feats\//).filter((f) => f.system.level.value === 1).map(mapFeat);

// A background's granted feat can come from an older book; include it anyway.
const featSlugs = new Set(level1Feats.map((f) => f.slug));
const grantedElsewhere = new Set(backgrounds.flatMap((b) => b.feats).filter((s) => !featSlugs.has(s)));
const grantedFeats = items
  .filter(({ path, item }) => path.startsWith('packs/feats/') && grantedElsewhere.has(item.system.slug ?? slugOf(item.name)))
  .map(({ item }) => mapFeat(item));

// Starting gear: items of your level or lower.
const equipment = byPack(/^packs\/equipment\//).filter((e) => (e.system.level?.value ?? 0) <= 1);
const ancestries = byPack(/^packs\/ancestries\//).map(mapAncestry).sort(byName);

const data = {
  meta: {
    source: `https://github.com/${REPO}`,
    commit: sha,
    books: BOOKS.map((b) => b.replace(/^Pathfinder /, '')),
    license: 'Game mechanics © Paizo Inc., used under the ORC License. Data via the Foundry VTT pf2e system.',
    generatedAt: new Date().toISOString(),
  },
  skills: SKILLS,
  languages: [...new Set(ancestries.flatMap((a) => [...a.languages, ...a.additionalLanguages.options]))].sort(),
  ancestries,
  heritages: byPack(/^packs\/heritages\//).map(mapHeritage).sort(byName),
  backgrounds,
  classes: byPack(/^packs\/classes\//).map((c) => mapClass(c, featuresByName, featuresByTag)).sort(byName),
  feats: [...level1Feats, ...grantedFeats].sort(byName),
  weapons: equipment.filter((e) => e.type === 'weapon').map(mapWeapon).sort(byName),
  armor: equipment
    .filter((e) => e.type === 'armor' && ['unarmored', 'light', 'medium', 'heavy'].includes(e.system.category))
    .map(mapArmor)
    .sort(byName),
  shields: equipment.filter((e) => e.type === 'shield').map(mapShield).sort(byName),
};

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(data, null, 1)}\n`);

const counts = Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`);
console.log(`Wrote ${OUT}\n  ${counts.join(', ')}`);
