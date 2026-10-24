// Builds data/pf2e-level1.json from the Foundry VTT pf2e system's open data.
// Usage: npm run data:import --workspace @rollbound/rules
// Set GITHUB_TOKEN to raise the GitHub API rate limit.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Add "Impossible Magic" here once the Foundry data includes it; the run logs
// any skipped title containing "Impossible" so you can copy the exact string.
const BOOKS = ['Pathfinder Player Core', 'Pathfinder Player Core 2'];

const REPO = 'foundryvtt/pf2e';
const BRANCH = 'master';
const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'data', 'pf2e-level1.json');
// Just the version, so screens can spot outdated characters without loading the data.
const VERSION_OUT = join(here, '..', 'data', 'version.json');
const CORRECTIONS = join(here, '..', 'corrections');
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
  /^packs\/deities\/.+\.json$/,
  /^packs\/spells\/(cantrip|1st-rank)\/.+\.json$/,
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

// ---------- Rule elements ----------
// Foundry encodes most mechanical effects as "rule elements". We read the few
// kinds that matter at 1st level: skill training, proficiency upgrades, granted
// feats, and skill choices. Anything else stays in the description text.

const source = (item) => item.system.publication.title.replace(/^Pathfinder /, '');
const slugOf = (name) => name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const boostSlots = (boosts = {}) => Object.values(boosts).map((b) => b.value).filter((v) => v.length);
const uuidName = (uuid) => (typeof uuid === 'string' && !uuid.includes('{') ? uuid.split('.Item.')[1] : null);

/** True when a rule's predicate holds for a 1st-level character of this class with no other options. */
function predicateApplies(predicate, cls) {
  if (!predicate) return true;
  const term = (t) => {
    if (typeof t === 'string') return t === `class:${cls}`;
    if (t.not || t.nor) return true;
    if (t.or) return t.or.some(term);
    if (t.and) return t.and.every(term);
    return false;
  };
  return predicate.every(term);
}

const PROFICIENCY_PATHS = [
  [/^system\.proficiencies\.defenses\.(\w+)\.rank$/, (m) => `defenses.${m[1]}`],
  [/^system\.proficiencies\.attacks\.(\w+)\.rank$/, (m) => `attacks.${m[1]}`],
  [/^system\.saves\.(\w+)\.rank$/, (m) => `saves.${m[1]}`],
  [/^system\.perception\.rank$/, () => 'perception'],
];

function ruleEffects(rules = [], cls = null) {
  const effects = { skills: [], skillChoice: null, feats: [], proficiencies: {}, tradition: null };
  for (const r of rules) {
    if (!predicateApplies(r.predicate, cls)) continue;
    if (r.key === 'ActiveEffectLike' && r.mode === 'upgrade' && typeof r.value === 'number') {
      const skill = /^system\.skills\.(\w+)\.rank$/.exec(r.path)?.[1];
      if (skill && SKILLS.includes(skill) && r.value === 1) effects.skills.push(skill);
      for (const [re, key] of PROFICIENCY_PATHS) {
        const m = re.exec(r.path);
        if (m) effects.proficiencies[key(m)] = RANK_NAMES[r.value];
      }
    }
    if (r.key === 'ActiveEffectLike' && /^system\.proficiencies\.aliases\./.test(r.path) && typeof r.value === 'string') {
      effects.tradition = r.value;
    }
    if (r.key === 'GrantItem' && /feats-srd/.test(r.uuid ?? '')) effects.feats.push(slugOf(uuidName(r.uuid)));
    if (r.key === 'ChoiceSet') {
      if (r.choices?.config === 'skills') effects.skillChoice = SKILLS;
      else if (Array.isArray(r.choices)) {
        const values = r.choices.map((c) => /^system\.skills\.(\w+)\.rank$/.exec(c.value)?.[1] ?? c.value);
        if (values.every((v) => SKILLS.includes(v))) effects.skillChoice = values;
      }
    }
  }
  return effects;
}

function mergeEffects(a, b) {
  return {
    skills: [...new Set([...a.skills, ...(b.skills ?? [])])],
    skillChoice: a.skillChoice ?? b.skillChoice ?? null,
    feats: [...new Set([...a.feats, ...(b.feats ?? [])])],
    proficiencies: { ...a.proficiencies, ...b.proficiencies },
    tradition: a.tradition ?? b.tradition ?? null,
  };
}

const plainText = (html) => cleanDescription(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

// ---------- Mappers ----------

function mapAncestry(a) {
  const s = a.system;
  return {
    id: a._id,
    slug: s.slug ?? slugOf(a.name),
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
  const effects = ruleEffects(s.rules);
  return {
    id: h._id,
    slug: s.slug ?? slugOf(h.name),
    name: h.name,
    ancestry: s.ancestry?.slug ?? null,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    senses: (s.rules ?? []).filter((r) => r.key === 'Sense').map((r) => r.selector),
    skills: effects.skills,
    skillChoice: effects.skillChoice,
    feats: effects.feats,
    featAncestries: [],
    description: cleanDescription(s.description.value),
    source: source(h),
  };
}

function mapBackground(b) {
  const s = b.system;
  return {
    id: b._id,
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

/** "Gain a 1st-level class feat" style choices, from a ChoiceSet filter. */
function featGrantChoice(rules = []) {
  const choice = rules.find((r) => r.key === 'ChoiceSet' && Array.isArray(r.choices?.filter) && r.choices.itemType === 'feat');
  const grants = rules.some((r) => r.key === 'GrantItem' && String(r.uuid).includes(`rulesSelections.${choice?.flag}`));
  if (!choice || !grants) return null;
  const strings = choice.choices.filter.filter((f) => typeof f === 'string');
  const level = Number(strings.find((f) => f.startsWith('item:level:'))?.split(':')[2]);
  const category = strings.find((f) => f.startsWith('item:category:'))?.split(':')[2] ?? null;
  const traits = strings.filter((f) => f.startsWith('item:trait:') && !f.includes('{')).map((f) => f.split(':')[2]);
  const classTrait = strings.some((f) => f.includes('system.details.class.trait'));
  return { level: level || 1, category, traits, classTrait };
}

function mapFeat(f) {
  const s = f.system;
  const effects = ruleEffects(s.rules);
  return {
    id: f._id,
    slug: s.slug ?? slugOf(f.name),
    name: f.name,
    level: s.level.value,
    category: s.category,
    traits: s.traits.value,
    rarity: s.traits.rarity,
    prerequisites: (s.prerequisites?.value ?? []).map((p) => p.value),
    actions: s.actionType.value === 'passive' ? null : s.actionType.value === 'action' ? s.actions.value : s.actionType.value,
    skills: effects.skills,
    feats: effects.feats,
    grantChoice: featGrantChoice(s.rules),
    grantedOnlyIf: null,
    description: cleanDescription(s.description.value),
    source: source(f),
  };
}

function mapSubclassOption(o, cls, featuresByUuidName) {
  const slug = o.system.slug ?? slugOf(o.name);
  let effects = ruleEffects(o.system.rules, cls);

  // Cleric doctrines point at a separate "First Doctrine (X)" feature for their 1st-level effects.
  for (const r of o.system.rules ?? []) {
    const first = r.key === 'ActiveEffectLike' && r.value?.firstDoctrine && featuresByUuidName.get(uuidName(r.value.firstDoctrine));
    if (first) effects = mergeEffects(effects, ruleEffects(first.system.rules, cls));
  }

  const text = plainText(o.system.description.value);
  const tradition = effects.tradition ?? /(?:Tradition|Spell List) (arcane|divine|occult|primal)\b/.exec(text)?.[1] ?? null;
  const gifts = /Sorcerous Gifts:? cantrip:? ([^;,]+)[;,] 1st: ([^;,]+)[;,]/.exec(text);
  const giftSpells = gifts && !/see /i.test(gifts[0]) ? [slugOf(gifts[1].trim()), slugOf(gifts[2].trim())] : [];

  return {
    id: o._id,
    slug,
    name: o.name.replace(/^Bloodline: /, ''),
    tags: o.system.traits.otherTags ?? [],
    skills: effects.skills,
    skillChoice: effects.skillChoice,
    feats: effects.feats,
    proficiencies: effects.proficiencies,
    tradition,
    traditionChoice: /Tradition variable/.test(text),
    keyAbility: null,
    grantedSpells: giftSpells,
    description: cleanDescription(o.system.description.value),
    source: source(o),
  };
}

function mapClass(c, featuresByUuidName, featuresByTag) {
  const s = c.system;
  const slug = s.slug ?? slugOf(c.name);
  const features = Object.values(s.items ?? {})
    .filter((i) => i.level === 1)
    .map((i) => featuresByUuidName.get(uuidName(i.uuid)) ?? featuresByUuidName.get(i.name))
    .filter(Boolean)
    .map((feature) => {
      const choiceRule = feature.system.rules?.find((r) => r.key === 'ChoiceSet' && Array.isArray(r.choices?.filter));
      const tag = choiceRule?.choices.filter.find((x) => typeof x === 'string' && x.startsWith('item:tag:'))?.slice('item:tag:'.length);
      const options = tag ? (featuresByTag.get(tag) ?? []) : [];
      const effects = ruleEffects(feature.system.rules, slug);
      return {
        name: feature.name.replace(/ \(\w+\)$/, ''),
        description: cleanDescription(feature.system.description.value),
        feats: effects.feats,
        choice: options.length ? { key: tag, options: options.map((o) => mapSubclassOption(o, slug, featuresByUuidName)) } : null,
      };
    });

  const classSkill = ruleEffects(s.rules, slug).skillChoice;
  return {
    id: c._id,
    slug,
    name: c.name,
    hp: s.hp,
    keyAbility: s.keyAbility.value,
    perception: RANK_NAMES[s.perception],
    saves: Object.fromEntries(Object.entries(s.savingThrows).map(([k, v]) => [k, RANK_NAMES[v]])),
    attacks: Object.fromEntries(['unarmed', 'simple', 'martial', 'advanced'].map((k) => [k, RANK_NAMES[s.attacks[k]]])),
    defenses: Object.fromEntries(['unarmored', 'light', 'medium', 'heavy'].map((k) => [k, RANK_NAMES[s.defenses[k]]])),
    trainedSkills: s.trainedSkills.value,
    skillChoice: classSkill,
    additionalSkills: s.trainedSkills.additional,
    classFeatAt1: s.classFeatLevels.value.includes(1),
    deity: features.some((f) => /^Deity$/.test(f.name)),
    spellcasting: Boolean(s.spellcasting),
    // Filled in by corrections (see corrections/README.md).
    casting: null,
    divineFont: false,
    deityFavoredWeapon: null,
    features: features.filter((f) => f.name !== 'Deity'),
    rarity: s.traits.rarity,
    description: cleanDescription(s.description.value),
    source: source(c),
  };
}

const priceCp = ({ gp = 0, sp = 0, cp = 0 } = {}) => gp * 100 + sp * 10 + cp;

function mapWeapon(w) {
  const s = w.system;
  return {
    id: w._id,
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
    id: a._id,
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
    id: sh._id,
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

function mapDeity(d) {
  const s = d.system;
  return {
    id: d._id,
    slug: s.slug ?? slugOf(d.name),
    name: d.name,
    font: s.font,
    sanctification: s.sanctification ? { modal: s.sanctification.modal, what: s.sanctification.what } : null,
    skills: s.skill ?? [],
    weapons: s.weapons ?? [],
    domains: s.domains?.primary ?? [],
    attribute: s.attribute ?? [],
    description: cleanDescription(s.description.value),
    source: source(d),
  };
}

function mapSpell(sp) {
  const s = sp.system;
  const cantrip = s.traits.value.includes('cantrip');
  return {
    id: sp._id,
    slug: s.slug ?? slugOf(sp.name),
    name: sp.name,
    rank: cantrip ? 0 : s.level.value,
    traditions: s.traits.traditions ?? [],
    traits: s.traits.value.filter((t) => t !== 'cantrip'),
    rarity: s.traits.rarity,
    actions: s.time?.value ?? '',
    range: s.range?.value || null,
    area: s.area ? `${s.area.value}-foot ${s.area.type}` : null,
    target: s.target?.value || null,
    defense: s.defense?.save ? `${s.defense.save.basic ? 'basic ' : ''}${s.defense.save.statistic}` : s.defense?.passive?.statistic ?? null,
    duration: s.duration?.value || null,
    description: cleanDescription(s.description.value),
    source: source(sp),
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

const items = (await mapLimit(paths, 32, async (path) => ({ path, item: await fetchPack(sha, path) }))).filter(({ item }) => item.system);

const skippedImpossible = new Set();
const inBooks = items.filter(({ item }) => {
  const title = item.system.publication?.title ?? '';
  if (/impossible/i.test(title) && !BOOKS.includes(title)) skippedImpossible.add(title);
  return BOOKS.includes(title);
});
if (skippedImpossible.size) console.log('Skipped titles mentioning "Impossible":', [...skippedImpossible]);

const byPack = (re) => inBooks.filter(({ path }) => re.test(path)).map(({ item }) => item);
const byName = (a, b) => a.name.localeCompare(b.name);

const classFeatures = byPack(/^packs\/classfeatures\//);
const featuresByUuidName = new Map(classFeatures.map((f) => [f.name, f]));
const featuresByTag = new Map();
for (const f of classFeatures) {
  for (const tag of f.system.traits?.otherTags ?? []) {
    if (!featuresByTag.has(tag)) featuresByTag.set(tag, []);
    featuresByTag.get(tag).push(f);
  }
}

const classes = byPack(/^packs\/classes\//).map((c) => mapClass(c, featuresByUuidName, featuresByTag)).sort(byName);
const heritages = byPack(/^packs\/heritages\//).map(mapHeritage).sort(byName);
const backgrounds = byPack(/^packs\/backgrounds\//).map(mapBackground).sort(byName);
let feats = byPack(/^packs\/feats\//).filter((f) => f.system.level.value === 1).map(mapFeat);

// Feats granted by something we import can come from any level or older book; include them too.
// Several books can have a feat with the same name (e.g. a legacy and a Remaster
// version). Prefer the one from the selected books, then any Remaster version.
const featRank = (item) => (BOOKS.includes(item.system.publication?.title) ? 2 : item.system.publication?.remaster ? 1 : 0);
const allFeats = new Map();
for (const { path, item } of items) {
  if (!path.startsWith('packs/feats/')) continue;
  const slug = item.system.slug ?? slugOf(item.name);
  const current = allFeats.get(slug);
  if (!current || featRank(item) > featRank(current)) allFeats.set(slug, item);
}
for (let pass = 0; pass < 3; pass++) {
  const have = new Set(feats.map((f) => f.slug));
  const wanted = [
    ...backgrounds.flatMap((b) => b.feats),
    ...heritages.flatMap((h) => h.feats),
    ...feats.flatMap((f) => f.feats),
    ...classes.flatMap((c) => c.features.flatMap((f) => [...f.feats, ...(f.choice?.options.flatMap((o) => o.feats) ?? [])])),
  ].filter((s) => !have.has(s) && allFeats.has(s));
  if (!wanted.length) break;
  feats = feats.concat([...new Set(wanted)].map((s) => mapFeat(allFeats.get(s))));
}

const ancestries = byPack(/^packs\/ancestries\//).map(mapAncestry).sort(byName);
// Starting gear: items of your level or lower.
const equipment = byPack(/^packs\/equipment\//).filter((e) => (e.system.level?.value ?? 0) <= 1);

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
  heritages,
  backgrounds,
  classes,
  feats: feats.sort(byName),
  // Player Core's deities; Foundry files them under Divine Mysteries, which reprints them.
  deities: items
    .filter(({ path, item }) => path.startsWith('packs/deities/core-gods/') && item.system.category === 'deity')
    .map(({ item }) => mapDeity(item))
    .sort(byName),
  spells: byPack(/^packs\/spells\//).map(mapSpell).sort(byName),
  weapons: equipment.filter((e) => e.type === 'weapon').map(mapWeapon).sort(byName),
  armor: equipment
    .filter((e) => e.type === 'armor' && ['unarmored', 'light', 'medium', 'heavy'].includes(e.system.category))
    .map(mapArmor)
    .sort(byName),
  shields: equipment.filter((e) => e.type === 'shield').map(mapShield).sort(byName),
};

// ---------- Corrections ----------
// Rules Foundry's data doesn't encode, one file per book (see corrections/README.md).

const bookFile = (title) => `${slugOf(title.replace(/^Pathfinder /, ''))}.json`;
const CORRECTABLE = {
  classes: { list: () => data.classes, fields: ['casting', 'divineFont', 'deityFavoredWeapon'] },
  subclassOptions: {
    list: () => data.classes.flatMap((c) => c.features.flatMap((f) => f.choice?.options ?? [])),
    fields: ['proficiencies', 'keyAbility'],
  },
  heritages: { list: () => data.heritages, fields: ['featAncestries'] },
  feats: { list: () => data.feats, fields: ['grantedOnlyIf'] },
};

const correctionFiles = new Set((await readdir(CORRECTIONS)).filter((f) => f.endsWith('.json')));
for (const title of BOOKS) {
  const file = bookFile(title);
  if (!correctionFiles.has(file)) continue;
  correctionFiles.delete(file);
  const book = title.replace(/^Pathfinder /, '');
  const corrections = JSON.parse(await readFile(join(CORRECTIONS, file), 'utf8'));
  for (const [section, entries] of Object.entries(corrections)) {
    if (section.startsWith('$')) continue;
    const kind = CORRECTABLE[section];
    if (!kind) throw new Error(`${file}: unknown section "${section}"`);
    for (const [slug, fix] of Object.entries(entries)) {
      const target = kind.list().find((x) => x.slug === slug && x.source === book);
      if (!target) throw new Error(`${file}: no ${section} entry "${slug}" in ${book}`);
      for (const [field, value] of Object.entries(fix)) {
        if (!kind.fields.includes(field)) throw new Error(`${file}: ${section}.${slug} can't correct "${field}"`);
        target[field] = field === 'proficiencies' ? { ...target.proficiencies, ...value } : value;
      }
    }
  }
}
for (const unused of correctionFiles) console.log(`Note: corrections/${unused} is for a book that isn't being imported.`);

// ---------- Link references by ID ----------
// Items reference each other (a background grants a feat, a bloodline grants a spell).
// Those links are found by name during import, then stored as stable Foundry IDs.

const needsReview = [];
const linker = (list, label) => {
  const bySlug = new Map(list.map((x) => [x.slug, x.id]));
  return (refs, owner) =>
    refs.flatMap((slug) => {
      const id = bySlug.get(slug);
      if (!id) needsReview.push(`${owner}: grants ${label} "${slug}", which wasn't found`);
      return id ? [id] : [];
    });
};
const linkFeats = linker(data.feats, 'feat');
const linkSpells = linker(data.spells, 'spell');
const ancestryIds = new Map(data.ancestries.map((a) => [a.slug, a.id]));
for (const h of data.heritages) {
  if (!h.ancestry) continue; // versatile heritages fit any ancestry
  const id = ancestryIds.get(h.ancestry);
  if (!id) needsReview.push(`${h.name}: belongs to ancestry "${h.ancestry}", which wasn't found`);
  h.ancestry = id ?? null;
}
for (const b of data.backgrounds) b.feats = linkFeats(b.feats, b.name);
for (const h of data.heritages) h.feats = linkFeats(h.feats, h.name);
for (const f of data.feats) f.feats = linkFeats(f.feats, f.name);
for (const c of data.classes) {
  for (const f of c.features) {
    f.feats = linkFeats(f.feats, `${c.name}: ${f.name}`);
    for (const o of f.choice?.options ?? []) {
      o.feats = linkFeats(o.feats, `${c.name}: ${o.name}`);
      o.grantedSpells = linkSpells(o.grantedSpells, `${c.name}: ${o.name}`);
    }
  }
}

// IDs must be unique within each list, or a saved choice could point at the wrong thing.
const idLists = {
  ...Object.fromEntries(['ancestries', 'heritages', 'backgrounds', 'classes', 'feats', 'deities', 'spells', 'weapons', 'armor', 'shields'].map((k) => [k, data[k]])),
  subclassOptions: CORRECTABLE.subclassOptions.list(),
};
for (const [kind, list] of Object.entries(idLists)) {
  const seen = new Map();
  for (const x of list) {
    if (!x.id) throw new Error(`${kind}: "${x.name}" has no id`);
    if (seen.has(x.id)) throw new Error(`${kind}: "${x.name}" and "${seen.get(x.id)}" share id ${x.id}`);
    seen.set(x.id, x.name);
  }
}

// ---------- Report: things that look like they need a correction ----------

const plain = (html = '') => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
for (const c of data.classes) {
  if (c.spellcasting && !c.casting) needsReview.push(`${c.name} (${c.source}): spellcasting class with no "casting" correction`);
}
for (const c of data.classes) {
  for (const o of CORRECTABLE.subclassOptions.list().filter((x) => c.features.some((f) => f.choice?.options.includes(x)))) {
    const text = plain(o.description);
    const where = `${c.name}: ${o.name} (${o.source})`;
    if (/You're trained in [^.]*armor/.test(text) && !Object.keys(o.proficiencies).some((k) => k.startsWith('defenses.'))) {
      needsReview.push(`${where}: text grants armor training the data doesn't`);
    }
    if (/you have expert proficiency in/i.test(text) && !Object.values(o.proficiencies).includes('expert')) {
      needsReview.push(`${where}: text grants expert proficiency the data doesn't`);
    }
    if (/You can choose \w+ as your key attribute/.test(text) && !o.keyAbility) {
      needsReview.push(`${where}: text allows another key attribute`);
    }
  }
}
const ancestrySlugs = new Set(data.ancestries.map((a) => a.slug));
for (const h of data.heritages) {
  const other = /choose from \w+ and (\w+) feats/.exec(plain(h.description))?.[1];
  if (other && ancestrySlugs.has(other) && !h.featAncestries.includes(other)) {
    needsReview.push(`${h.name} (${h.source}): text allows ${other} feats`);
  }
}
data.meta.needsReview = needsReview;
// A fingerprint of the rules content: the same data always gets the same version,
// and any change gets a new one. Saved characters record it (see reviewCharacter).
const { meta, ...content } = data;
meta.version = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(data, null, 1)}\n`);
await writeFile(VERSION_OUT, `${JSON.stringify({ version: meta.version, books: meta.books }, null, 1)}\n`);

const counts = Object.entries(data).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`);
console.log(`Wrote ${OUT}\n  ${counts.join(', ')}`);
if (needsReview.length) {
  console.log(`\nImport report: ${needsReview.length} thing(s) need a look (add corrections, see corrections/README.md):`);
  for (const line of needsReview) console.log(`  - ${line}`);
} else {
  console.log('\nImport report: nothing needs a correction.');
}
