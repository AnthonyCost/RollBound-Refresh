import { useState } from 'react';
import { mira, armorClass, savingThrow, perception, skillCheck, strikeBonus, damageModifier, abilityName } from '@rollbound/rules';
import RankPips from '../components/RankPips.jsx';
import DetailsDrawer from '../components/DetailsDrawer.jsx';
import { SKILLS } from '../sheet/sheetRules.js';
import { signed, titleCase } from '../format.js';

/*
 * Style lab, palette tab: RollBound's real components recoloured with the palette from
 * Guild Wars 2: Path of Fire's site (guildwars2.com/en/path-of-fire). The specimen is the
 * site's own markup and classes; the .pof wrapper only swaps the colour tokens (and the
 * few colours theme.css hard-codes), so this shows what a re-theme would actually look like.
 */

// Taken from the page's computed styles.
const SWATCHES = [
  { hex: '#0F040F', name: 'Plum black', role: 'Page background', token: '--bg' },
  { hex: '#230217', name: 'Wine', role: 'Panels', token: '--panel' },
  { hex: '#4F0537', name: 'Deep magenta', role: 'Glow behind the page', token: '--glow' },
  { hex: '#B51983', name: 'Magenta', role: 'Decoration, borders', token: '--line' },
  { hex: '#EA600D', name: 'Fire', role: 'Primary buttons, active states', token: '--blood' },
  { hex: '#FF6D10', name: 'Flame', role: 'Headings, labels, links', token: '--bronze' },
  { hex: '#7A0D19', name: 'Ember', role: 'Button shadow end', token: '--blood-dark' },
  { hex: '#FFF15D', name: 'Spark', role: 'Highlights, key items', token: '--gold' },
  { hex: '#FFECB6', name: 'Parchment', role: 'Text', token: '--text' },
];

const c = mira;
const weapon = c.weapons[0];

function Specimen() {
  const [open, setOpen] = useState('athletics');
  const check = skillCheck(c, open);
  const detail = {
    kind: 'Skill',
    name: titleCase(open),
    icon: SKILLS[open].icon,
    stat: check,
    rank: check.rank,
    ability: check.ability,
    rules: SKILLS[open].rules,
    uses: SKILLS[open].uses,
  };
  const defs = [
    ['ac', 'Armor Class', armorClass(c).total, c.proficiencies.armor[c.armor.category]],
    ['fortitude', 'Fortitude', signed(savingThrow(c, 'fortitude').total), c.proficiencies.fortitude],
    ['reflex', 'Reflex', signed(savingThrow(c, 'reflex').total), c.proficiencies.reflex],
    ['will', 'Will', signed(savingThrow(c, 'will').total), c.proficiencies.will],
    ['perception', 'Perception', signed(perception(c).total), c.proficiencies.perception],
  ];

  return (
    <div className="pal-specimen">
      <div className="pal-specimen__main">
        <header className="list-head">
          <div>
            <h1 className="title">{c.name}</h1>
            <p className="list-head__count">Level 1 · Human · Fighter</p>
          </div>
          <div className="btn-row">
            <button type="button" className="btn">Edit character</button>
            <button type="button" className="btn btn--blood">Start encounter</button>
          </div>
        </header>

        <div className="condition-row">
          <button type="button" className="chip" aria-pressed="true">FRIGHTENED 1</button>
          <button type="button" className="chip" aria-pressed="false">OFF-GUARD</button>
          <button type="button" className="chip" aria-pressed="false">PRONE</button>
        </div>

        <p className="panel panel--hot" style={{ margin: 0 }}>
          The rules data changed since Mira was built. Her choices still work, but a few numbers on this sheet are different now.
        </p>

        <section className="sheet-attrs" aria-label="Attribute modifiers">
          {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((a) => (
            <div key={a} className={`sheet-attr ${a === c.keyAbility ? 'sheet-attr--key' : ''}`}>
              <span className="sheet-attr__short">{a.toUpperCase()}</span>
              <span className="sheet-attr__value">{signed(c.abilities[a])}</span>
              <span className="sheet-attr__name">{abilityName(a)}</span>
            </div>
          ))}
        </section>

        <section className="sheet-panel sheet-defense" aria-label="Defenses">
          {defs.map(([id, label, value, rank]) => (
            <button key={id} type="button" className={`sheet-def sheet-def--${id}`} aria-pressed={id === 'ac'}>
              <span className="sheet-def__label">{label}</span>
              <span className="sheet-def__value">{value}</span>
              <RankPips rank={rank} />
            </button>
          ))}
        </section>

        <div className="pal-cols">
          <section className="sheet-panel" aria-labelledby="pal-skills">
            <h2 id="pal-skills" className="sheet-panel__title">Skills</h2>
            <ul className="sheet-skills">
              {['acrobatics', 'athletics', 'intimidation', 'stealth'].map((id) => {
                const s = skillCheck(c, id);
                return (
                  <li key={id}>
                    <button type="button" className="sheet-skill" aria-pressed={open === id} onClick={() => setOpen(id)}>
                      <span className="sheet-skill__name">{titleCase(id)}</span>
                      <span className="sheet-skill__attr">{s.ability.toUpperCase()}</span>
                      <RankPips rank={s.rank} />
                      <span className="sheet-skill__total">{signed(s.total)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
          <section className="sheet-panel" aria-labelledby="pal-strikes">
            <h2 id="pal-strikes" className="sheet-panel__title">Strikes</h2>
            <ul className="sheet-strikes">
              <li>
                <button type="button" className="sheet-strike">
                  <span className="sheet-strike__bonus">{signed(strikeBonus(c, weapon).total)}</span>
                  <span className="sheet-strike__main">
                    <span className="sheet-strike__name">{weapon.name}</span>
                    <span className="sheet-strike__traits">{weapon.traits.join(', ')}</span>
                  </span>
                  <span className="sheet-strike__damage">1d{weapon.die} {signed(damageModifier(weapon, c.abilities))} {weapon.damageType}</span>
                </button>
              </li>
            </ul>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="pal-ac">Target AC</label>
              <input id="pal-ac" type="number" defaultValue={16} />
            </div>
          </section>
        </div>
      </div>

      {/* The real drawer, held in place here instead of sliding over the page. */}
      <div className="pal-specimen__drawer">
        <DetailsDrawer detail={detail} onClose={() => {}} inline />
      </div>
    </div>
  );
}

export default function StyleLabPalette() {
  const [palette, setPalette] = useState('pof');
  return (
    <div className="lab-col pal">
      <section className="lab-study" aria-labelledby="pal-title">
        <header className="lab-study__head">
          <h2 id="pal-title">Path of Fire palette</h2>
          <p>
            Colours from <a href="https://www.guildwars2.com/en/path-of-fire/" target="_blank" rel="noreferrer">Guild Wars 2: Path of Fire</a>:
            plum-black and wine for the ground, magenta for decoration, a fire-orange gradient for actions, and gold and parchment for highlights and text.
            The type stays RollBound’s.
          </p>
        </header>
        <ul className="pal-swatches">
          {SWATCHES.map((s) => (
            <li key={s.hex}>
              <span className="pal-swatch" style={{ background: s.hex }} />
              <span className="pal-swatch__name">{s.name}</span>
              <span className="pal-swatch__hex">{s.hex}</span>
              <span className="pal-swatch__role">{s.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="lab-study" aria-labelledby="pal-specimen">
        <header className="lab-study__head pal-head">
          <div>
            <h2 id="pal-specimen">On the character sheet</h2>
            <p>The sheet’s real components. Tap a skill to change what the drawer shows.</p>
          </div>
          <div className="lab-toggle" role="group" aria-label="Colours">
            {[['today', 'Today'], ['pof', 'Path of Fire']].map(([id, label]) => (
              <button key={id} type="button" aria-pressed={palette === id} onClick={() => setPalette(id)}>{label}</button>
            ))}
          </div>
        </header>
        <div className={`pal-stage ${palette === 'pof' ? 'pof' : ''}`}>
          <Specimen />
        </div>
      </section>
    </div>
  );
}
