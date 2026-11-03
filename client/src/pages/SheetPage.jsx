import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { armorClass, landSpeed, swimSpeed, savingThrow, perception, abilityName, skillCheck, SKILL_ABILITY, spellAttack, spellDc, classDc, strikeBonus, damageModifier, spellKey, describeCondition } from '@rollbound/rules';
import { loadRules } from '../state/rulesData.js';
import { useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import ShieldGauge from '../components/ShieldGauge.jsx';
import Portrait from '../components/Portrait.jsx';
import CharacterDrawer from '../components/CharacterDrawer.jsx';
import ExportSheetButton from '../components/ExportSheetButton.jsx';
import DetailsDrawer from '../components/DetailsDrawer.jsx';
import { ATTRIBUTES, KEY_ATTRIBUTE, DEFENSES, HIT_POINTS, SKILLS, LORE, UNTRAINED_NOTE, STRIKE, traitRule, traitLabel } from '../sheet/sheetRules.js';
import RulesUpdateNotice from '../components/RulesUpdateNotice.jsx';
import HpTracker from '../components/HpTracker.jsx';
import ShieldTracker from '../components/ShieldTracker.jsx';
import { sentenceCase, signed, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';
import RankPips from '../components/RankPips.jsx';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SIZE = { tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large' };
const SENSES = { darkvision: 'Darkvision', 'low-light-vision': 'Low-light vision' };
const WEAPON_CATEGORIES = ['unarmed', 'simple', 'martial', 'advanced'];
const SPELL_TYPES = ['spells'];

/** The spells' full rules text, loaded the first time it's needed (when a spell is tapped). */
function useSpellRules(needed) {
  const [data, setData] = useState(null);
  const [wanted, setWanted] = useState(false);
  if (needed && !wanted) setWanted(true);
  useEffect(() => {
    if (!wanted) return undefined;
    let cancelled = false;
    loadRules({ types: SPELL_TYPES }).then(
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
 * The character sheet, laid out like page one of Paizo's sheet: the header, the
 * attributes, the defense band (AC, saves, HP, Perception, Speed), then skills on the
 * left and Strikes and DCs on the right. Tap any number and the details drawer shows how
 * it's worked out and the rules behind it.
 */
export default function SheetPage() {
  const { character, characterId, readOnly, portraitUrl, setPortraitUrl, campaign, currentHp, maxHp, setHp, hpError, conditions, shieldRaised, shield, prepared } = useTable();
  // What the details drawer shows: 'attr:str', 'def:ac', 'hp:', 'skill:athletics', 'strike:0', 'magic:classDc', 'spell:<id>'.
  const [open, setOpen] = useState(null);
  const spellRules = useSpellRules(Boolean(open?.startsWith('spell:')));
  const toggle = (key) => setOpen((cur) => (cur === key ? null : key));
  const close = useCallback(() => setOpen(null), []);

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
  const defenseBox = ({ id, label, rank, extra }) => (
    <button key={id} type="button" className={`sheet-def sheet-def--${id}`} aria-pressed={open === `def:${id}`} onClick={() => toggle(`def:${id}`)}>
      <span className="sheet-def__label">{label}</span>
      <span className="sheet-def__value">{defenses[id].signed === false ? defenses[id].stat.total : signed(defenses[id].stat.total)}</span>
      <RankPips rank={rank} />
      {extra && <span className="sheet-def__extra">{extra}</span>}
    </button>
  );

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
                <dd>{v}</dd>
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

      <section className={`sheet-panel sheet-defense ${shield ? 'sheet-defense--shield' : ''}`} aria-label="Defenses">
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
        {shield && (
          <div className={`sheet-def sheet-def--shield ${shield.broken ? 'sheet-def--broken' : ''}`}>
            <span className="sheet-def__label">Shield</span>
            <span className="sheet-def__value">
              {shield.current}
              <small> / {shield.max}</small>
            </span>
            <span className="sheet-def__extra">
              {shield.destroyed ? 'Destroyed' : shield.broken ? 'Broken' : `Hardness ${shield.hardness} · BT ${shield.brokenAt}`}
            </span>
          </div>
        )}
        {defenseBox({ id: 'perception', label: 'Perception', rank: p.perception, extra: senses })}
        <button type="button" className="sheet-def sheet-def--speed" aria-pressed={open === 'def:speed'} onClick={() => toggle('def:speed')}>
          <span className="sheet-def__label">Speed</span>
          <span className="sheet-def__value">
            {landSpeed(character).total}
            <small> ft</small>
          </span>
          {swimSpeed(character) && <span className="sheet-def__extra">Swim {swimSpeed(character)} ft</span>}
        </button>
      </section>

      {!readOnly && <ShieldTracker />}

      <div className="sheet__columns">
        <div className="sheet__col">
          <section className="sheet-panel" aria-labelledby="skills-title">
            <h2 id="skills-title" className="sheet-panel__title">Skills</h2>
            <ul className="sheet-skills">
              {[...Object.keys(SKILL_ABILITY), ...(character.lores ?? [])].map((name) => {
                const check = skillCheck(character, name, opts);
                return (
                  <li key={name}>
                    <button type="button" className="sheet-skill" aria-pressed={open === `skill:${name}`} onClick={() => toggle(`skill:${name}`)}>
                      <span className="sheet-skill__name">{titleCase(name)}</span>
                      <span className="sheet-skill__attr">{check.ability.toUpperCase()}</span>
                      <RankPips rank={check.rank} />
                      <span className="sheet-skill__total">{signed(check.total)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="sheet-langs">
              <span className="sheet-panel__label">Languages</span>
              <span>{(character.languages ?? []).map(titleCase).join(', ') || 'Common'}</span>
            </div>
          </section>
        </div>

        <div className="sheet__col">
          <Strikes character={character} opts={opts} readOnly={readOnly} selected={open} onSelect={toggle} />
          {character.keyAbility && <MagicAndDcs character={character} opts={opts} selected={open} onSelect={toggle} />}
        </div>
      </div>

      {!readOnly && <CharacterDrawer open={open === 'profile:'} onClose={close} />}

      <DetailsDrawer detail={open ? describe(open, character, opts, { shield, currentHp, maxHp, prepared, spellRules }) : null} onClose={close} />
    </div>
  );
}

/** Everything the details drawer needs for one tapped number (see DetailsDrawer for the shape). */
function describe(key, character, opts, { shield, currentHp, maxHp, prepared, spellRules } = {}) {
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
      };
    }
    if (id === 'speed') {
      const swim = swimSpeed(character);
      return { ...info, stat: landSpeed(character), unsigned: true, unit: 'ft', facts: swim ? [['Swim Speed', `${swim} ft`]] : [] };
    }
    const stat = id === 'ac' ? armorClass(character, opts) : id === 'perception' ? perception(character, opts) : savingThrow(character, id, opts);
    const rank = id === 'ac' ? p.armor[character.armor?.category ?? 'unarmored'] : p[id];
    const facts = id === 'ac' ? [['Armor', character.armor?.name ?? 'None'], character.shield && ['Shield', `${character.shield.name}, +${character.shield.acBonus} when raised`]].filter(Boolean) : [];
    return { ...info, stat, rank, unsigned: id === 'ac', facts };
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
function Strikes({ character, opts, readOnly, selected, onSelect }) {
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
                  <button type="button" className="sheet-strike" aria-pressed={selected === `strike:${i}`} onClick={() => onSelect(`strike:${i}`)}>
                    <span className="sheet-strike__bonus">{signed(strikeBonus(character, w, opts).total)}</span>
                    <span className="sheet-strike__main">
                      <span className="sheet-strike__name">{w.name}</span>
                      {w.traits?.length > 0 && <span className="sheet-strike__traits">{w.traits.join(', ')}</span>}
                    </span>
                    <span className="sheet-strike__damage">
                      1d{w.die}{mod ? ` ${signed(mod)}` : ''} {w.damageType}
                      {w.ranged && w.range ? <small> · {w.range} ft</small> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {weapons.length === 1 && weapons[0].slug === 'fist' && (
        <p className="rule-note">{readOnly ? 'No weapons equipped.' : 'No weapons equipped. Equip one on the Inventory tab.'}</p>
      )}
      <dl className="sheet-profs">
        {WEAPON_CATEGORIES.map((c) => (
          <div key={c}>
            <dt>{titleCase(c)}</dt>
            <dd><RankPips rank={character.proficiencies.weapons?.[c] ?? 'untrained'} /></dd>
          </div>
        ))}
      </dl>
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
        <span className="sheet-panel__label">{casting.slots} first-rank slot{casting.slots === 1 ? '' : 's'}</span>
        <ul className="sheet-list">
          {prepared.slots.map((s, i) => (s ? spellLine(s, i, pick) : <li key={i}><span className="muted italic">Empty slot</span></li>))}
        </ul>
      </div>
      {unprepared.length > 0 && (
        <p className="rule-note" style={{ margin: 0 }}>
          Also in your {casting.kind === 'familiar' ? 'familiar' : (casting.listName ?? 'spellbook')}: {unprepared.map((s) => s.name).join(', ')}.
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
function MagicAndDcs({ character, opts, selected, onSelect }) {
  const { prepared, readOnly } = useTable();
  const casting = character.spellcasting;
  const p = character.proficiencies;
  const stats = {
    classDc: { label: 'Class DC', title: 'Class DC', stat: classDc(character), signed: false, rank: p.classDc ?? 'trained' },
    ...(casting && {
      spellAttack: { label: 'Spell attack', title: 'Spell attack', stat: spellAttack(character, opts), rank: p.spellcasting ?? 'untrained' },
      spellDc: { label: 'Spell DC', title: 'Spell DC', stat: spellDc(character, opts), signed: false, rank: p.spellcasting ?? 'untrained' },
    }),
  };
  const title = casting ? `${casting.tradition ? titleCase(casting.tradition) : ''} Spells`.trim() : character.runes?.length ? 'Runes' : 'Class DC';

  return (
    <section className="sheet-panel sheet-magic" aria-labelledby="magic-title">
      <h2 id="magic-title" className="sheet-panel__title">{title}</h2>
      <div className={`sheet-dcs sheet-dcs--${Object.keys(stats).length}`} role="group" aria-label="Class and spell DCs">
        {Object.entries(stats).map(([key, s]) => (
          <button key={key} type="button" className="sheet-def" aria-pressed={selected === `magic:${key}`} onClick={() => onSelect(`magic:${key}`)}>
            <span className="sheet-def__label">{s.label}</span>
            <span className="sheet-def__value">{s.signed === false ? s.stat.total : signed(s.stat.total)}</span>
            <RankPips rank={s.rank} />
          </button>
        ))}
      </div>

      {prepared && <PreparedToday casting={casting} prepared={prepared} readOnly={readOnly} pick={{ selected, onSelect }} />}

      {casting && casting.kind !== 'focus' && !prepared && (
        <>
          <p className="rule-note" style={{ margin: 0 }}>{casting.slots} first-rank slot{casting.slots === 1 ? '' : 's'} a day.</p>
          {[
            ['Cantrips', casting.cantrips],
            ['1st rank', casting.spells],
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
                <span>{r.name}</span>
                <span className="book__entry-dots" aria-hidden="true" />
                {r.usage && <span className="muted">{r.usage}</span>}
              </li>
            ))}
          </ul>
          <p className="rule-note" style={{ margin: '4px 0 0' }}>
            Trace a rune as an action, or etch up to 2 during your daily preparations. Runes that call for a saving throw use your class DC.
          </p>
        </div>
      )}
    </section>
  );
}
