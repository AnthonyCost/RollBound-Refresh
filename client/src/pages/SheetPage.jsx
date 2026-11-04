import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { armorClass, landSpeed, swimSpeed, savingThrow, perception, abilityName, skillCheck, SKILL_ABILITY, spellAttack, spellDc, classDc, strikeBonus, damageModifier, spellKey, describeCondition, proficiencyPart } from '@rollbound/rules';
import { loadRules } from '../state/rulesData.js';
import { useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import ShieldGauge from '../components/ShieldGauge.jsx';
import Portrait from '../components/Portrait.jsx';
import CharacterDrawer from '../components/CharacterDrawer.jsx';
import ExportSheetButton from '../components/ExportSheetButton.jsx';
import DetailsDrawer from '../components/DetailsDrawer.jsx';
import RollDrawer from '../components/RollDrawer.jsx';
import {
  ATTRIBUTES, KEY_ATTRIBUTE, DEFENSES, HIT_POINTS, SKILLS, LORE, UNTRAINED_NOTE, STRIKE, traitRule, traitLabel,
  SIZE_RULES, LEVEL_RULES, HERO_POINT_RULES, LANGUAGE_RULES, VISION_RULES, WEAPON_CATEGORY_RULES, WEAPON_PROFICIENCY_RULE, RUNE_RULES,
} from '../sheet/sheetRules.js';
import RulesUpdateNotice from '../components/RulesUpdateNotice.jsx';
import HpTracker from '../components/HpTracker.jsx';
import ShieldTracker from '../components/ShieldTracker.jsx';
import { sentenceCase, signed, slotsText, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';
import RankPips from '../components/RankPips.jsx';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
// Each header field's entry in the details drawer.
const HEADER_DETAIL = {
  Ancestry: 'origin:ancestry',
  Heritage: 'origin:heritage',
  Background: 'origin:background',
  Class: 'origin:class',
  Size: 'info:size',
  Level: 'info:level',
  'Hero Points': 'info:heroPoints',
};
const ORIGIN = {
  ancestry: { kind: 'Ancestry', type: 'ancestries', icon: 'user', name: (c) => c.ancestry?.name },
  heritage: { kind: 'Heritage', type: 'heritages', icon: 'heritage', name: (c) => c.heritage },
  background: { kind: 'Background', type: 'backgrounds', icon: 'background', name: (c) => c.background },
  class: { kind: 'Class', type: 'classes', icon: 'swords', name: (c) => c.className },
};
const listOf = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' || typeof x === 'number').map((x) => titleCase(String(x))).join(', ') : v);
const SIZE = { tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large' };
const SENSES = { darkvision: 'Darkvision', 'low-light-vision': 'Low-light vision' };
const WEAPON_CATEGORIES = ['unarmed', 'simple', 'martial', 'advanced'];
// The rules text the drawer quotes: spells, the character's origins and runes.
const DETAIL_TYPES = ['spells', 'ancestries', 'heritages', 'backgrounds', 'classes', 'runes'];

/** The rules text the drawer quotes, loaded the first time it's needed (when a spell, origin or rune is tapped). */
function useDetailRules(needed) {
  const [data, setData] = useState(null);
  const [wanted, setWanted] = useState(false);
  if (needed && !wanted) setWanted(true);
  useEffect(() => {
    if (!wanted) return undefined;
    let cancelled = false;
    loadRules({ types: DETAIL_TYPES }).then(
      (d) => !cancelled && setData(d),
      () => !cancelled && setData({ error: true }),
    );
    return () => {
      cancelled = true;
    };
  }, [wanted]);
  return data;
}

/**
 * A sheet entry that rolls: an invisible button covers the whole row or box and opens its
 * details, and the boxed modifier (RollButton) sits above it and rolls. Two real buttons,
 * so each has its own name for screen readers and its own focus stop.
 */
function OpenButton({ label, pressed, onClick }) {
  return (
    <button type="button" className="sheet-open" aria-pressed={pressed} onClick={onClick}>
      <span className="visually-hidden">{label} details</span>
    </button>
  );
}

/** A modifier you can roll, boxed like a die face: d20 + it, in the roll drawer. */
function RollButton({ label, stat, onRoll, className }) {
  return (
    <button type="button" className={`sheet-roll ${className}`} aria-label={`Roll ${label}: ${signed(stat.total)}`} title={`Roll ${label}`} onClick={() => onRoll(label, stat)}>
      {signed(stat.total)}
    </button>
  );
}

/**
 * The character sheet, laid out like page one of Paizo's sheet: the header, the
 * attributes, the defense band (AC, saves, HP, Perception, Speed), then skills on the
 * left and Strikes and DCs on the right. Tap any number and the details drawer shows how
 * it's worked out and the rules behind it.
 */
export default function SheetPage() {
  const { character, characterId, readOnly, portraitUrl, setPortraitUrl, campaign, currentHp, maxHp, setHp, hpError, conditions, shieldRaised, shield, prepared, rollCheck } = useTable();
  // What the details drawer shows: 'attr:str', 'def:ac', 'hp:', 'skill:athletics', 'strike:0', 'magic:classDc', 'spell:<id>'.
  const [open, setOpen] = useState(null);
  const spellRules = useDetailRules(/^(spell|origin|rune):/.test(open ?? ''));
  const toggle = (key) => {
    setRolling(false);
    setOpen((cur) => (cur === key ? null : key));
  };
  const close = useCallback(() => setOpen(null), []);
  // Tapping a modifier rolls it (d20 + the modifier) in the roll drawer, from the left; tapping its name opens its details.
  const [rolling, setRolling] = useState(false);
  const closeRoll = useCallback(() => setRolling(false), []);
  const roll = (label, stat, weapon = null) => {
    rollCheck(label, stat, weapon);
    setOpen(null);
    setRolling(true);
  };

  const opts = { conditions, shieldRaised };
  const p = character.proficiencies;
  const defenses = {
    ac: { stat: armorClass(character, opts), signed: false },
    fortitude: { stat: savingThrow(character, 'fortitude', opts) },
    reflex: { stat: savingThrow(character, 'reflex', opts) },
    will: { stat: savingThrow(character, 'will', opts) },
    perception: { stat: perception(character, opts) },
  };
  const senses = SENSES[character.ancestry.vision];
  const header = [
    ['Ancestry', character.ancestry.name],
    ['Heritage', character.heritage],
    ['Background', character.background],
    ['Class', character.className],
    ['Size', SIZE[character.ancestry.size] ?? character.ancestry.size],
    ['Level', character.level],
    ['Hero Points', character.heroPoints],
  ].filter(([, v]) => v != null && v !== '');

  // A plain function, not a component: a component defined here would remount (and lose focus) on every render.
  // AC isn't rolled; saves and Perception are: the box opens their details, the boxed modifier rolls.
  const defenseBox = ({ id, label, rank, extra }) => (defenses[id].signed === false ? (
    <button key={id} type="button" className={`sheet-def sheet-def--${id}`} aria-pressed={open === `def:${id}`} onClick={() => toggle(`def:${id}`)}>
      <span className="sheet-def__label">{label}</span>
      <span className="sheet-def__value">{defenses[id].stat.total}</span>
      <RankPips rank={rank} />
      {extra && <span className="sheet-def__extra">{extra}</span>}
    </button>
  ) : (
    <div key={id} className={`sheet-def sheet-def--${id} sheet-rollable ${open === `def:${id}` ? 'is-open' : ''}`}>
      <OpenButton label={label} pressed={open === `def:${id}`} onClick={() => toggle(`def:${id}`)} />
      <span className="sheet-def__label">{label}</span>
      <RollButton label={label} stat={defenses[id].stat} onRoll={roll} className="sheet-def__value" />
      <RankPips rank={rank} />
      {extra && <span className="sheet-def__extra">{extra}</span>}
    </div>
  ));

  return (
    <div className="sheet">
      {!readOnly && <RulesUpdateNotice />}

      <header className="sheet-panel sheet-head">
        {readOnly ? (
          <div className="hero__portrait">
            <Portrait url={portraitUrl} name={character.name} size="lg" />
          </div>
        ) : (
          <button
            type="button"
            className="hero__portrait"
            onClick={() => toggle('profile:')}
            aria-expanded={open === 'profile:'}
            aria-label={`${character.name}: name, portrait, PDF and share link`}
          >
            <Portrait url={portraitUrl} name={character.name} size="lg" />
            <span className="hero__portrait-hint">Edit</span>
          </button>
        )}
        <div className="sheet-head__body">
          <h1 className="sheet-head__name">{character.name}</h1>
          <dl className="sheet-head__fields">
            {header.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>
                  <button type="button" className="sheet-head__value" aria-pressed={open === HEADER_DETAIL[k]} onClick={() => toggle(HEADER_DETAIL[k])}>{v}</button>
                </dd>
              </div>
            ))}
          </dl>
          <CampaignLine campaign={campaign} readOnly={readOnly} />
        </div>
        {/* Hit points, top right: Heal, amount and Damage beside the orb (just the orb when read-only). */}
        <div className="sheet-hp">
          {!readOnly && <HpTracker />}
          {shield && <ShieldGauge shield={shield} raised={shieldRaised} pressed={open === 'def:shield'} onOpen={() => toggle('def:shield')} />}
          <HealthOrb current={currentHp} max={maxHp} onRestore={readOnly ? undefined : () => setHp(maxHp)} onOpen={() => toggle('hp:')} pressed={open === 'hp:'} />
          {hpError && <p className="rule-note rule-note--warn sheet-hp__error" role="alert">{hpError}</p>}
        </div>
      </header>

      {/* The player opens the PDF and share link from their portrait's drawer; viewers get the PDF here. */}
      {readOnly && (
        <div className="sheet__actions">
          <ExportSheetButton />
        </div>
      )}

      <section className="sheet-panel sheet-defense" aria-label="Defenses">
        {defenseBox({
          id: 'ac',
          label: 'Armor Class',
          rank: p.armor[character.armor?.category ?? 'unarmored'],
          extra: character.shield ? `${character.shield.name} +${character.shield.acBonus} raised` : (character.armor?.name ?? 'Unarmored'),
        })}
        <div className="sheet-def-group" role="group" aria-label="Saving throws">
          {defenseBox({ id: 'fortitude', label: 'Fortitude', rank: p.fortitude })}
          {defenseBox({ id: 'reflex', label: 'Reflex', rank: p.reflex })}
          {defenseBox({ id: 'will', label: 'Will', rank: p.will })}
        </div>
        {defenseBox({ id: 'perception', label: 'Perception', rank: p.perception, extra: senses })}
        {/* Class DC sits with the other numbers foes roll against, for casters and non-casters alike. */}
        {character.keyAbility && (
          <button type="button" className="sheet-def sheet-def--classdc" aria-pressed={open === 'magic:classDc'} onClick={() => toggle('magic:classDc')}>
            <span className="sheet-def__label">Class DC</span>
            <span className="sheet-def__value">{classDc(character).total}</span>
            <RankPips rank={p.classDc ?? 'trained'} />
          </button>
        )}
        <button type="button" className="sheet-def sheet-def--speed" aria-pressed={open === 'def:speed'} onClick={() => toggle('def:speed')}>
          <span className="sheet-def__label">Speed</span>
          <span className="sheet-def__value">
            {landSpeed(character).total}
            <small> ft</small>
          </span>
          {swimSpeed(character) && <span className="sheet-def__extra">Swim {swimSpeed(character)} ft</span>}
        </button>
      </section>

      <section className="sheet-attrs" aria-label="Attribute modifiers">
        {ABILITIES.map((a) => (
          <button key={a} type="button" className={`sheet-attr sheet-attr--button ${a === character.keyAbility ? 'sheet-attr--key' : ''}`} aria-pressed={open === `attr:${a}`} onClick={() => toggle(`attr:${a}`)}>
            <span className="sheet-attr__short">
              {a.toUpperCase()}
              {a === character.keyAbility && <span className="ledger__crown" title="Key attribute"> ♛<span className="visually-hidden"> (key attribute)</span></span>}
            </span>
            <span className="sheet-attr__value">{signed(character.abilities[a])}</span>
            <span className="sheet-attr__name">{abilityName(a)}</span>
          </button>
        ))}
      </section>

      <div className="sheet__columns">
        <div className="sheet__col">
          <section className="sheet-panel" aria-labelledby="skills-title">
            <h2 id="skills-title" className="sheet-panel__title">Skills</h2>
            <ul className="sheet-skills">
              {[...Object.keys(SKILL_ABILITY), ...(character.lores ?? [])].map((name) => {
                const check = skillCheck(character, name, opts);
                return (
                  <li key={name}>
                    <div className={`sheet-skill sheet-rollable ${open === `skill:${name}` ? 'is-open' : ''}`}>
                      <OpenButton label={titleCase(name)} pressed={open === `skill:${name}`} onClick={() => toggle(`skill:${name}`)} />
                      <span className="sheet-skill__name">{titleCase(name)}</span>
                      <span className="sheet-skill__attr">{check.ability.toUpperCase()}</span>
                      <RankPips rank={check.rank} />
                      <RollButton label={titleCase(name)} stat={check} onRoll={roll} className="sheet-skill__total" />
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="sheet-langs" aria-pressed={open === 'info:languages'} onClick={() => toggle('info:languages')}>
              <span className="sheet-panel__label">Languages</span>
              <span className="sheet-langs__list">{(character.languages ?? []).map(titleCase).join(', ') || 'Common'}</span>
            </button>
          </section>
        </div>

        <div className="sheet__col">
          <Strikes character={character} opts={opts} readOnly={readOnly} selected={open} onSelect={toggle} onRoll={roll} />
          {character.keyAbility && <MagicAndDcs character={character} opts={opts} selected={open} onSelect={toggle} onRoll={roll} />}
        </div>
      </div>

      {!readOnly && <CharacterDrawer open={open === 'profile:'} onClose={close} />}

      <RollDrawer open={rolling} onClose={closeRoll} />
      <DetailsDrawer detail={open ? describe(open, character, opts, { shield, currentHp, maxHp, prepared, spellRules, readOnly }) : null} onClose={close} />
    </div>
  );
}

/** Everything the details drawer needs for one tapped number (see DetailsDrawer for the shape). */
function describe(key, character, opts, { shield, currentHp, maxHp, prepared, spellRules, readOnly = true } = {}) {
  const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
  const p = character.proficiencies;

  if (kind === 'hp') {
    const { ancestry, classHp, level, abilities } = character;
    const con = abilities.con;
    return {
      ...HIT_POINTS,
      value: `${currentHp}`,
      unit: `/ ${maxHp}`,
      stat: {
        total: maxHp,
        parts: [
          { label: `${ancestry.name} ancestry`, value: ancestry.hp },
          { label: `${character.className}, ${classHp} per level`, value: classHp * level },
          { label: `Constitution, ${signed(con)} per level`, value: con * level },
        ],
      },
      total: maxHp,
      totalLabel: 'Max HP',
      facts: [
        ['Damage taken', maxHp - currentHp],
        ['State', currentHp === 0 ? 'Down and dying' : currentHp === maxHp ? 'Unhurt' : 'Hurt'],
      ],
      sections: [
        {
          title: 'Conditions',
          items: (opts.conditions ?? []).map((c) => {
            const d = describeCondition(c);
            return [d.name, d.summary];
          }),
          empty: 'No conditions right now. Set them on the Turn tab during an encounter.',
        },
      ],
    };
  }

  if (kind === 'spell') {
    const casting = character.spellcasting;
    const known = [...(casting?.cantrips ?? []), ...(casting?.spells ?? []), ...(prepared ? [...prepared.cantrips, ...prepared.slots].filter(Boolean) : [])];
    const s = known.find((x) => spellKey(x) === id);
    if (!s) return null;
    const full = spellRules?.spells?.find((x) => x.id === s.id || x.slug === s.slug) ?? s;
    const attack = full.traits?.includes('attack');
    const dc = spellDc(character, opts).total;
    const atk = signed(spellAttack(character, opts).total);
    return {
      kind: s.rank === 0 ? 'Cantrip' : `Spell ${s.rank ?? ''}`.trim(),
      name: full.name,
      icon: 'spells',
      actions: full.actions,
      value: full.defense ? `${dc}` : attack ? atk : '',
      unit: full.defense ? 'DC' : attack ? 'to hit' : undefined,
      facts: [
        ['Range', sentenceCase(full.range)],
        ['Area', sentenceCase(full.area)],
        ['Targets', sentenceCase(full.target)],
        full.defense && ['Defense', `${titleCase(full.defense)} against your spell DC ${dc}`],
        attack && ['Spell attack', `${atk} against the target’s AC`],
        ['Duration', sentenceCase(full.duration)],
        ['Traits', full.traits?.map(titleCase).join(', ')],
      ].filter((f) => f && f[1]),
      html: full.description,
      note: !spellRules ? 'Loading the rules text…' : spellRules.error ? 'Couldn’t load the spell’s rules text. Try refreshing.' : null,
      link: full.slug ? { to: `/spells/${full.slug}`, label: 'Open in the Spell Book' } : null,
    };
  }

  if (kind === 'origin') {
    const o = ORIGIN[id];
    const name = o.name(character);
    const list = spellRules?.[o.type] ?? [];
    const built = character.build?.[id === 'class' ? 'class' : id];
    const full = list.find((x) => x.id === built) ?? list.find((x) => x.name === name) ?? null;
    const facts = id === 'ancestry'
      ? [['Hit Points', full?.hp ?? character.ancestry?.hp], ['Size', full?.size && (SIZE[full.size] ?? titleCase(full.size))], ['Speed', (full?.speed ?? character.ancestry?.speed) && `${full?.speed ?? character.ancestry.speed} feet`], ['Vision', full?.vision && titleCase(String(full.vision).replace(/-/g, ' '))]]
      : id === 'class'
        ? [['Hit Points', full?.hp ? `${full.hp} + Constitution, each level` : null], ['Key attribute', character.keyAbility && abilityName(character.keyAbility)]]
        : [];
    return {
      kind: o.kind,
      name: name ?? o.kind,
      icon: o.icon,
      value: '',
      facts: [...facts, ['Traits', listOf(full?.traits)], ['Rarity', full?.rarity && full.rarity !== 'common' && titleCase(full.rarity)]].filter((f) => f[1]),
      html: full?.description,
      note: !spellRules ? 'Loading the rules text…' : spellRules.error ? 'Couldn’t load the rules text. Try refreshing.' : !full ? 'No rules text for this one in the current rules data.' : null,
    };
  }

  if (kind === 'rune') {
    const r = character.runes?.find((x) => x.slug === id);
    if (!r) return null;
    const full = spellRules?.runes?.find((x) => x.id === r.id || x.slug === r.slug) ?? r;
    return {
      kind: 'Rune',
      name: full.name,
      icon: 'runes',
      value: '',
      facts: [['Usage', full.usage && full.usage[0].toUpperCase() + full.usage.slice(1)], ['Level', full.level], ['Traits', listOf(full.traits)], ['Your class DC', classDc(character).total]].filter((f) => f[1]),
      rules: RUNE_RULES,
      html: full.description,
      note: !spellRules ? 'Loading the rules text…' : spellRules.error ? 'Couldn’t load the rune’s rules text. Try refreshing.' : null,
    };
  }

  if (kind === 'info') {
    if (id === 'size') {
      const size = character.ancestry?.size;
      return { kind: 'Size', name: SIZE[size] ?? titleCase(size ?? 'Medium'), icon: 'user', value: '', rules: SIZE_RULES[size] ?? SIZE_RULES.med };
    }
    if (id === 'level') return { kind: 'Level', name: `Level ${character.level}`, icon: 'crown', value: `${character.level}`, rules: LEVEL_RULES };
    if (id === 'heroPoints') return { kind: 'Hero Points', name: 'Hero Points', icon: 'spark', value: `${character.heroPoints ?? 0}`, unit: '/ 3', rules: HERO_POINT_RULES };
    if (id === 'languages') {
      const langs = (character.languages ?? []).map(titleCase);
      return {
        kind: 'Languages',
        name: 'Languages',
        icon: 'book',
        value: `${langs.length || 1}`,
        rules: LANGUAGE_RULES,
        sections: [{ title: 'You speak', items: (langs.length ? langs : ['Common']).map((l) => [l, null]) }],
      };
    }
    return null;
  }

  if (kind === 'prof') {
    const rank = p.weapons?.[id] ?? 'untrained';
    const part = proficiencyPart(rank, character.level);
    const yours = (character.weapons ?? []).filter((w) => w.category === id).map((w) => w.name);
    return {
      kind: 'Weapon proficiency',
      name: `${titleCase(id)} ${id === 'unarmed' ? 'attacks' : 'weapons'}`,
      icon: 'swords',
      stat: { total: part.value, parts: [part] },
      rank,
      rules: [WEAPON_CATEGORY_RULES[id], WEAPON_PROFICIENCY_RULE],
      facts: yours.length ? [['Yours', yours.join(', ')]] : [],
    };
  }

  if (kind === 'attr') {
    const mod = character.abilities[id];
    const skills = Object.keys(SKILL_ABILITY).filter((s) => SKILL_ABILITY[s] === id).map(titleCase);
    if (id === 'int') skills.push('Lore');
    return {
      kind: 'Attribute',
      name: abilityName(id),
      icon: ATTRIBUTES[id].icon,
      value: signed(mod),
      facts: [
        skills.length > 0 && ['Skills', skills.join(', ')],
        id === 'str' && ['Encumbered above', `${5 + mod} Bulk`],
        id === 'str' && ['Most you can carry', `${10 + mod} Bulk`],
      ].filter(Boolean),
      rules: [...ATTRIBUTES[id].rules, ...(id === character.keyAbility ? [KEY_ATTRIBUTE] : [])],
    };
  }

  if (kind === 'def') {
    const info = DEFENSES[id];
    if (id === 'shield') {
      if (!shield) return null;
      return {
        ...info,
        name: shield.name,
        value: `${shield.current}`,
        unit: `/ ${shield.max} HP`,
        facts: [
          ['Hardness', shield.hardness],
          ['Broken Threshold', `${shield.brokenAt} HP`],
          character.shield?.acBonus != null && ['AC when raised', `+${character.shield.acBonus}`],
          ['Condition', shield.destroyed ? 'Destroyed' : shield.broken ? 'Broken' : shield.current < shield.max ? `${shield.max - shield.current} damage` : 'Undamaged'],
        ].filter(Boolean),
        tool: !readOnly && <ShieldTracker bare />,
      };
    }
    if (id === 'speed') {
      const swim = swimSpeed(character);
      return { ...info, stat: landSpeed(character), unsigned: true, unit: 'ft', facts: swim ? [['Swim Speed', `${swim} ft`]] : [] };
    }
    const stat = id === 'ac' ? armorClass(character, opts) : id === 'perception' ? perception(character, opts) : savingThrow(character, id, opts);
    const rank = id === 'ac' ? p.armor[character.armor?.category ?? 'unarmored'] : p[id];
    const vision = character.ancestry?.vision;
    const facts = id === 'ac'
      ? [['Armor', character.armor?.name ?? 'None'], character.shield && ['Shield', `${character.shield.name}, +${character.shield.acBonus} when raised`]].filter(Boolean)
      : id === 'perception' && SENSES[vision] ? [['Senses', SENSES[vision]]] : [];
    const rules = id === 'perception' && VISION_RULES[vision] ? [...info.rules, VISION_RULES[vision]] : info.rules;
    return { ...info, stat, rank, unsigned: id === 'ac', facts, rules };
  }

  if (kind === 'magic') {
    const info = DEFENSES[id];
    const stat = id === 'classDc' ? classDc(character) : id === 'spellAttack' ? spellAttack(character, opts) : spellDc(character, opts);
    const rank = id === 'classDc' ? (p.classDc ?? 'trained') : (p.spellcasting ?? 'untrained');
    return { ...info, stat, rank, unsigned: id !== 'spellAttack' };
  }

  if (kind === 'skill') {
    const check = skillCheck(character, id, opts);
    const info = SKILLS[id] ?? LORE;
    return {
      kind: SKILLS[id] ? 'Skill' : 'Lore',
      name: titleCase(id),
      icon: info.icon,
      stat: check,
      rank: check.rank,
      ability: check.ability,
      rules: [...info.rules, ...(check.rank === 'untrained' ? [UNTRAINED_NOTE] : [])],
      uses: info.uses,
    };
  }

  if (kind === 'strike') {
    const w = character.weapons?.[Number(id)];
    if (!w) return null;
    const mod = damageModifier(w, character.abilities);
    const unarmed = w.slug === 'fist' || w.category === 'unarmed';
    return {
      kind: w.ranged ? 'Ranged Strike' : 'Melee Strike',
      name: w.name,
      icon: unarmed ? 'strikeUnarmed' : w.ranged ? 'strikeRanged' : 'strikeBlade',
      stat: strikeBonus(character, w, opts),
      actions: '1',
      rank: p.weapons?.[w.category] ?? undefined,
      facts: [
        ['Damage', `1d${w.die}${mod ? ` ${signed(mod)}` : ''} ${w.damageType}`],
        w.ranged && w.range && ['Range increment', `${w.range} ft`],
      ].filter(Boolean),
      rules: [w.ranged ? STRIKE.ranged : STRIKE.melee, STRIKE.map],
      sections: [{ title: 'Traits', items: (w.traits ?? []).map((t) => [traitLabel(t), traitRule(t)]) }],
    };
  }
  return null;
}

/** The equipped weapons as the sheet's Strikes table (melee, then ranged); tap one for the math. */
function Strikes({ character, opts, readOnly, selected, onSelect, onRoll }) {
  const weapons = character.weapons ?? [];
  // Selected by position ('strike:0'): someone can carry two of the same weapon.
  const groups = [
    ['Melee', weapons.map((w, i) => [w, i]).filter(([w]) => !w.ranged)],
    ['Ranged', weapons.map((w, i) => [w, i]).filter(([w]) => w.ranged)],
  ].filter(([, list]) => list.length);
  return (
    <section className="sheet-panel" aria-labelledby="strikes-title">
      <h2 id="strikes-title" className="sheet-panel__title">Strikes</h2>
      {groups.map(([label, list]) => (
        <div key={label} className="sheet-strike-group">
          <span className="sheet-panel__label">{label}</span>
          <ul className="sheet-strikes">
            {list.map(([w, i]) => {
              const mod = damageModifier(w, character.abilities);
              return (
                <li key={`${w.slug}-${i}`}>
                  <div className={`sheet-strike sheet-rollable ${selected === `strike:${i}` ? 'is-open' : ''}`}>
                    <OpenButton label={w.name} pressed={selected === `strike:${i}`} onClick={() => onSelect(`strike:${i}`)} />
                    <RollButton label={`${w.name} Strike`} stat={strikeBonus(character, w, opts)} onRoll={(label, stat) => onRoll(label, stat, w)} className="sheet-strike__bonus" />
                    <span className="sheet-strike__main">
                      <span className="sheet-strike__name">{w.name}</span>
                      {w.traits?.length > 0 && <span className="sheet-strike__traits">{w.traits.join(', ')}</span>}
                    </span>
                    <span className="sheet-strike__damage">
                      1d{w.die}{mod ? ` ${signed(mod)}` : ''} {w.damageType}
                      {w.ranged && w.range ? <small> · {w.range} ft</small> : null}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {weapons.length === 1 && weapons[0].slug === 'fist' && (
        <p className="rule-note">{readOnly ? 'No weapons equipped.' : 'No weapons equipped. Equip one on the Inventory tab.'}</p>
      )}
      <ul className="sheet-profs" aria-label="Weapon proficiencies">
        {WEAPON_CATEGORIES.map((c) => (
          <li key={c}>
            <button type="button" className="sheet-prof" aria-pressed={selected === `prof:${c}`} onClick={() => onSelect(`prof:${c}`)}>
              <span className="sheet-prof__name">{titleCase(c)}</span>
              <RankPips rank={character.proficiencies.weapons?.[c] ?? 'untrained'} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The one campaign a character belongs to, linked for its player. */
function CampaignLine({ campaign, readOnly }) {
  if (!campaign) return readOnly ? null : <p className="hero__campaign muted">No campaign yet</p>;
  return (
    <p className="hero__campaign">
      <span className="eyebrow">Campaign</span>{' '}
      {campaign.id && !readOnly ? <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link> : <strong>{campaign.name}</strong>}
    </p>
  );
}

/** A spell on the sheet: its name, a dot leader, and its action cost. Tapping it opens it in the details drawer. */
const spellLine = (s, key, pick) => {
  const id = `spell:${spellKey(s)}`;
  return (
    <li key={key}>
      <button type="button" className="sheet-spell" aria-pressed={pick?.selected === id} onClick={() => pick?.onSelect(id)}>
        <span className="sheet-spell__name">{s.name}</span>
        <span className="book__entry-dots" aria-hidden="true" />
        <ActionCost actions={s.actions} />
      </button>
    </li>
  );
};

/** What a caster who prepares from their spellbook or familiar has prepared today (chosen on the Spells tab). */
function PreparedToday({ casting, prepared, readOnly, pick }) {
  const unprepared = [...prepared.unprepared.cantrips, ...prepared.unprepared.spells];
  return (
    <>
      <div className="sheet-spells">
        <span className="sheet-panel__label">Cantrips prepared</span>
        {prepared.cantrips.length ? <ul className="sheet-list">{prepared.cantrips.map((s) => spellLine(s, spellKey(s), pick))}</ul> : <p className="muted italic">No cantrips prepared.</p>}
      </div>
      <div className="sheet-spells">
        <span className="sheet-panel__label">{slotsText(casting)}</span>
        <ul className="sheet-list">
          {prepared.slots.map((s, i) => (s ? spellLine(s, i, pick) : <li key={i}><span className="muted italic">Empty slot</span></li>))}
        </ul>
      </div>
      {unprepared.length > 0 && (
        <p className="rule-note" style={{ margin: 0 }}>
          Also in your {casting.kind === 'familiar' ? 'familiar' : (casting.listName ?? 'spellbook')}:{' '}
          {unprepared.map((s, i) => (
            <span key={spellKey(s)}>
              <button type="button" className="link-button sheet-inline-spell" aria-pressed={pick?.selected === `spell:${spellKey(s)}`} onClick={() => pick?.onSelect(`spell:${spellKey(s)}`)}>{s.name}</button>
              {i < unprepared.length - 1 ? ', ' : '.'}
            </span>
          ))}
        </p>
      )}
      {!readOnly && (
        <p className="rule-note" style={{ margin: 0 }}>
          <Link to="../spells">Change what's prepared</Link> on the Spells tab.
        </p>
      )}
    </>
  );
}

/** Class DC, spell attack and spell DC as the sheet's boxes, then the spells or runes the character has. */
function MagicAndDcs({ character, opts, selected, onSelect, onRoll }) {
  const { prepared, readOnly } = useTable();
  const casting = character.spellcasting;
  const p = character.proficiencies;
  // Class DC lives in the defense band; this panel is only for casters' spells and runesmiths' runes.
  if (!casting && !character.runes?.length) return null;
  const stats = casting
    ? {
        spellAttack: { label: 'Spell attack', stat: spellAttack(character, opts), rank: p.spellcasting ?? 'untrained' },
        spellDc: { label: 'Spell DC', stat: spellDc(character, opts), signed: false, rank: p.spellcasting ?? 'untrained' },
      }
    : {};
  const title = casting ? `${casting.tradition ? titleCase(casting.tradition) : ''} Spells`.trim() : 'Runes';

  return (
    <section className="sheet-panel sheet-magic" aria-labelledby="magic-title">
      <h2 id="magic-title" className="sheet-panel__title">{title}</h2>
      {casting && <div className={`sheet-dcs sheet-dcs--${Object.keys(stats).length}`} role="group" aria-label="Spell attack and DC">
        {Object.entries(stats).map(([key, s]) => (s.signed === false ? (
          <button key={key} type="button" className="sheet-def" aria-pressed={selected === `magic:${key}`} onClick={() => onSelect(`magic:${key}`)}>
            <span className="sheet-def__label">{s.label}</span>
            <span className="sheet-def__value">{s.stat.total}</span>
            <RankPips rank={s.rank} />
          </button>
        ) : (
          <div key={key} className={`sheet-def sheet-rollable ${selected === `magic:${key}` ? 'is-open' : ''}`}>
            <OpenButton label={s.label} pressed={selected === `magic:${key}`} onClick={() => onSelect(`magic:${key}`)} />
            <span className="sheet-def__label">{s.label}</span>
            <RollButton label={s.label} stat={s.stat} onRoll={onRoll} className="sheet-def__value" />
            <RankPips rank={s.rank} />
          </div>
        )))}
      </div>}

      {prepared && <PreparedToday casting={casting} prepared={prepared} readOnly={readOnly} pick={{ selected, onSelect }} />}

      {casting && casting.kind !== 'focus' && !prepared && (
        <>
          <p className="rule-note" style={{ margin: 0 }}>{slotsText(casting)} a day.</p>
          {[
            ['Cantrips', casting.cantrips],
            ['Spells', casting.spells],
          ].map(([label, list]) => (
            <div key={label} className="sheet-spells">
              <span className="sheet-panel__label">{label}</span>
              <ul className="sheet-list">{list.map((s) => spellLine(s, s.slug, { selected, onSelect }))}</ul>
            </div>
          ))}
        </>
      )}

      {character.runes?.length > 0 && (
        <div className="sheet-spells">
          <span className="sheet-panel__label">Runic repertoire</span>
          <ul className="sheet-list">
            {character.runes.map((r) => (
              <li key={r.slug}>
                <button type="button" className="sheet-spell" aria-pressed={selected === `rune:${r.slug}`} onClick={() => onSelect(`rune:${r.slug}`)}>
                  <span className="sheet-spell__name">{r.name}</span>
                  <span className="book__entry-dots" aria-hidden="true" />
                  {r.usage && <span className="muted">{r.usage}</span>}
                </button>
              </li>
            ))}
          </ul>
          <p className="rule-note" style={{ margin: '4px 0 0' }}>
            {RUNE_RULES[0]}
          </p>
        </div>
      )}
    </section>
  );
}
