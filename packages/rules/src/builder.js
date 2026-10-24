// Level 1 character building (Player Core ch. 1). Pure functions over a
// "build" (the player's choices) and the imported rules data (see data.js).
// Builds refer to rules items by their Foundry ID, which stays the same across
// imports and renames. Book-specific rules come from the data (corrections/), so
// nothing here is special-cased by name.

import { RANKS } from './proficiency.js';

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const STARTING_GOLD_CP = 1500;
export const TRADITIONS = ['arcane', 'divine', 'occult', 'primal'];

const RECALL_KNOWLEDGE_SKILLS = ['arcana', 'crafting', 'medicine', 'nature', 'occultism', 'religion', 'society'];

/** Bumped when the shape of a build changes; migrateBuild() upgrades older ones. */
export const BUILD_VERSION = 2;

const FIST = {
  slug: 'fist',
  name: 'Fist',
  category: 'unarmed',
  die: 4,
  damageType: 'bludgeoning',
  traits: ['agile', 'finesse', 'nonlethal', 'unarmed'],
  ranged: false,
};

export function emptyBuild() {
  return {
    v: BUILD_VERSION,
    name: '',
    ancestry: null,
    heritage: null,
    heritageSkill: null,
    altAncestryBoosts: false,
    ancestryBoosts: [],
    background: null,
    backgroundBoosts: [],
    lore: '',
    class: null,
    keyAbility: null,
    classSkill: null,
    classChoices: {},
    classChoiceSkills: {},
    tradition: null,
    deity: null,
    font: null,
    sanctification: null,
    freeBoosts: [],
    skills: [],
    languages: [],
    ancestryFeat: null,
    classFeat: null,
    bonusFeats: {},
    cantrips: [],
    spells: [],
    armor: null,
    shield: null,
    weapons: [],
  };
}

const find = (list, id) => (id ? list.find((x) => x.id === id) ?? null : null);
const rankIndex = (r) => RANKS.indexOf(r);
const best = (a, b) => (rankIndex(b) > rankIndex(a) ? b : a);

export function lookup(build, data) {
  return {
    ancestry: find(data.ancestries, build.ancestry),
    heritage: find(data.heritages, build.heritage),
    background: find(data.backgrounds, build.background),
    cls: find(data.classes, build.class),
    deity: find(data.deities, build.deity),
  };
}

/** The subclass options chosen so far, e.g. [{ feature: 'Rogue's Racket', key, option }]. */
export function chosenOptions(build, data) {
  const { cls } = lookup(build, data);
  return (cls?.features ?? [])
    .filter((f) => f.choice)
    .map((f) => ({ feature: f.name, key: f.choice.key, option: find(f.choice.options, build.classChoices[f.choice.key]) }))
    .filter((c) => c.option);
}

// ---------- Deity ----------

export function sanctificationOptions(deity) {
  if (!deity?.sanctification) return ['none'];
  if (deity.sanctification.modal === 'must') return deity.sanctification.what;
  return [...deity.sanctification.what, 'none'];
}

export function sanctificationOf(build, data) {
  const { deity } = lookup(build, data);
  const options = sanctificationOptions(deity);
  return options.length === 1 ? options[0] : build.sanctification;
}

export function fontOf(build, data) {
  const { deity } = lookup(build, data);
  if (!deity) return null;
  return deity.font.length === 1 ? deity.font[0] : build.font;
}

// ---------- Attributes ----------

export function ancestryBoostSlots(ancestry, alternate) {
  if (!ancestry) return [];
  return alternate ? [ABILITIES, ABILITIES] : ancestry.boosts;
}

export function ancestryFlaws(ancestry, alternate) {
  return ancestry && !alternate ? ancestry.flaws : [];
}

export function keyAbilityOptions(build, data) {
  const { cls } = lookup(build, data);
  if (!cls) return [];
  const extra = chosenOptions(build, data).map((c) => c.option.keyAbility).filter(Boolean);
  return [...new Set([...cls.keyAbility, ...extra])];
}

export function keyAbilityOf(build, data) {
  const options = keyAbilityOptions(build, data);
  if (options.length === 1) return options[0];
  return options.includes(build.keyAbility) ? build.keyAbility : null;
}

/** Every boost and flaw, grouped by where it came from, plus the resulting modifiers. */
export function attributes(build, data) {
  const { ancestry, background, cls } = lookup(build, data);
  const sources = [];

  if (ancestry) {
    const slots = ancestryBoostSlots(ancestry, build.altAncestryBoosts);
    sources.push({
      id: 'ancestry',
      label: ancestry.name,
      slots,
      boosts: slots.map((s, i) => (s.length === 1 ? s[0] : build.ancestryBoosts[i] ?? null)),
      flaws: ancestryFlaws(ancestry, build.altAncestryBoosts),
    });
  }
  if (background) {
    sources.push({
      id: 'background',
      label: background.name,
      slots: background.boosts,
      boosts: background.boosts.map((s, i) => (s.length === 1 ? s[0] : build.backgroundBoosts[i] ?? null)),
      flaws: [],
    });
  }
  if (cls) {
    sources.push({
      id: 'class',
      label: `${cls.name} key attribute`,
      slots: [keyAbilityOptions(build, data)],
      boosts: [keyAbilityOf(build, data)],
      flaws: [],
    });
  }
  sources.push({
    id: 'free',
    label: 'Four free boosts',
    slots: [ABILITIES, ABILITIES, ABILITIES, ABILITIES],
    boosts: [0, 1, 2, 3].map((i) => build.freeBoosts[i] ?? null),
    flaws: [],
  });

  const mods = Object.fromEntries(ABILITIES.map((a) => [a, 0]));
  for (const s of sources) {
    for (const b of s.boosts) if (b) mods[b] += 1;
    for (const f of s.flaws) mods[f] -= 1;
  }
  return { sources, mods };
}

// ---------- Feats ----------

function featPool(data, { category, traits = [], level = 1 }) {
  return data.feats.filter(
    (f) => f.level <= level && (!category || f.category === category) && traits.every((t) => f.traits.includes(t)),
  );
}

export function ancestryFeatOptions(build, data) {
  const { ancestry, heritage } = lookup(build, data);
  if (!ancestry) return [];
  const traits = new Set(ancestry.traits.filter((t) => t !== 'humanoid'));
  for (const t of heritage?.traits ?? []) traits.add(t);
  // Some versatile heritages also open another ancestry's feats (e.g. aiuvarin: elf).
  for (const a of heritage?.featAncestries ?? []) traits.add(a);
  return data.feats.filter((f) => f.category === 'ancestry' && f.level === 1 && f.traits.some((t) => traits.has(t)));
}

export function classFeatOptions(build, data) {
  const { cls } = lookup(build, data);
  if (!cls?.classFeatAt1) return [];
  return featPool(data, { category: 'class', traits: [cls.slug] });
}

/** Named conditions a correction can attach to a granted feat. */
const GRANT_CONDITIONS = {
  // "If your deity's favored weapon is a simple weapon or an unarmed attack" (Warpriest's Deadly Simplicity).
  'deity-favored-weapon-simple': (build, data) =>
    Boolean(lookup(build, data).deity?.weapons.some((w) => w === 'fist' || ['simple', 'unarmed'].includes(data.weapons.find((x) => x.slug === w)?.category))),
};

function grantConditionHolds(condition, build, data) {
  const check = GRANT_CONDITIONS[condition];
  if (!check) throw new Error(`Unknown grant condition "${condition}" in the rules data`);
  return check(build, data);
}

/** Feats you get automatically, with where they came from. */
function fixedFeatGrants(build, data) {
  const { heritage, background, cls } = lookup(build, data);
  const grants = [];
  for (const id of background?.feats ?? []) grants.push({ id, from: background.name });
  for (const id of heritage?.feats ?? []) grants.push({ id, from: heritage.name });
  for (const f of cls?.features ?? []) for (const id of f.feats) grants.push({ id, from: f.name });
  for (const { option } of chosenOptions(build, data)) for (const id of option.feats) grants.push({ id, from: option.name });

  // Some grants only apply under a condition (corrections: feats.<slug>.grantedOnlyIf).
  return grants.filter((g) => {
    const condition = find(data.feats, g.id)?.grantedOnlyIf;
    return !condition || grantConditionHolds(condition, build, data);
  });
}

/**
 * Every feat the character has: chosen, granted, and bonus picks from feats like
 * General Training. Also returns the open bonus slots ("Natural Ambition: pick a
 * 1st-level class feat") so the builder can ask for them.
 */
export function featSummary(build, data) {
  const { cls } = lookup(build, data);
  const owned = [];
  const slots = [];
  const seen = new Set();

  const add = (id, from, kind) => {
    const feat = find(data.feats, id);
    if (!feat || seen.has(id)) return;
    seen.add(id);
    owned.push({ feat, from, kind });
    for (const granted of feat.feats) add(granted, feat.name, 'granted');
    if (feat.grantChoice) {
      const g = feat.grantChoice;
      const options = featPool(data, { category: g.category, traits: [...g.traits, ...(g.classTrait && cls ? [cls.slug] : [])], level: g.level });
      slots.push({ parent: feat, options, chosen: build.bonusFeats[feat.id] ?? null });
      if (build.bonusFeats[feat.id]) add(build.bonusFeats[feat.id], feat.name, 'bonus');
    }
  };

  if (build.ancestryFeat) add(build.ancestryFeat, 'Ancestry feat', 'chosen');
  if (build.classFeat) add(build.classFeat, 'Class feat', 'chosen');
  for (const g of fixedFeatGrants(build, data)) add(g.id, g.from, 'granted');
  return { owned, slots };
}

// ---------- Skills and languages ----------

/** Lore options from a background entry like "<Legal or Warfare> Lore". */
export function loreOptions(entry) {
  const either = /^<([^>]+) or ([^>]+)> Lore$/.exec(entry);
  if (either) return { options: [`${either[1]} Lore`, `${either[2]} Lore`] };
  const placeholder = /<([^>]+)>/.exec(entry);
  if (placeholder) return { placeholder: entry.replace(/[<>]/g, '') };
  return { fixed: /lore/i.test(entry) ? entry : `${entry} Lore` };
}

/** Skills granted automatically, in the order the rules grant them. */
export function grantedSkills(build, data) {
  const { heritage, background, cls, deity } = lookup(build, data);
  const grants = [];
  const add = (skill, from) => skill && grants.push({ skill, from });
  for (const s of background?.skills ?? []) add(s, background.name);
  for (const s of cls?.trainedSkills ?? []) add(s, cls.name);
  if (cls?.skillChoice) add(build.classSkill, cls.name);
  for (const { key, option } of chosenOptions(build, data)) {
    for (const s of option.skills) add(s, option.name);
    if (option.skillChoice) add(build.classChoiceSkills[key], option.name);
  }
  if (cls?.deity && deity) add(deity.skills[0], deity.name);
  for (const s of heritage?.skills ?? []) add(s, heritage.name);
  if (heritage?.skillChoice) add(build.heritageSkill, heritage.name);
  for (const { feat } of featSummary(build, data).owned) for (const s of feat.skills) add(s, feat.name);
  return grants;
}

/**
 * How many skills the player picks: the class's count plus Intelligence, plus one
 * for each automatic grant that duplicated a skill you already had.
 */
export function skillPicks(build, data) {
  const { cls } = lookup(build, data);
  const grants = grantedSkills(build, data);
  const fixed = new Set();
  let overlaps = 0;
  for (const g of grants) {
    if (fixed.has(g.skill)) overlaps += 1;
    fixed.add(g.skill);
  }
  const int = Math.max(0, attributes(build, data).mods.int);
  const fromClass = cls?.additionalSkills ?? 0;
  return { fixed, grants, fromClass, fromInt: int, overlaps, total: fromClass + int + overlaps };
}

export function trainedSkills(build, data) {
  const { fixed } = skillPicks(build, data);
  return new Set([...fixed, ...build.skills]);
}

export function languagePicks(build, data) {
  const { ancestry } = lookup(build, data);
  if (!ancestry) return { granted: [], options: [], total: 0 };
  const granted = ancestry.languages;
  const pool = ancestry.additionalLanguages.options.length ? ancestry.additionalLanguages.options : data.languages;
  const int = Math.max(0, attributes(build, data).mods.int);
  return {
    granted,
    options: pool.filter((l) => !granted.includes(l)),
    total: ancestry.additionalLanguages.count + int,
  };
}

// ---------- Prerequisites ----------

const ATTRIBUTE_NAMES = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const SUBCLASS_WORDS = /^(.+?) (muse|cause|order|instinct|racket|methodology|style|bloodline|patron|mystery|school|doctrine)$/i;

/**
 * Checks one prerequisite line against the build. Returns true or false when the
 * builder can tell, or null when it's something to confirm yourself.
 */
export function checkPrerequisite(text, build, data) {
  const t = text.trim().toLowerCase();
  const { ancestry, heritage, cls, deity } = lookup(build, data);
  const skills = trainedSkills(build, data);
  const lores = build.lore ? [build.lore.toLowerCase()] : [];
  const feats = featSummary(build, data).owned;
  const options = chosenOptions(build, data).map((c) => c.option.name.toLowerCase());

  let m = /^trained in (.+)$/.exec(t);
  if (m) {
    if (m[1] === 'at least one skill') return skills.size > 0;
    if (m[1] === 'lore') return lores.length > 0;
    if (m[1] === 'a skill with the recall knowledge action') return lores.length > 0 || RECALL_KNOWLEDGE_SKILLS.some((s) => skills.has(s));
    const parts = m[1].split(/,\s*(?:or\s+)?|\s+or\s+/).map((p) => p.trim()).filter(Boolean);
    return parts.some((p) => skills.has(p) || lores.includes(p));
  }

  // Every skill a 1st-level build gets is trained, so higher ranks can't be met yet.
  if (/^(expert|master|legendary) in /.test(t)) return false;
  if (t === 'follower of a specific religion' && deity) return true;

  m = /^(strength|dexterity|constitution|intelligence|wisdom|charisma) \+(\d)$/.exec(t);
  if (m) return attributes(build, data).mods[ATTRIBUTE_NAMES[m[1]]] >= Number(m[2]);

  m = SUBCLASS_WORDS.exec(t);
  if (m) return options.some((o) => o === t || o === m[1] || o === `${m[2]}: ${m[1]}`);

  if (t === 'healing font') return fontOf(build, data) === 'heal';
  if (t === 'harmful font') return fontOf(build, data) === 'harm';
  if (t === 'holy or unholy trait') return ['holy', 'unholy'].includes(sanctificationOf(build, data));
  if (t === 'spellcasting class feature') return Boolean(cls?.casting && cls.casting.kind !== 'focus');
  if (t === 'low-light vision') {
    return ['low-light-vision', 'darkvision'].includes(ancestry?.vision) || (heritage?.senses ?? []).length > 0;
  }
  if (t === 'deity with a simple or unarmed attack favored weapon') {
    return Boolean(deity?.weapons.some((w) => ['simple', 'unarmed'].includes(find(data.weapons, w)?.category ?? (w === 'fist' ? 'unarmed' : null))));
  }
  if (t === "trained with your deity's favored weapon") return Boolean(deity && cls?.deityFavoredWeapon);

  m = /^(.+) heritage$/.exec(t);
  if (m) return heritage?.name.toLowerCase() === m[1] || false;

  if (feats.some(({ feat }) => feat.name.toLowerCase() === t)) return true;
  if (cls?.features.some((f) => f.name.toLowerCase() === t)) return true;
  if (data.feats.some((f) => f.name.toLowerCase() === t)) return false;
  if (data.classes.some((c) => c.features.some((f) => f.name.toLowerCase() === t))) return false;
  return null;
}

/** { met: false, failed: [...], unknown: [...] } for a feat's prerequisites. */
export function featPrerequisites(feat, build, data) {
  const failed = [];
  const unknown = [];
  for (const p of feat.prerequisites) {
    const ok = checkPrerequisite(p, build, data);
    if (ok === false) failed.push(p);
    if (ok === null) unknown.push(p);
  }
  return { met: failed.length === 0, failed, unknown };
}

// ---------- Spells ----------

export function spellcastingOf(build, data) {
  const { cls } = lookup(build, data);
  const base = cls?.casting;
  if (!base) return null;
  const option = chosenOptions(build, data).find((c) => c.option.tradition || c.option.traditionChoice)?.option;
  const tradition = option?.traditionChoice ? build.tradition : base.tradition ?? option?.tradition ?? null;
  const granted = (option?.grantedSpells ?? []).map((s) => find(data.spells, s)).filter(Boolean);
  return { ...base, tradition, traditionChoice: Boolean(option?.traditionChoice), granted };
}

export function spellOptions(build, data) {
  const casting = spellcastingOf(build, data);
  if (!casting?.tradition) return { cantrips: [], spells: [] };
  const pool = data.spells.filter((s) => s.rarity === 'common' && s.traditions.includes(casting.tradition));
  const granted = new Set(casting.granted.map((s) => s.id));
  return {
    cantrips: pool.filter((s) => s.rank === 0 && !granted.has(s.id)),
    spells: pool.filter((s) => s.rank === 1 && !granted.has(s.id)),
  };
}

// ---------- Gear ----------

export function gearCost(build, data) {
  const armor = find(data.armor, build.armor);
  const shield = find(data.shields, build.shield);
  const weapons = build.weapons.map((w) => find(data.weapons, w)).filter(Boolean);
  return (armor?.price ?? 0) + (shield?.price ?? 0) + weapons.reduce((t, w) => t + w.price, 0);
}

export function formatPrice(cp) {
  const gp = Math.floor(cp / 100);
  const sp = Math.floor((cp % 100) / 10);
  const c = cp % 10;
  return [gp && `${gp} gp`, sp && `${sp} sp`, c && `${c} cp`].filter(Boolean).join(' ') || '0 gp';
}

// ---------- Proficiencies ----------

export function proficienciesOf(build, data) {
  const { cls, deity } = lookup(build, data);
  const p = {
    perception: cls.perception,
    ...cls.saves,
    classDc: 'trained',
    armor: { ...cls.defenses },
    weapons: { ...cls.attacks },
  };
  for (const { option } of chosenOptions(build, data)) {
    for (const [path, rank] of Object.entries(option.proficiencies)) {
      const [group, key] = path.split('.');
      if (group === 'defenses') p.armor[key] = best(p.armor[key], rank);
      else if (group === 'attacks') p.weapons[key] = best(p.weapons[key], rank);
      else if (group === 'saves') p[key] = best(p[key], rank);
      else if (group === 'perception') p.perception = best(p.perception, rank);
    }
  }
  if (spellcastingOf(build, data)) p.spellcasting = 'trained';
  // Some classes (cleric) are trained with their deity's favored weapon.
  if (cls.deityFavoredWeapon && deity) {
    p.favoredWeapons = deity.weapons;
    p.favoredWeaponRank = cls.deityFavoredWeapon;
  }
  return p;
}

// ---------- Validation ----------

export const STEPS = ['ancestry', 'background', 'class', 'attributes', 'skills', 'feats', 'spells', 'gear', 'review'];

/** What's still missing or invalid, as [{ step, message }]. Empty means ready to save. */
export function buildProblems(build, data) {
  const problems = [];
  const add = (step, message) => problems.push({ step, message });
  const { ancestry, heritage, background, cls, deity } = lookup(build, data);

  if (!ancestry) add('ancestry', 'Choose an ancestry.');
  if (!heritage) add('ancestry', 'Choose a heritage.');
  else if (heritage.ancestry && heritage.ancestry !== build.ancestry) add('ancestry', `${heritage.name} isn't a ${ancestry?.name ?? 'matching'} heritage.`);
  else if (heritage.skillChoice && !build.heritageSkill) add('ancestry', `Choose the skill from ${heritage.name}.`);
  if (!background) add('background', 'Choose a background.');
  else if (background.lore.length && !build.lore.trim()) add('background', 'Choose your Lore skill.');

  if (!cls) add('class', 'Choose a class.');
  else {
    if (!keyAbilityOf(build, data)) add('class', 'Choose your key attribute.');
    if (cls.skillChoice && !build.classSkill) add('class', `Choose your ${cls.name} skill.`);
    for (const f of cls.features) {
      if (!f.choice) continue;
      const option = find(f.choice.options, build.classChoices[f.choice.key]);
      if (!option) add('class', `Choose your ${f.name.toLowerCase()}.`);
      else {
        if (option.skillChoice && !build.classChoiceSkills[f.choice.key]) add('class', `Choose the skill from ${option.name}.`);
        if (option.traditionChoice && !build.tradition) add('class', `Choose your ${option.name} tradition.`);
      }
    }
    if (cls.deity) {
      if (!deity) add('class', 'Choose a deity.');
      else {
        if (!sanctificationOf(build, data)) add('class', `Choose whether you're holy, unholy, or neither.`);
        if (cls.divineFont && !fontOf(build, data)) add('class', 'Choose your divine font.');
        for (const { option } of chosenOptions(build, data)) {
          for (const need of ['holy', 'unholy']) {
            if (option.tags.includes(need) && sanctificationOf(build, data) !== need) {
              add('class', `The ${option.name} cause requires you to be ${need}${sanctificationOptions(deity).includes(need) ? '' : `, which ${deity.name} doesn't allow`}.`);
            }
          }
        }
      }
    }
  }

  for (const s of attributes(build, data).sources) {
    if (s.boosts.some((b) => !b)) add('attributes', `Finish your ${s.id === 'free' ? 'free boosts' : `${s.label} boosts`}.`);
    const chosen = s.boosts.filter(Boolean);
    if (new Set(chosen).size !== chosen.length) add('attributes', `${s.label}: you can't boost the same attribute twice from one source.`);
  }

  const picks = skillPicks(build, data);
  const extra = build.skills.filter((s) => !picks.fixed.has(s));
  if (extra.length !== picks.total) add('skills', `Choose ${picks.total} skill${picks.total === 1 ? '' : 's'} (${extra.length} chosen).`);
  const langs = languagePicks(build, data);
  if (build.languages.length > langs.total) add('skills', `You can only learn ${langs.total} extra language${langs.total === 1 ? '' : 's'}.`);

  if (ancestry && !build.ancestryFeat) add('feats', 'Choose an ancestry feat.');
  if (cls?.classFeatAt1 && !build.classFeat) add('feats', 'Choose a class feat.');
  const { owned, slots } = featSummary(build, data);
  for (const slot of slots) if (!slot.chosen) add('feats', `Choose the feat from ${slot.parent.name}.`);
  for (const { feat, kind } of owned) {
    if (kind === 'granted') continue;
    const pre = featPrerequisites(feat, build, data);
    if (!pre.met) add('feats', `${feat.name} requires ${pre.failed.join('; ')}.`);
  }

  const casting = spellcastingOf(build, data);
  if (casting && casting.kind !== 'focus') {
    const unit = casting.kind === 'prepared' ? 'to prepare' : casting.kind === 'repertoire' ? 'for your repertoire' : `for your ${casting.kind}`;
    if (build.cantrips.length !== casting.cantrips) add('spells', `Choose ${casting.cantrips} cantrips ${unit} (${build.cantrips.length} chosen).`);
    if (build.spells.length !== casting.spells) add('spells', `Choose ${casting.spells} 1st-rank spells ${unit} (${build.spells.length} chosen).`);
  }

  if (gearCost(build, data) > STARTING_GOLD_CP) add('gear', 'Your gear costs more than your 15 gp.');

  if (!build.name.trim()) add('review', 'Name your character.');
  return problems;
}

// ---------- Output ----------

function toWeapon(w) {
  return {
    slug: w.slug,
    name: w.name,
    category: w.category,
    die: w.die,
    damageType: w.damageType,
    traits: w.traits,
    ranged: w.range != null,
    ...(w.range != null && { range: w.range }),
  };
}

const toSpell = (s) => ({ id: s.id, slug: s.slug, name: s.name, rank: s.rank, actions: s.actions, traits: s.traits, defense: s.defense, range: s.range });

/** The character object the sheet, turn, and roll screens read. Assumes buildProblems() is empty. */
export function buildCharacter(build, data) {
  const { ancestry, heritage, background, cls, deity } = lookup(build, data);
  const { mods } = attributes(build, data);

  const skills = {};
  for (const s of trainedSkills(build, data)) skills[s] = 'trained';

  const armor = find(data.armor, build.armor);
  const shield = find(data.shields, build.shield);
  const weapons = build.weapons.map((w) => find(data.weapons, w)).filter(Boolean).map(toWeapon);

  const casting = spellcastingOf(build, data);
  const options = chosenOptions(build, data);

  return {
    name: build.name.trim(),
    level: 1,
    ancestry: { slug: ancestry.slug, name: ancestry.name, hp: ancestry.hp, speed: ancestry.speed, size: ancestry.size, vision: ancestry.vision },
    heritage: heritage.name,
    background: background.name,
    className: cls.name,
    classSlug: cls.slug,
    classHp: cls.hp,
    keyAbility: keyAbilityOf(build, data),
    abilities: mods,
    proficiencies: proficienciesOf(build, data),
    skills,
    lores: build.lore.trim() ? [build.lore.trim()] : [],
    languages: [...languagePicks(build, data).granted, ...build.languages],
    classFeatures: cls.features.map((f) => ({
      name: f.name,
      ...(f.choice && { choice: options.find((o) => o.key === f.choice.key)?.option.name }),
    })),
    ...(cls.deity && deity && {
      deity: { name: deity.name, font: fontOf(build, data), sanctification: sanctificationOf(build, data), weapons: deity.weapons },
    }),
    feats: featSummary(build, data).owned.map(({ feat, from, kind }) => ({ id: feat.id, slug: feat.slug, name: feat.name, category: feat.category, from, kind })),
    ...(casting && {
      spellcasting: {
        kind: casting.kind,
        tradition: casting.tradition,
        ability: keyAbilityOf(build, data),
        slots: casting.slots,
        ...(casting.prepares && { prepares: casting.prepares }),
        cantrips: [...casting.granted.filter((s) => s.rank === 0), ...build.cantrips.map((s) => find(data.spells, s))].filter(Boolean).map(toSpell),
        spells: [...casting.granted.filter((s) => s.rank === 1), ...build.spells.map((s) => find(data.spells, s))].filter(Boolean).map(toSpell),
      },
    }),
    armor: armor && {
      name: armor.name,
      category: armor.category,
      acBonus: armor.acBonus,
      dexCap: armor.dexCap,
      strength: armor.strength,
      checkPenalty: armor.checkPenalty,
      speedPenalty: armor.speedPenalty,
      traits: armor.traits,
    },
    shield: shield && { name: shield.name, acBonus: shield.acBonus, hardness: shield.hardness, hp: shield.hp },
    weapons: weapons.length ? weapons : [FIST],
    heroPoints: 1,
    build,
    // Which rules data this sheet was computed from, and the names of the items
    // chosen, so a later re-import can name any that disappear (see reviewCharacter).
    dataVersion: data.meta?.version ?? null,
    choiceNames: Object.fromEntries(choiceRefs(build, data).map((r) => [r.id, r.item.name])),
  };
}

// ---------- Data updates ----------

/**
 * Every rules item a build points at, as { step, kind, id, item, clear }. item is
 * null when the ID isn't in this data; clear(build) returns the build without it.
 */
function choiceRefs(build, data) {
  const refs = [];
  const one = (step, kind, field, list) => {
    if (build[field]) refs.push({ step, kind, id: build[field], item: find(list, build[field]), clear: (b) => ({ ...b, [field]: null }) });
  };
  const many = (step, kind, field, list) => {
    for (const id of build[field] ?? []) {
      refs.push({ step, kind, id, item: find(list, id), clear: (b) => ({ ...b, [field]: b[field].filter((x) => x !== id) }) });
    }
  };
  one('ancestry', 'ancestry', 'ancestry', data.ancestries);
  one('ancestry', 'heritage', 'heritage', data.heritages);
  one('background', 'background', 'background', data.backgrounds);
  one('class', 'class', 'class', data.classes);
  const options = find(data.classes, build.class)?.features.flatMap((f) => f.choice?.options ?? []) ?? [];
  for (const [key, id] of Object.entries(build.classChoices ?? {})) {
    if (!id) continue;
    const clear = (b) => ({ ...b, classChoices: { ...b.classChoices, [key]: null }, classChoiceSkills: { ...b.classChoiceSkills, [key]: null } });
    refs.push({ step: 'class', kind: 'class option', id, item: find(options, id), clear });
  }
  one('class', 'deity', 'deity', data.deities);
  one('feats', 'feat', 'ancestryFeat', data.feats);
  one('feats', 'feat', 'classFeat', data.feats);
  for (const [parent, id] of Object.entries(build.bonusFeats ?? {})) {
    if (!id) continue;
    const clear = (b) => ({ ...b, bonusFeats: { ...b.bonusFeats, [parent]: null } });
    // A bonus pick whose granting feat is gone has nowhere to go, so it counts as gone too.
    refs.push({ step: 'feats', kind: 'feat', id, item: find(data.feats, parent) && find(data.feats, id), clear });
  }
  many('spells', 'cantrip', 'cantrips', data.spells);
  many('spells', 'spell', 'spells', data.spells);
  one('gear', 'armor', 'armor', data.armor);
  one('gear', 'shield', 'shield', data.shields);
  many('gear', 'weapon', 'weapons', data.weapons);
  return refs;
}

/** Choices whose rules item isn't in this data (e.g. removed by a re-import). */
export function missingChoices(build, data) {
  return choiceRefs(build, data)
    .filter((r) => !r.item)
    .map(({ step, kind, id }) => ({ step, kind, id }));
}

/** The build with every missing choice cleared, so the builder asks for it again. */
export function dropMissingChoices(build, data) {
  return choiceRefs(build, data)
    .filter((r) => !r.item)
    .reduce((b, r) => r.clear(b), build);
}

// Compares two sheets as stored JSON, ignoring key order (Postgres reorders keys)
// and the stamp fields, which change on every import.
const STAMP_FIELDS = ['dataVersion', 'choiceNames'];
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
};
const sameSheet = (a, b) => {
  const strip = (c) => JSON.stringify(canonical(Object.fromEntries(Object.entries(c).filter(([k]) => !STAMP_FIELDS.includes(k)))));
  return strip(JSON.parse(JSON.stringify(a))) === strip(b);
};

/**
 * Checks a saved character against the current rules data. status is:
 *   'current': built from this data, or has no build to check (nothing to do),
 *   'restamp': same sheet under the new data; `character` is it with the new stamp,
 *   'refresh': every choice still works but the numbers or text changed; `character` is the new sheet,
 *   'repick':  some choices are gone (`missing`, with their saved names) or no longer valid (`problems`).
 */
export function reviewCharacter(character, data) {
  const build = character?.build;
  const version = data.meta?.version ?? null;
  if (!build || (version && character.dataVersion === version)) return { status: 'current' };

  const current = migrateBuild(build, data);
  const named = (id) =>
    character.choiceNames?.[id] ??
    [...(character.feats ?? []), ...(character.spellcasting?.cantrips ?? []), ...(character.spellcasting?.spells ?? []), ...(character.weapons ?? [])].find((x) => x.id === id)?.name ??
    null;
  const missing = missingChoices(current, data).map((m) => ({ ...m, name: named(m.id) }));
  const problems = buildProblems(current, data);
  if (missing.length || problems.length) return { status: 'repick', missing, problems };

  const next = buildCharacter({ ...current, name: character.name ?? current.name }, data);
  return { status: sameSheet(next, character) ? 'restamp' : 'refresh', character: next };
}

// ---------- Migration ----------

/**
 * Upgrades a build saved by an older version. Version 1 builds referred to items
 * by slug; version 2 uses Foundry IDs. Values that are already IDs are kept, so
 * this is safe to run on any build.
 */
export function migrateBuild(build, data) {
  if (!build || build.v >= BUILD_VERSION) return build;
  const toId = (list, value) => {
    if (!value) return value ?? null;
    if (list.some((x) => x.id === value)) return value;
    return list.find((x) => x.slug === value)?.id ?? value;
  };
  const ids = (list, values) => (values ?? []).map((v) => toId(list, v));
  const out = { ...emptyBuild(), ...build, v: BUILD_VERSION };
  out.ancestry = toId(data.ancestries, build.ancestry);
  out.heritage = toId(data.heritages, build.heritage);
  out.background = toId(data.backgrounds, build.background);
  out.class = toId(data.classes, build.class);
  out.deity = toId(data.deities, build.deity);
  out.ancestryFeat = toId(data.feats, build.ancestryFeat);
  out.classFeat = toId(data.feats, build.classFeat);
  out.bonusFeats = Object.fromEntries(Object.entries(build.bonusFeats ?? {}).map(([k, v]) => [toId(data.feats, k), toId(data.feats, v)]));
  const options = data.classes.find((c) => c.id === out.class)?.features.flatMap((f) => f.choice?.options ?? []) ?? [];
  out.classChoices = Object.fromEntries(Object.entries(build.classChoices ?? {}).map(([k, v]) => [k, toId(options, v)]));
  out.cantrips = ids(data.spells, build.cantrips);
  out.spells = ids(data.spells, build.spells);
  out.armor = toId(data.armor, build.armor);
  out.shield = toId(data.shields, build.shield);
  out.weapons = ids(data.weapons, build.weapons);
  return out;
}
