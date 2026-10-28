import { useState } from 'react';
import { Link } from 'react-router-dom';
import { armorClass, savingThrow, perception, abilityName, skillCheck, SKILL_ABILITY, spellAttack, spellDc, classDc, strikeBonus, damageModifier, spellKey } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import Portrait from '../components/Portrait.jsx';
import PortraitEditor from '../components/PortraitEditor.jsx';
import ExportSheetButton from '../components/ExportSheetButton.jsx';
import Breakdown from '../components/Breakdown.jsx';
import RulesUpdateNotice from '../components/RulesUpdateNotice.jsx';
import HpTracker from '../components/HpTracker.jsx';
import ShieldTracker from '../components/ShieldTracker.jsx';
import ShareSheet from '../components/ShareSheet.jsx';
import { signed, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';
import RankPips from '../components/RankPips.jsx';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SIZE = { tiny: 'Tiny', sm: 'Small', med: 'Medium', lg: 'Large' };
const SENSES = { darkvision: 'Darkvision', 'low-light-vision': 'Low-light vision' };
const WEAPON_CATEGORIES = ['unarmed', 'simple', 'martial', 'advanced'];

/**
 * The character sheet, laid out like page one of Paizo's sheet: the header, the
 * attributes, the defense band (AC, saves, HP, Perception, Speed), then skills on the
 * left and Strikes and DCs on the right. Tap any number to see how it's worked out.
 */
export default function SheetPage() {
  const { character, characterId, readOnly, portraitUrl, setPortraitUrl, campaign, currentHp, maxHp, conditions, shieldRaised, shield } = useTable();
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [selected, setSelected] = useState('ac');
  const [skill, setSkill] = useState(null);
  const [magic, setMagic] = useState(null);
  const [strike, setStrike] = useState(null);

  const opts = { conditions, shieldRaised };
  const p = character.proficiencies;
  const ac = armorClass(character, opts);
  const defenses = {
    ac: { title: `Why your AC is ${ac.total}`, stat: ac, signed: false },
    fortitude: { title: 'Fortitude save', stat: savingThrow(character, 'fortitude', opts) },
    reflex: { title: 'Reflex save', stat: savingThrow(character, 'reflex', opts) },
    will: { title: 'Will save', stat: savingThrow(character, 'will', opts) },
    perception: { title: 'Perception', stat: perception(character, opts) },
  };
  const current = defenses[selected];
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
    <button key={id} type="button" className={`sheet-def sheet-def--${id}`} aria-pressed={selected === id} onClick={() => setSelected(id)}>
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
            onClick={() => setEditingPortrait((v) => !v)}
            aria-expanded={editingPortrait}
            aria-label={portraitUrl ? 'Change portrait' : 'Add a portrait'}
          >
            <Portrait url={portraitUrl} name={character.name} size="lg" />
            <span className="hero__portrait-hint">{portraitUrl ? 'Change' : 'Add portrait'}</span>
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
        <HealthOrb current={currentHp} max={maxHp} />
      </header>

      <div className="sheet__actions">
        {/* Only the owner reaches this sheet (the server checks), and only characters
            made in the builder keep the choices it needs to reopen them. */}
        {!readOnly && character.build && (
          <Link to={`/characters/${characterId}/edit`} className="btn btn--small">Edit character</Link>
        )}
        <ExportSheetButton />
      </div>

      {editingPortrait && (
        <PortraitEditor
          characterId={characterId}
          currentUrl={portraitUrl}
          onSaved={setPortraitUrl}
          onClose={() => setEditingPortrait(false)}
        />
      )}

      <section className="sheet-attrs" aria-label="Attribute modifiers">
        {ABILITIES.map((a) => (
          <div key={a} className={`sheet-attr ${a === character.keyAbility ? 'sheet-attr--key' : ''}`}>
            <span className="sheet-attr__short">
              {a.toUpperCase()}
              {a === character.keyAbility && <span className="ledger__crown" title="Key attribute"> ♛<span className="visually-hidden"> (key attribute)</span></span>}
            </span>
            <span className="sheet-attr__value">{signed(character.abilities[a])}</span>
            <span className="sheet-attr__name">{abilityName(a)}</span>
          </div>
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
        <div className="sheet-def sheet-def--hp">
          <span className="sheet-def__label">Hit Points</span>
          <span className="sheet-def__value">
            {currentHp}
            <small> / {maxHp}</small>
          </span>
          <span className="sheet-def__extra">{currentHp === maxHp ? 'Unhurt' : currentHp === 0 ? 'Dying' : `${maxHp - currentHp} damage taken`}</span>
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
        <div className="sheet-def sheet-def--speed">
          <span className="sheet-def__label">Speed</span>
          <span className="sheet-def__value">
            {character.ancestry.speed}
            <small> ft</small>
          </span>
        </div>
      </section>

      <Breakdown title={current.title} stat={current.stat} signTotal={current.signed !== false} />

      {!readOnly && <HpTracker />}
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
                    <button type="button" className="sheet-skill" aria-pressed={skill === name} onClick={() => setSkill(skill === name ? null : name)}>
                      <span className="sheet-skill__name">{titleCase(name)}</span>
                      <span className="sheet-skill__attr">{check.ability.toUpperCase()}</span>
                      <RankPips rank={check.rank} />
                      <span className="sheet-skill__total">{signed(check.total)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {skill && <Breakdown title={titleCase(skill)} stat={skillCheck(character, skill, opts)} />}
            <div className="sheet-langs">
              <span className="sheet-panel__label">Languages</span>
              <span>{(character.languages ?? []).map(titleCase).join(', ') || 'Common'}</span>
            </div>
          </section>
        </div>

        <div className="sheet__col">
          <Strikes character={character} opts={opts} readOnly={readOnly} selected={strike} onSelect={setStrike} />
          {character.keyAbility && <MagicAndDcs character={character} opts={opts} selected={magic} onSelect={setMagic} />}
        </div>
      </div>

      {!readOnly && <ShareSheet />}
    </div>
  );
}

/** The equipped weapons as the sheet's Strikes table (melee, then ranged); tap one for the math. */
function Strikes({ character, opts, readOnly, selected, onSelect }) {
  const weapons = character.weapons ?? [];
  // Selected by position: someone can carry two of the same weapon.
  const current = weapons[selected];
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
                  <button type="button" className="sheet-strike" aria-pressed={selected === i} onClick={() => onSelect(selected === i ? null : i)}>
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
      {current && <Breakdown title={`${current.name} attack`} stat={strikeBonus(character, current, opts)} />}
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

/** A spell on the sheet: its name, a dot leader, and its action cost. */
const spellLine = (s, key) => (
  <li key={key}>
    <span>{s.name}</span>
    <span className="book__entry-dots" aria-hidden="true" />
    <ActionCost actions={s.actions} />
  </li>
);

/** What a caster who prepares from their spellbook or familiar has prepared today (chosen on the Spells tab). */
function PreparedToday({ casting, prepared, readOnly }) {
  const unprepared = [...prepared.unprepared.cantrips, ...prepared.unprepared.spells];
  return (
    <>
      <div className="sheet-spells">
        <span className="sheet-panel__label">Cantrips prepared</span>
        {prepared.cantrips.length ? <ul className="sheet-list">{prepared.cantrips.map((s) => spellLine(s, spellKey(s)))}</ul> : <p className="muted italic">No cantrips prepared.</p>}
      </div>
      <div className="sheet-spells">
        <span className="sheet-panel__label">{casting.slots} first-rank slots</span>
        <ul className="sheet-list">
          {prepared.slots.map((s, i) => (s ? spellLine(s, i) : <li key={i}><span className="muted italic">Empty slot</span></li>))}
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
  const current = stats[selected];
  const title = casting ? `${casting.tradition ? titleCase(casting.tradition) : ''} Spells`.trim() : character.runes?.length ? 'Runes' : 'Class DC';

  return (
    <section className="sheet-panel sheet-magic" aria-labelledby="magic-title">
      <h2 id="magic-title" className="sheet-panel__title">{title}</h2>
      <div className={`sheet-dcs sheet-dcs--${Object.keys(stats).length}`} role="group" aria-label="Class and spell DCs">
        {Object.entries(stats).map(([key, s]) => (
          <button key={key} type="button" className="sheet-def" aria-pressed={selected === key} onClick={() => onSelect(selected === key ? null : key)}>
            <span className="sheet-def__label">{s.label}</span>
            <span className="sheet-def__value">{s.signed === false ? s.stat.total : signed(s.stat.total)}</span>
            <RankPips rank={s.rank} />
          </button>
        ))}
      </div>
      {current && <Breakdown title={current.title} stat={current.stat} signTotal={current.signed !== false} />}

      {prepared && <PreparedToday casting={casting} prepared={prepared} readOnly={readOnly} />}

      {casting && casting.kind !== 'focus' && !prepared && (
        <>
          <p className="rule-note" style={{ margin: 0 }}>{casting.slots} first-rank slots a day.</p>
          {[
            ['Cantrips', casting.cantrips],
            ['1st rank', casting.spells],
          ].map(([label, list]) => (
            <div key={label} className="sheet-spells">
              <span className="sheet-panel__label">{label}</span>
              <ul className="sheet-list">{list.map((s) => spellLine(s, s.slug))}</ul>
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
