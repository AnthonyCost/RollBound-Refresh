import { useState } from 'react';
import { Link } from 'react-router-dom';
import { armorClass, savingThrow, perception, abilityName, skillCheck, SKILL_ABILITY, spellAttack, spellDc, classDc, strikeBonus, damageModifier } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import Portrait from '../components/Portrait.jsx';
import PortraitEditor from '../components/PortraitEditor.jsx';
import ExportSheetButton from '../components/ExportSheetButton.jsx';
import Breakdown from '../components/Breakdown.jsx';
import Ornament from '../components/Ornament.jsx';
import RulesUpdateNotice from '../components/RulesUpdateNotice.jsx';
import HpTracker from '../components/HpTracker.jsx';
import ShareSheet from '../components/ShareSheet.jsx';
import { signed, titleCase } from '../format.js';
import ActionCost from '../components/ActionCost.jsx';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export default function SheetPage() {
  const { character, characterId, readOnly, portraitUrl, setPortraitUrl, campaign, currentHp, maxHp, conditions, shieldRaised } = useTable();
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [selected, setSelected] = useState('ac');
  const [skill, setSkill] = useState(null);
  const [magic, setMagic] = useState(null);
  const [strike, setStrike] = useState(null);

  const opts = { conditions, shieldRaised };
  const stats = {
    ac: { short: 'AC', title: `Why your AC is ${armorClass(character, opts).total}`, stat: armorClass(character, opts), signed: false },
    fortitude: { short: 'FORT', title: 'Fortitude save', stat: savingThrow(character, 'fortitude', opts) },
    reflex: { short: 'REF', title: 'Reflex save', stat: savingThrow(character, 'reflex', opts) },
    will: { short: 'WILL', title: 'Will save', stat: savingThrow(character, 'will', opts) },
    perception: { short: 'PERC', title: 'Perception', stat: perception(character, opts) },
  };
  const current = stats[selected];

  return (
    <div className="split">
      <div className="split__col">
      {!readOnly && <RulesUpdateNotice />}
      <section className="hero">
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
        <div className="hero__body">
          <h1 className="hero__name">{character.name}</h1>
          <p className="italic muted" style={{ margin: '2px 0 4px' }}>
            {character.ancestry.name} {character.className} · Level {character.level}
          </p>
          <div className="hero__meta">
            <span>Speed <strong>{character.ancestry.speed} ft</strong></span>
            <span>Hero Points <strong>{character.heroPoints}</strong></span>
          </div>
          <CampaignLine campaign={campaign} readOnly={readOnly} />
        </div>
        <HealthOrb current={currentHp} max={maxHp} />
      </section>

      {!readOnly && <HpTracker />}

      {/* Only the owner reaches this sheet (the server checks), and only characters
          made in the builder keep the choices it needs to reopen them. */}
      {!readOnly && character.build && (
        <Link to={`/characters/${characterId}/edit`} className="btn sheet__edit">Edit character</Link>
      )}

      <ExportSheetButton />

      {editingPortrait && (
        <PortraitEditor
          characterId={characterId}
          currentUrl={portraitUrl}
          onSaved={setPortraitUrl}
          onClose={() => setEditingPortrait(false)}
        />
      )}

      <Ornament />

      <div className="stats" role="group" aria-label="Defenses and Perception">
        {Object.entries(stats).map(([key, s]) => (
          <button key={key} type="button" className="stat" aria-pressed={selected === key} onClick={() => setSelected(key)}>
            <span className="stat__label">{s.short}</span>
            <span className="stat__value">{s.signed === false ? s.stat.total : signed(s.stat.total)}</span>
          </button>
        ))}
      </div>

      <Breakdown title={current.title} stat={current.stat} signTotal={current.signed !== false} />

      <Strikes character={character} opts={opts} readOnly={readOnly} selected={strike} onSelect={setStrike} />

      <div className="abilities">
        {ABILITIES.map((a) => (
          <div key={a} className="ability" title={abilityName(a)}>
            <span>{a.toUpperCase()}</span>
            <span>{signed(character.abilities[a])}</span>
          </div>
        ))}
      </div>

      </div>
      <div className="split__col">
      <Ornament label="SKILLS" />

      <ul className="skills">
        {[...Object.keys(SKILL_ABILITY), ...(character.lores ?? [])].map((name) => {
          const check = skillCheck(character, name, opts);
          return (
            <li key={name}>
              <button type="button" className="skill" aria-pressed={skill === name} onClick={() => setSkill(skill === name ? null : name)}>
                <span className={`skill__rank skill__rank--${check.rank}`} title={titleCase(check.rank)}>{check.rank[0].toUpperCase()}</span>
                <span className="skill__name">{titleCase(name)}</span>
                <span className="skill__total">{signed(check.total)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {skill && <Breakdown title={titleCase(skill)} stat={skillCheck(character, skill, opts)} />}

      {character.keyAbility && <MagicAndDcs character={character} opts={opts} selected={magic} onSelect={setMagic} />}

      {!readOnly && <ShareSheet />}
      </div>
    </div>
  );
}

/** The equipped weapons' attack bonus and damage; tap one for the math. */
function Strikes({ character, opts, readOnly, selected, onSelect }) {
  const weapons = character.weapons ?? [];
  // Selected by position: someone can carry two of the same weapon.
  const current = weapons[selected];
  return (
    <>
      <Ornament label="STRIKES" />
      <ul className="strikes">
        {weapons.map((w, i) => {
          const mod = damageModifier(w, character.abilities);
          return (
            <li key={`${w.slug}-${i}`}>
              <button type="button" className="strike" aria-pressed={selected === i} onClick={() => onSelect(selected === i ? null : i)}>
                <span className="strike__main">
                  <span className="strike__name">{w.name}</span>
                  <span className="strike__damage">
                    1d{w.die}{mod ? ` ${signed(mod)}` : ''} {w.damageType}
                    {w.ranged && w.range ? ` · ${w.range} ft` : ''}
                  </span>
                  {w.traits?.length > 0 && <span className="strike__traits">{w.traits.join(', ')}</span>}
                </span>
                <span className="strike__bonus">{signed(strikeBonus(character, w, opts).total)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {weapons.length === 1 && weapons[0].slug === 'fist' && (
        <p className="rule-note">{readOnly ? 'No weapons equipped.' : 'No weapons equipped. Equip one on the Inventory tab.'}</p>
      )}
      {current && <Breakdown title={`${current.name} attack`} stat={strikeBonus(character, current, opts)} />}
    </>
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

function MagicAndDcs({ character, opts, selected, onSelect }) {
  const casting = character.spellcasting;
  const stats = {
    classDc: { short: 'CLASS DC', title: 'Class DC', stat: classDc(character), signed: false },
    ...(casting && {
      spellAttack: { short: 'SPELL ATK', title: 'Spell attack', stat: spellAttack(character, opts) },
      spellDc: { short: 'SPELL DC', title: 'Spell DC', stat: spellDc(character, opts), signed: false },
    }),
  };
  const current = stats[selected];

  return (
    <>
      <Ornament label={casting ? `${casting.tradition.toUpperCase()} SPELLS` : character.runes ? 'RUNES' : 'CLASS DC'} />
      <div className="stats stats--3" role="group" aria-label="Class and spell DCs">
        {Object.entries(stats).map(([key, s]) => (
          <button key={key} type="button" className="stat" aria-pressed={selected === key} onClick={() => onSelect(selected === key ? null : key)}>
            <span className="stat__label">{s.short}</span>
            <span className="stat__value">{s.signed === false ? s.stat.total : signed(s.stat.total)}</span>
          </button>
        ))}
      </div>
      {current && <Breakdown title={current.title} stat={current.stat} signTotal={current.signed !== false} />}

      {casting && casting.kind !== 'focus' && (
        <section className="panel">
          <h2 className="panel__title">{casting.slots} first-rank slots a day</h2>
          {[
            ['Cantrips', casting.cantrips],
            ['1st rank', casting.spells],
          ].map(([label, list]) => (
            <div key={label} className="spell-group">
              <span className="eyebrow">{label}</span>
              <ul className="log">
                {list.map((s) => (
                  <li key={s.slug}>
                    <strong>{s.name}</strong> <ActionCost actions={s.actions} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {casting.prepares && (
            <p className="rule-note" style={{ margin: '8px 0 0' }}>
              You prepare {casting.prepares.cantrips} cantrips and {casting.prepares.spells} of these spells each morning.
            </p>
          )}
        </section>
      )}

      {character.runes?.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">Runic repertoire</h2>
          <ul className="log">
            {character.runes.map((r) => (
              <li key={r.slug}>
                <strong>{r.name}</strong>
                {r.usage && <span className="muted"> · {r.usage}</span>}
              </li>
            ))}
          </ul>
          <p className="rule-note" style={{ margin: '8px 0 0' }}>
            Trace a rune as an action, or etch up to 2 during your daily preparations. Runes that call for a saving throw use your class DC.
          </p>
        </section>
      )}
    </>
  );
}
