import { useState } from 'react';
import { armorClass, savingThrow, perception, abilityName, skillCheck, SKILL_ABILITY, spellAttack, spellDc, classDc } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import Portrait from '../components/Portrait.jsx';
import PortraitEditor from '../components/PortraitEditor.jsx';
import ExportSheetButton from '../components/ExportSheetButton.jsx';
import Breakdown from '../components/Breakdown.jsx';
import Ornament from '../components/Ornament.jsx';
import { signed, titleCase } from '../format.js';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export default function SheetPage() {
  const { character, characterId, portraitUrl, setPortraitUrl, hp, conditions, shieldRaised } = useTable();
  const [editingPortrait, setEditingPortrait] = useState(false);
  const [selected, setSelected] = useState('ac');
  const [skill, setSkill] = useState(null);
  const [magic, setMagic] = useState(null);

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
      <section className="hero">
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
        <div className="hero__body">
          <h1 className="hero__name">{character.name}</h1>
          <p className="italic muted" style={{ margin: '2px 0 4px' }}>
            {character.ancestry.name} {character.className} · Level {character.level}
          </p>
          <div className="hero__meta">
            <span>Speed <strong>{character.ancestry.speed} ft</strong></span>
            <span>Hero Points <strong>{character.heroPoints}</strong></span>
          </div>
        </div>
        <HealthOrb current={hp} max={hp} />
      </section>

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
      </div>
    </div>
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
      <Ornament label={casting ? `${casting.tradition.toUpperCase()} SPELLS` : 'CLASS DC'} />
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
                    <strong>{s.name}</strong>
                    <span className="muted"> · {/^\d$/.test(s.actions) ? `${s.actions} action${s.actions === '1' ? '' : 's'}` : s.actions}</span>
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
    </>
  );
}
