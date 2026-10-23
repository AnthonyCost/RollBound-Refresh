// Level 1 character building (Player Core ch. 1). Pure functions over a
// "build" (the player's choices) and the imported data in data/pf2e-level1.json.

export const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
export const STARTING_GOLD_CP = 1500;

// These versatile heritages can also take feats from the matching ancestry.
const VERSATILE_FEAT_ANCESTRY = { aiuvarin: 'elf', dromaar: 'orc' };

const FIST = {
  name: 'Fist',
  category: 'unarmed',
  die: 4,
  damageType: 'bludgeoning',
  traits: ['agile', 'finesse', 'nonlethal', 'unarmed'],
  ranged: false,
};

export function emptyBuild() {
  return {
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
    freeBoosts: [],
    skills: [],
    languages: [],
    ancestryFeat: null,
    classFeat: null,
    armor: null,
    shield: null,
    weapons: [],
  };
}

const find = (list, slug) => (slug ? list.find((x) => x.slug === slug) ?? null : null);

export function lookup(build, data) {
  return {
    ancestry: find(data.ancestries, build.ancestry),
    heritage: find(data.heritages, build.heritage),
    background: find(data.backgrounds, build.background),
    cls: find(data.classes, build.class),
  };
}

// ---------- Attributes ----------

export function ancestryBoostSlots(ancestry, alternate) {
  if (!ancestry) return [];
  return alternate ? [ABILITIES, ABILITIES] : ancestry.boosts;
}

export function ancestryFlaws(ancestry, alternate) {
  return ancestry && !alternate ? ancestry.flaws : [];
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
    const slot = cls.keyAbility;
    sources.push({
      id: 'class',
      label: `${cls.name} key attribute`,
      slots: [slot],
      boosts: [slot.length === 1 ? slot[0] : build.keyAbility],
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

export function keyAbilityOf(build, data) {
  const { cls } = lookup(build, data);
  if (!cls) return null;
  return cls.keyAbility.length === 1 ? cls.keyAbility[0] : build.keyAbility;
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
  const { heritage, background, cls } = lookup(build, data);
  const grants = [];
  for (const s of background?.skills ?? []) grants.push({ skill: s, from: background.name });
  for (const s of cls?.trainedSkills ?? []) grants.push({ skill: s, from: cls.name });
  if (cls?.skillChoice && build.classSkill) grants.push({ skill: build.classSkill, from: cls.name });
  if (heritage?.skillChoice && build.heritageSkill) grants.push({ skill: build.heritageSkill, from: heritage.name });
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

// ---------- Feats ----------

export function ancestryFeatOptions(build, data) {
  const { ancestry, heritage } = lookup(build, data);
  if (!ancestry) return [];
  const traits = new Set(ancestry.traits.filter((t) => t !== 'humanoid'));
  for (const t of heritage?.traits ?? []) {
    traits.add(t);
    if (VERSATILE_FEAT_ANCESTRY[t]) traits.add(VERSATILE_FEAT_ANCESTRY[t]);
  }
  return data.feats.filter((f) => f.category === 'ancestry' && f.level === 1 && f.traits.some((t) => traits.has(t)));
}

export function classFeatOptions(build, data) {
  const { cls } = lookup(build, data);
  if (!cls?.classFeatAt1) return [];
  return data.feats.filter((f) => f.category === 'class' && f.level === 1 && f.traits.includes(cls.slug));
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

// ---------- Validation ----------

export const STEPS = ['ancestry', 'background', 'class', 'attributes', 'skills', 'feats', 'gear', 'review'];

/** What's still missing or invalid, as [{ step, message }]. Empty means ready to save. */
export function buildProblems(build, data) {
  const problems = [];
  const add = (step, message) => problems.push({ step, message });
  const { ancestry, heritage, background, cls } = lookup(build, data);

  if (!ancestry) add('ancestry', 'Choose an ancestry.');
  if (!heritage) add('ancestry', 'Choose a heritage.');
  else if (heritage.skillChoice && !build.heritageSkill) add('ancestry', `Choose the skill from ${heritage.name}.`);
  if (!background) add('background', 'Choose a background.');
  else if (background.lore.length && !build.lore.trim()) add('background', 'Choose your Lore skill.');
  if (!cls) add('class', 'Choose a class.');
  else {
    if (cls.keyAbility.length > 1 && !build.keyAbility) add('class', 'Choose your key attribute.');
    if (cls.skillChoice && !build.classSkill) add('class', `Choose your ${cls.name} skill.`);
    for (const f of cls.features) {
      if (f.choice && !build.classChoices[f.choice.key]) add('class', `Choose your ${f.name.toLowerCase()}.`);
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

  if (gearCost(build, data) > STARTING_GOLD_CP) add('gear', 'Your gear costs more than your 15 gp.');

  if (!build.name.trim()) add('review', 'Name your character.');
  return problems;
}

// ---------- Output ----------

function toWeapon(w) {
  return {
    name: w.name,
    category: w.category,
    die: w.die,
    damageType: w.damageType,
    traits: w.traits,
    ranged: w.range != null,
    ...(w.range != null && { range: w.range }),
  };
}

/** The character object the sheet, turn, and roll screens read. Assumes buildProblems() is empty. */
export function buildCharacter(build, data) {
  const { ancestry, heritage, background, cls } = lookup(build, data);
  const { mods } = attributes(build, data);
  const picks = skillPicks(build, data);

  const skills = {};
  for (const s of [...picks.fixed, ...build.skills]) skills[s] = 'trained';

  const feats = [];
  const addFeat = (slug, from) => {
    const f = find(data.feats, slug);
    if (f) feats.push({ slug: f.slug, name: f.name, category: f.category, from });
  };
  addFeat(build.ancestryFeat, 'ancestry');
  addFeat(build.classFeat, 'class');
  for (const slug of background.feats) addFeat(slug, 'background');

  const armor = find(data.armor, build.armor);
  const shield = find(data.shields, build.shield);
  const weapons = build.weapons.map((w) => find(data.weapons, w)).filter(Boolean).map(toWeapon);

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
    proficiencies: {
      perception: cls.perception,
      ...cls.saves,
      classDc: 'trained',
      armor: { ...cls.defenses },
      weapons: { ...cls.attacks },
    },
    skills,
    lores: build.lore.trim() ? [build.lore.trim()] : [],
    languages: [...languagePicks(build, data).granted, ...build.languages],
    classFeatures: cls.features.map((f) => ({
      name: f.name,
      ...(f.choice && { choice: find(f.choice.options, build.classChoices[f.choice.key])?.name }),
    })),
    feats,
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
  };
}
