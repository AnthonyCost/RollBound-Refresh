import { useState } from 'react';
import { loreOptions, lookup, keyAbilityOptions, keyAbilityOf, sanctificationOptions, TRADITIONS } from '@rollbound/rules';
import OptionList from './OptionList.jsx';
import Showcase from './Showcase.jsx';
import Chips, { pick } from './Chips.jsx';
import ChoiceHeading from './ChoiceHeading.jsx';
import { ABILITY_SHORT, SIZE, abilityList, boostSlotLabel, cap } from './labels.js';

const boostsLine = (slots) => slots.map(boostSlotLabel).join(', ');

export function AncestryStep({ build, update, data }) {
  const { ancestry, heritage } = lookup(build, data);
  const ownHeritages = data.heritages.filter((h) => h.ancestry === build.ancestry);
  const versatile = data.heritages.filter((h) => !h.ancestry);

  return (
    <>
      <Showcase
        kind="ancestry"
        label="Ancestries"
        prompt="Choose your ancestry"
        items={data.ancestries}
        selected={build.ancestry}
        stats={(a) => [
          ['Hit Points', a.hp],
          ['Size', SIZE[a.size] ?? a.size],
          ['Speed', `${a.speed} ft`],
          ['Vision', cap(a.vision.replace(/-vision$/, ''))],
          ['Boosts', boostsLine(a.boosts)],
          ['Flaw', a.flaws.length ? abilityList(a.flaws) : 'None'],
        ]}
        onSelect={(id) =>
          id !== build.ancestry &&
          update({ ancestry: id, heritage: null, heritageSkill: null, ancestryBoosts: [], ancestryFeat: null, languages: [] })
        }
      />

      {ancestry && (
        <section className="choice" aria-label="Heritage">
          <ChoiceHeading title="Heritage" chosen={heritage?.name} />
          <h3 className="choice__group">{ancestry.name} heritages</h3>
          <OptionList
            label={`${ancestry.name} heritages`}
            items={ownHeritages}
            selected={build.heritage}
            onSelect={(id) => update({ heritage: id, heritageSkill: null, ancestryFeat: null })}
          />
          <h3 className="choice__group">Versatile heritages</h3>
          <p className="rule-note">A versatile heritage can belong to any ancestry, and opens up its own ancestry feats.</p>
          <OptionList
            label="Versatile heritages"
            items={versatile}
            selected={build.heritage}
            onSelect={(id) => update({ heritage: id, heritageSkill: null, ancestryFeat: null })}
          />
        </section>
      )}

      {heritage?.skillChoice && (
        <section className="panel choice">
          <ChoiceHeading title={`${heritage.name} skill`} chosen={build.heritageSkill && cap(build.heritageSkill)} />
          <Chips
            label="Heritage skill"
            options={heritage.skillChoice}
            isOn={(s) => build.heritageSkill === s}
            onToggle={pick(build.heritageSkill, (s) => update({ heritageSkill: s }))}
            render={cap}
          />
        </section>
      )}
    </>
  );
}

const ABILITY_KEYS = Object.keys(ABILITY_SHORT);
// A background's boost slots as short labels: "STR / INT", "Free".
const slotLabel = (slot) => (slot.length === 6 ? 'Free' : slot.map((a) => ABILITY_SHORT[a]).join(' / '));
// The attributes a background's limited boost offers (its other boost is free).
const limitedBoosts = (b) => b.boosts.filter((slot) => slot.length < 6).flat();

export function BackgroundStep({ build, update, data }) {
  const { background } = lookup(build, data);
  const lore = background?.lore[0] ? loreOptions(background.lore[0]) : null;
  // Filters: attributes the limited boost must offer (up to 2), a skill it trains, a book.
  const [boosts, setBoosts] = useState([]);
  const [skill, setSkill] = useState('');
  const [book, setBook] = useState('');
  const books = [...new Set(data.backgrounds.map((b) => b.source))];
  const skills = [...new Set(data.backgrounds.flatMap((b) => b.skills))].sort();
  const filtering = boosts.length > 0 || skill || book;
  const shown = data.backgrounds.filter(
    (b) => boosts.every((a) => limitedBoosts(b).includes(a)) && (!skill || b.skills.includes(skill)) && (!book || b.source === book),
  );
  // The chosen background stays in the list whatever the filters say.
  const items = background && !shown.includes(background) ? [background, ...shown] : shown;
  const clearFilters = () => {
    setBoosts([]);
    setSkill('');
    setBook('');
  };

  const select = (id) => {
    if (id === build.background) return;
    if (!id) return update({ background: null, backgroundBoosts: [], lore: '' });
    const bg = data.backgrounds.find((b) => b.id === id);
    const l = bg.lore[0] ? loreOptions(bg.lore[0]) : null;
    update({ background: id, backgroundBoosts: [], lore: l?.fixed ?? '' });
  };

  return (
    <>
      <section className="choice" aria-label="Background">
        <ChoiceHeading title="Background" chosen={background?.name} />
        <p className="rule-note">Your background gives two attribute boosts, training in a skill and a Lore, and a skill feat.</p>

        <div className="filters" role="group" aria-label="Filter backgrounds">
          <div className="filters__field filters__field--wide">
            <span className="filters__label" id="bg-boosts">Boosts</span>
            <Chips
              label="Backgrounds that can boost"
              options={ABILITY_KEYS}
              isOn={(a) => boosts.includes(a)}
              isDisabled={(a) => !boosts.includes(a) && boosts.length >= 2}
              onToggle={(a) => setBoosts((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]))}
              render={(a) => ABILITY_SHORT[a]}
            />
          </div>
          <label className="filters__field">
            <span className="filters__label">Trains</span>
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Any skill</option>
              {skills.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
            </select>
          </label>
          <label className="filters__field">
            <span className="filters__label">Book</span>
            <select value={book} onChange={(e) => setBook(e.target.value)}>
              <option value="">Any book</option>
              {books.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </label>
          <p className="filters__count" role="status">
            {filtering ? `${shown.length} of ${data.backgrounds.length} backgrounds` : `${data.backgrounds.length} backgrounds`}
            {filtering && <button type="button" className="chip" onClick={clearFilters}>Clear filters</button>}
          </p>
        </div>

        <OptionList
          label="Backgrounds"
          items={items}
          selected={build.background}
          onSelect={select}
          emptyText="No backgrounds match these filters."
          meta={(b) => (
            <span className="bg-meta">
              <span className="bg-meta__boosts">
                <span className="visually-hidden">Boosts: </span>
                {b.boosts.map((slot, i) => (
                  <span key={i} className={`ability-badge ${slot.length === 6 ? 'ability-badge--free' : ''}`}>{slotLabel(slot)}</span>
                ))}
              </span>
              {b.skills.length > 0 && <span className="bg-meta__skills">Trained in {b.skills.map(cap).join(', ')}</span>}
            </span>
          )}
        />
      </section>

      {lore && !lore.fixed && (
        <section className="panel choice">
          <ChoiceHeading title="Your Lore skill" chosen={build.lore?.trim()} need={lore.options ? 'Choose one' : 'Name it'} />
          {lore.options ? (
            <Chips label="Lore" options={lore.options} isOn={(o) => build.lore === o} onToggle={pick(build.lore, (o) => update({ lore: o ?? '' }))} />
          ) : (
            <label className="form-field">
              <span>{lore.placeholder}</span>
              <input value={build.lore} placeholder={lore.placeholder} maxLength={40} onChange={(e) => update({ lore: e.target.value })} />
              <small className="italic muted">Name the subject, for example “Forest Lore”. Ask your GM if you're unsure.</small>
            </label>
          )}
        </section>
      )}
    </>
  );
}

export function ClassStep({ build, update, data }) {
  const { cls, deity } = lookup(build, data);
  const keyOptions = keyAbilityOptions(build, data);

  const select = (id) =>
    id !== build.class &&
    update({
      class: id,
      keyAbility: null,
      classSkill: null,
      classChoices: {},
      classChoiceSkills: {},
      tradition: null,
      deity: null,
      font: null,
      sanctification: null,
      classFeat: null,
      bonusFeats: {},
      cantrips: [],
      spells: [],
    });

  const chooseOption = (key, id) =>
    update({
      classChoices: { ...build.classChoices, [key]: id },
      classChoiceSkills: { ...build.classChoiceSkills, [key]: null },
      tradition: null,
      keyAbility: null,
      cantrips: [],
      spells: [],
    });

  return (
    <>
      <Showcase
        kind="class"
        label="Classes"
        prompt="Choose your class"
        items={data.classes}
        selected={build.class}
        onSelect={select}
        stats={(c) => [
          ['HP per level', `${c.hp} + Con`],
          ['Key attribute', abilityList(c.keyAbility)],
          ['Perception', cap(c.perception)],
          ['Fort · Ref · Will', [c.saves.fortitude, c.saves.reflex, c.saves.will].map((r) => r[0].toUpperCase()).join(' · ')],
          ['Skills', `${c.trainedSkills.length + (c.skillChoice ? 1 : 0)} + ${c.additionalSkills} + Int`],
          ['Spellcasting', c.spellcasting ? 'Yes' : 'No'],
        ]}
      />

      {cls && (
        <>

          {cls.skillChoice && (
            <section className="panel choice">
              <ChoiceHeading title={`${cls.name} skill`} chosen={build.classSkill && cap(build.classSkill)} />
              <Chips
                label="Class skill"
                options={cls.skillChoice}
                isOn={(s) => build.classSkill === s}
                onToggle={pick(build.classSkill, (s) => update({ classSkill: s }))}
                render={cap}
              />
            </section>
          )}

          {cls.deity && (
            <section className="choice">
              <ChoiceHeading title="Deity" chosen={deity?.name} />
              <p className="rule-note">
                Your deity trains you in their divine skill{cls.deityFavoredWeapon ? ' and favored weapon' : ''}
                {cls.divineFont ? ', and sets your divine font' : ''}. Their
                sanctification decides whether you can be holy or unholy.
              </p>
              <OptionList
                label="Deities"
                items={data.deities}
                selected={build.deity}
                onSelect={(id) => id !== build.deity && update({ deity: id, font: null, sanctification: null })}
                meta={(d) =>
                  [
                    `Font ${d.font.join(' or ')}`,
                    `Skill ${d.skills.map(cap).join(', ')}`,
                    `Weapon ${d.weapons.map(cap).join(', ')}`,
                    d.sanctification ? `${d.sanctification.modal} be ${d.sanctification.what.join(' or ')}` : 'No sanctification',
                  ].join(' · ')
                }
              />
            </section>
          )}

          {deity && cls.divineFont && deity.font.length > 1 && (
            <section className="panel choice">
              <ChoiceHeading title="Divine font" chosen={build.font && cap(build.font)} />
              <Chips label="Divine font" options={deity.font} isOn={(f) => build.font === f} onToggle={pick(build.font, (f) => update({ font: f }))} render={cap} />
            </section>
          )}

          {deity && sanctificationOptions(deity).length > 1 && (
            <section className="panel choice">
              <ChoiceHeading title="Sanctification" chosen={build.sanctification && (build.sanctification === 'none' ? 'Neither' : cap(build.sanctification))} />
              <Chips
                label="Sanctification"
                options={sanctificationOptions(deity)}
                isOn={(o) => build.sanctification === o}
                onToggle={pick(build.sanctification, (o) => update({ sanctification: o }))}
                render={(o) => (o === 'none' ? 'Neither' : cap(o))}
              />
            </section>
          )}

          {keyOptions.length > 1 && (
            <section className="panel choice">
              <ChoiceHeading title="Key attribute" chosen={keyAbilityOf(build, data) && abilityList([keyAbilityOf(build, data)])} />
              <p className="rule-note">Your key attribute gets a boost and sets your class DC.</p>
              <Chips
                label="Key attribute"
                options={keyOptions}
                isOn={(a) => keyAbilityOf(build, data) === a}
                onToggle={pick(build.keyAbility, (a) => update({ keyAbility: a }))}
                render={(a) => abilityList([a])}
              />
            </section>
          )}

          {cls.features.map((f) => {
            if (!f.choice) {
              return (
                <details key={f.name} className="feature">
                  <summary>{f.name}</summary>
                  <div className="option__desc" dangerouslySetInnerHTML={{ __html: f.description }} />
                </details>
              );
            }
            const option = f.choice.options.find((o) => o.id === build.classChoices[f.choice.key]);
            return (
              <section key={f.name} className="choice">
                <ChoiceHeading title={f.name} chosen={option?.name} />
                <OptionList
                  label={f.name}
                  items={f.choice.options}
                  selected={build.classChoices[f.choice.key] ?? null}
                  onSelect={(id) => id !== build.classChoices[f.choice.key] && chooseOption(f.choice.key, id)}
                  meta={(o) =>
                    [
                      o.skills.length && `Trained ${o.skills.map(cap).join(', ')}`,
                      o.tradition && !o.traditionChoice && `${cap(o.tradition)} spells`,
                      o.tags.includes('holy') && 'Must be holy',
                      o.tags.includes('unholy') && 'Must be unholy',
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                />
                {option?.skillChoice && (
                  <div className="panel choice">
                    <ChoiceHeading title={`${option.name} skill`} chosen={build.classChoiceSkills[f.choice.key] && cap(build.classChoiceSkills[f.choice.key])} level={3} />
                    <Chips
                      label={`${option.name} skill`}
                      options={option.skillChoice}
                      isOn={(s) => build.classChoiceSkills[f.choice.key] === s}
                      onToggle={pick(build.classChoiceSkills[f.choice.key], (s) => update({ classChoiceSkills: { ...build.classChoiceSkills, [f.choice.key]: s } }))}
                      render={cap}
                    />
                  </div>
                )}
                {option?.traditionChoice && (
                  <div className="panel choice">
                    <ChoiceHeading title={`${option.name} tradition`} chosen={build.tradition && cap(build.tradition)} level={3} />
                    <p className="rule-note">Your tradition comes from the kind of creature in your bloodline. Pick the one that matches.</p>
                    <Chips
                      label="Tradition"
                      options={TRADITIONS}
                      isOn={(t) => build.tradition === t}
                      onToggle={pick(build.tradition, (t) => update({ tradition: t, cantrips: [], spells: [] }))}
                      render={cap}
                    />
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
