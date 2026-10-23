import { loreOptions, lookup } from '@rollbound/rules';
import OptionList from './OptionList.jsx';
import Chips from './Chips.jsx';
import { SIZE, abilityList, boostSlotLabel, cap } from './labels.js';

const boostsLine = (slots) => slots.map(boostSlotLabel).join(', ');

export function AncestryStep({ build, update, data }) {
  const { ancestry, heritage } = lookup(build, data);
  const ownHeritages = data.heritages.filter((h) => h.ancestry === build.ancestry);
  const versatile = data.heritages.filter((h) => !h.ancestry);

  return (
    <>
      <OptionList
        label="Ancestries"
        items={data.ancestries}
        selected={build.ancestry}
        meta={(a) => `HP ${a.hp} · ${SIZE[a.size] ?? a.size} · Speed ${a.speed} ft · Boosts ${boostsLine(a.boosts)}${a.flaws.length ? ` · Flaw ${abilityList(a.flaws)}` : ''}`}
        onSelect={(slug) =>
          slug !== build.ancestry &&
          update({ ancestry: slug, heritage: null, heritageSkill: null, ancestryBoosts: [], ancestryFeat: null, languages: [] })
        }
      />

      {ancestry && (
        <>
          <h2 className="panel__title builder__subhead">{ancestry.name} heritages</h2>
          <OptionList
            label={`${ancestry.name} heritages`}
            items={ownHeritages}
            selected={build.heritage}
            onSelect={(slug) => update({ heritage: slug, heritageSkill: null, ancestryFeat: null })}
          />
          <h2 className="panel__title builder__subhead">Versatile heritages</h2>
          <p className="rule-note">A versatile heritage can belong to any ancestry, and opens up its own ancestry feats.</p>
          <OptionList
            label="Versatile heritages"
            items={versatile}
            selected={build.heritage}
            onSelect={(slug) => update({ heritage: slug, heritageSkill: null, ancestryFeat: null })}
          />
        </>
      )}

      {heritage?.skillChoice && (
        <section className="panel">
          <h2 className="panel__title">{heritage.name}: choose a skill</h2>
          <Chips
            label="Heritage skill"
            options={heritage.skillChoice.options ?? data.skills}
            isOn={(s) => build.heritageSkill === s}
            onToggle={(s) => update({ heritageSkill: s })}
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

  const select = (slug) => {
    if (slug === build.background) return;
    const bg = data.backgrounds.find((b) => b.slug === slug);
    const l = bg.lore[0] ? loreOptions(bg.lore[0]) : null;
    update({ background: slug, backgroundBoosts: [], lore: l?.fixed ?? '' });
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
            <Chips label="Lore" options={lore.options} isOn={(o) => build.lore === o} onToggle={(o) => update({ lore: o })} />
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
  const { cls } = lookup(build, data);

  const select = (slug) =>
    slug !== build.class && update({ class: slug, keyAbility: null, classSkill: null, classChoices: {}, classFeat: null });

  return (
    <>
      <OptionList
        label="Classes"
        items={data.classes}
        selected={build.class}
        onSelect={select}
        meta={(c) => `HP ${c.hp} + Con · Key ${abilityList(c.keyAbility)}${c.spellcasting ? ' · Spellcaster' : ''}`}
      />

      {cls && (
        <>
          <section className="panel">
            <h2 className="panel__title">{cls.name} training</h2>
            <p className="rule-note" style={{ margin: 0 }}>
              Perception {cap(cls.perception)} · Fortitude {cap(cls.saves.fortitude)} · Reflex {cap(cls.saves.reflex)} · Will{' '}
              {cap(cls.saves.will)}
            </p>
          </section>

          {cls.keyAbility.length > 1 && (
            <section className="panel">
              <h2 className="panel__title">Key attribute</h2>
              <p className="rule-note">Your key attribute gets a boost and sets your class DC.</p>
              <Chips
                label="Key attribute"
                options={cls.keyAbility}
                isOn={(a) => build.keyAbility === a}
                onToggle={(a) => update({ keyAbility: a })}
                render={(a) => abilityList([a])}
              />
            </section>
          )}

          {cls.skillChoice && (
            <section className="panel">
              <h2 className="panel__title">{cls.name} skill</h2>
              <Chips
                label="Class skill"
                options={cls.skillChoice}
                isOn={(s) => build.classSkill === s}
                onToggle={(s) => update({ classSkill: s })}
                render={cap}
              />
            </section>
          )}

          {cls.features.map((f) =>
            f.choice ? (
              <section key={f.name}>
                <h2 className="panel__title builder__subhead">{f.name}</h2>
                <OptionList
                  label={f.name}
                  items={f.choice.options}
                  selected={build.classChoices[f.choice.key] ?? null}
                  onSelect={(slug) => update({ classChoices: { ...build.classChoices, [f.choice.key]: slug } })}
                />
              </section>
            ) : (
              <details key={f.name} className="feature">
                <summary>{f.name}</summary>
                <div className="option__desc" dangerouslySetInnerHTML={{ __html: f.description }} />
              </details>
            ),
          )}
        </>
      )}
    </>
  );
}
