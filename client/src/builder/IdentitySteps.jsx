import { loreOptions, lookup, keyAbilityOptions, keyAbilityOf, sanctificationOptions, TRADITIONS } from '@rollbound/rules';
import OptionList from './OptionList.jsx';
import Showcase from './Showcase.jsx';
import Chips, { pick } from './Chips.jsx';
import { SIZE, abilityList, boostSlotLabel, cap } from './labels.js';

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
        <>
          <h2 className="panel__title builder__subhead">{ancestry.name} heritages</h2>
          <OptionList
            label={`${ancestry.name} heritages`}
            items={ownHeritages}
            selected={build.heritage}
            onSelect={(id) => update({ heritage: id, heritageSkill: null, ancestryFeat: null })}
          />
          <h2 className="panel__title builder__subhead">Versatile heritages</h2>
          <p className="rule-note">A versatile heritage can belong to any ancestry, and opens up its own ancestry feats.</p>
          <OptionList
            label="Versatile heritages"
            items={versatile}
            selected={build.heritage}
            onSelect={(id) => update({ heritage: id, heritageSkill: null, ancestryFeat: null })}
          />
        </>
      )}

      {heritage?.skillChoice && (
        <section className="panel">
          <h2 className="panel__title">{heritage.name}: choose a skill</h2>
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

export function BackgroundStep({ build, update, data }) {
  const { background } = lookup(build, data);
  const lore = background?.lore[0] ? loreOptions(background.lore[0]) : null;

  const select = (id) => {
    if (id === build.background) return;
    if (!id) return update({ background: null, backgroundBoosts: [], lore: '' });
    const bg = data.backgrounds.find((b) => b.id === id);
    const l = bg.lore[0] ? loreOptions(bg.lore[0]) : null;
    update({ background: id, backgroundBoosts: [], lore: l?.fixed ?? '' });
  };

  return (
    <>
      <OptionList
        label="Backgrounds"
        items={data.backgrounds}
        selected={build.background}
        onSelect={select}
        meta={(b) =>
          [`Boosts ${boostsLine(b.boosts)}`, b.skills.length && `Trained ${b.skills.map(cap).join(', ')}`].filter(Boolean).join(' · ')
        }
      />

      {lore && !lore.fixed && (
        <section className="panel">
          <h2 className="panel__title">Your Lore skill</h2>
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
            <section className="panel">
              <h2 className="panel__title">{cls.name} skill</h2>
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
            <section>
              <h2 className="panel__title builder__subhead">Deity</h2>
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
            <section className="panel">
              <h2 className="panel__title">Divine font</h2>
              <Chips label="Divine font" options={deity.font} isOn={(f) => build.font === f} onToggle={pick(build.font, (f) => update({ font: f }))} render={cap} />
            </section>
          )}

          {deity && sanctificationOptions(deity).length > 1 && (
            <section className="panel">
              <h2 className="panel__title">Sanctification</h2>
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
            <section className="panel">
              <h2 className="panel__title">Key attribute</h2>
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
              <section key={f.name} className="options">
                <h2 className="panel__title builder__subhead">{f.name}</h2>
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
                  <div className="panel">
                    <h2 className="panel__title">{option.name}: choose a skill</h2>
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
                  <div className="panel">
                    <h2 className="panel__title">{option.name}: spell tradition</h2>
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
