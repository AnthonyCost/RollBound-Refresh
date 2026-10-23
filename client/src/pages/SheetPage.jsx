import { useState } from 'react';
import { armorClass, savingThrow, perception, abilityName, skillCheck, SKILL_ABILITY } from '@rollbound/rules';
import { useTable } from '../state/TableContext.jsx';
import HealthOrb from '../components/HealthOrb.jsx';
import Breakdown from '../components/Breakdown.jsx';
import Ornament from '../components/Ornament.jsx';
import { signed, titleCase } from '../format.js';

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export default function SheetPage() {
  const { character, hp, conditions, shieldRaised } = useTable();
  const [selected, setSelected] = useState('ac');
  const [skill, setSkill] = useState(null);

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
    <>
      <section className="hero">
        <HealthOrb current={hp} max={hp} />
        <div>
          <h1 className="hero__name">{character.name}</h1>
          <p className="italic muted" style={{ margin: '2px 0 4px' }}>
            {character.ancestry.name} {character.className} · Level {character.level}
          </p>
          <div className="hero__meta">
            <span>Speed <strong>{character.ancestry.speed} ft</strong></span>
            <span>Hero Points <strong>{character.heroPoints}</strong></span>
          </div>
        </div>
      </section>

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
    </>
  );
}
