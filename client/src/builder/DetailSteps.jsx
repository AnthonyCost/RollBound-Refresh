import {
  ABILITIES,
  STARTING_GOLD_CP,
  attributes,
  skillPicks,
  languagePicks,
  ancestryFeatOptions,
  classFeatOptions,
  featSummary,
  featPrerequisites,
  spellcastingOf,
  spellOptions,
  spellDc,
  classDc,
  gearCost,
  formatPrice,
  lookup,
  buildProblems,
  buildCharacter,
  maxHp,
  armorClass,
  savingThrow,
  perception,
} from '@rollbound/rules';
import OptionList from './OptionList.jsx';
import Chips from './Chips.jsx';
import { ABILITY_SHORT, cap } from './labels.js';
import { signed } from '../format.js';

function AbilityTiles({ mods }) {
  return (
    <div className="abilities">
      {ABILITIES.map((a) => (
        <div key={a} className="ability">
          <span>{ABILITY_SHORT[a]}</span>
          <span>{signed(mods[a])}</span>
        </div>
      ))}
    </div>
  );
}

export function AttributesStep({ build, update, data }) {
  const { sources, mods } = attributes(build, data);
  const { ancestry } = lookup(build, data);

  const setSlot = (field, i, ability) => {
    const next = [...build[field]];
    next[i] = next[i] === ability ? null : ability;
    update({ [field]: next });
  };

  const toggleFree = (a) => {
    const on = build.freeBoosts.includes(a);
    if (!on && build.freeBoosts.length >= 4) return;
    update({ freeBoosts: on ? build.freeBoosts.filter((x) => x !== a) : [...build.freeBoosts, a] });
  };

  return (
    <>
      <AbilityTiles mods={mods} />

      {sources.map((s) => (
        <section key={s.id} className="panel">
          <h2 className="panel__title">{s.label}</h2>

          {s.id === 'ancestry' && ancestry && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={build.altAncestryBoosts}
                onChange={(e) => update({ altAncestryBoosts: e.target.checked, ancestryBoosts: [] })}
              />
              <span>Use alternate boosts: two free boosts and no flaw</span>
            </label>
          )}

          {s.id === 'free' ? (
            <Chips
              label="Free boosts"
              options={ABILITIES}
              isOn={(a) => build.freeBoosts.includes(a)}
              isDisabled={(a) => !build.freeBoosts.includes(a) && build.freeBoosts.length >= 4}
              onToggle={toggleFree}
              render={(a) => ABILITY_SHORT[a]}
            />
          ) : (
            s.slots.map((slot, i) => {
              const field = s.id === 'ancestry' ? 'ancestryBoosts' : s.id === 'background' ? 'backgroundBoosts' : null;
              const fixed = slot.length === 1;
              const takenElsewhere = (a) => s.boosts.some((b, j) => j !== i && b === a);
              return (
                <div key={i} className="boost-slot">
                  <span className="boost-slot__label">{fixed ? 'Fixed boost' : slot.length === 6 ? 'Free boost' : 'Boost one of'}</span>
                  <Chips
                    label={`${s.label} boost ${i + 1}`}
                    options={slot}
                    isOn={(a) => s.boosts[i] === a}
                    isDisabled={(a) => fixed || takenElsewhere(a)}
                    onToggle={(a) => (field ? setSlot(field, i, a) : update({ keyAbility: a }))}
                    render={(a) => ABILITY_SHORT[a]}
                  />
                </div>
              );
            })
          )}

          {s.flaws.length > 0 && (
            <p className="rule-note rule-note--warn">Flaw: −1 {s.flaws.map((f) => ABILITY_SHORT[f]).join(', ')}</p>
          )}
        </section>
      ))}
    </>
  );
}

export function SkillsStep({ build, update, data }) {
  const picks = skillPicks(build, data);
  const langs = languagePicks(build, data);
  const chosen = build.skills.filter((s) => !picks.fixed.has(s));
  const full = chosen.length >= picks.total;

  const toggleSkill = (s) =>
    update({ skills: build.skills.includes(s) ? build.skills.filter((x) => x !== s) : [...chosen, s] });
  const toggleLang = (l) =>
    update({ languages: build.languages.includes(l) ? build.languages.filter((x) => x !== l) : [...build.languages, l] });

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Already trained</h2>
        {picks.grants.length ? (
          <ul className="log">
            {picks.grants.map((g, i) => (
              <li key={i}>
                <strong>{cap(g.skill)}</strong> <span className="muted">from {g.from}</span>
              </li>
            ))}
            {build.lore && (
              <li>
                <strong>{build.lore}</strong> <span className="muted">from your background</span>
              </li>
            )}
          </ul>
        ) : (
          <p className="muted italic" style={{ margin: 0 }}>Choose a background and class first.</p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel__title">
          Choose {picks.total} skill{picks.total === 1 ? '' : 's'} · {chosen.length}/{picks.total}
        </h2>
        <p className="rule-note">
          {picks.fromClass} from your class{picks.fromInt > 0 && ` + ${picks.fromInt} from Intelligence`}
          {picks.overlaps > 0 && ` + ${picks.overlaps} because two sources trained the same skill`}.
        </p>
        <Chips
          label="Skills"
          options={data.skills}
          isOn={(s) => picks.fixed.has(s) || chosen.includes(s)}
          isDisabled={(s) => picks.fixed.has(s) || (full && !chosen.includes(s))}
          onToggle={toggleSkill}
          render={cap}
        />
      </section>

      <section className="panel">
        <h2 className="panel__title">
          Languages · {build.languages.length}/{langs.total} extra
        </h2>
        <p className="rule-note">
          You speak {langs.granted.map(cap).join(' and ') || 'your ancestry’s languages'}. Your ancestry and Intelligence let you
          learn {langs.total} more.
        </p>
        <Chips
          label="Languages"
          options={langs.options}
          isOn={(l) => build.languages.includes(l)}
          isDisabled={(l) => !build.languages.includes(l) && build.languages.length >= langs.total}
          onToggle={toggleLang}
          render={cap}
        />
      </section>
    </>
  );
}

const actionLabel = (a) => {
  if (a == null || a === '') return null;
  if (/^\d$/.test(String(a))) return `${a} action${String(a) === '1' ? '' : 's'}`;
  if (/^\d to \d$/.test(a)) return `${a} actions`;
  return cap(String(a));
};

const featMeta = (f) =>
  [actionLabel(f.actions), f.traits.filter((t) => t !== 'general' && t !== 'skill').map(cap).join(', ')]
    .filter(Boolean)
    .join(' · ');

function FeatPicker({ label, items, selected, onSelect, build, data, emptyText }) {
  const check = (f) => featPrerequisites(f, build, data);
  return (
    <OptionList
      label={label}
      items={items}
      selected={selected}
      onSelect={onSelect}
      meta={featMeta}
      emptyText={emptyText}
      blocked={(f) => {
        const pre = check(f);
        return pre.met ? null : `Requires ${pre.failed.join('; ')}`;
      }}
      note={(f) => {
        const pre = check(f);
        return pre.unknown.length ? `Check yourself: ${pre.unknown.join('; ')}` : null;
      }}
    />
  );
}

export function FeatsStep({ build, update, data }) {
  const { cls } = lookup(build, data);
  const { owned, slots } = featSummary(build, data);
  const granted = owned.filter((o) => o.kind === 'granted');

  return (
    <>
      <h2 className="panel__title builder__subhead">Ancestry feat</h2>
      <FeatPicker
        label="Ancestry feats"
        items={ancestryFeatOptions(build, data)}
        selected={build.ancestryFeat}
        onSelect={(slug) => update({ ancestryFeat: slug })}
        build={build}
        data={data}
        emptyText="Choose an ancestry first."
      />

      <h2 className="panel__title builder__subhead">Class feat</h2>
      {cls && !cls.classFeatAt1 ? (
        <p className="rule-note">{cls.name}s don't get a class feat at 1st level; their first one comes at 2nd.</p>
      ) : (
        <FeatPicker
          label="Class feats"
          items={classFeatOptions(build, data)}
          selected={build.classFeat}
          onSelect={(slug) => update({ classFeat: slug })}
          build={build}
          data={data}
          emptyText="Choose a class first."
        />
      )}

      {slots.map((slot) => (
        <section key={slot.parent.slug} className="options">
          <h2 className="panel__title builder__subhead">Bonus feat from {slot.parent.name}</h2>
          <FeatPicker
            label={`Bonus feat from ${slot.parent.name}`}
            items={slot.options.filter((f) => f.slug !== slot.parent.slug)}
            selected={slot.chosen}
            onSelect={(slug) => update({ bonusFeats: { ...build.bonusFeats, [slot.parent.slug]: slug } })}
            build={build}
            data={data}
          />
        </section>
      ))}

      {granted.length > 0 && (
        <>
          <h2 className="panel__title builder__subhead">Granted automatically</h2>
          {granted.map(({ feat, from }) => (
            <details key={feat.slug} className="feature">
              <summary>
                {feat.name} <span className="feature__from">from {from}</span>
              </summary>
              <div className="option__desc" dangerouslySetInnerHTML={{ __html: feat.description }} />
            </details>
          ))}
        </>
      )}

      <p className="rule-note">
        Feats whose prerequisites you don't meet are locked. Prerequisites the builder can't check, like your age, are listed for you to
        confirm with your GM.
      </p>
    </>
  );
}

const SPELL_LIST_NAME = {
  repertoire: 'Spell repertoire',
  prepared: 'Prepared today',
  spellbook: 'Spellbook',
  familiar: "Your familiar's spells",
};

const SPELL_NOTE = {
  repertoire: 'These are the spells you know. You can cast any of them using your spell slots.',
  prepared: 'You prepare spells each morning from every common spell on your list. These are today’s picks; you can change them each day.',
  spellbook: 'Your spellbook holds these. Each morning you prepare some of them into your spell slots.',
  familiar: 'Your familiar holds the spells your patron teaches you. Each morning you prepare some of them through your familiar.',
};

const spellMeta = (s) => [actionLabel(s.actions), s.range, s.area, s.defense && `${cap(s.defense)} save`].filter(Boolean).join(' · ');

export function SpellsStep({ build, update, data }) {
  const casting = spellcastingOf(build, data);
  const { cls } = lookup(build, data);

  if (!cls) return <p className="rule-note">Choose a class first.</p>;
  if (!casting) return <p className="rule-note">{cls.name}s don't cast spells at 1st level. Skip ahead to gear.</p>;
  if (casting.kind === 'focus') {
    return <p className="rule-note">Champions don't choose spells: your devotion spells come from your cause. They're listed in your class features.</p>;
  }
  if (!casting.tradition) return <p className="rule-note">Choose your {cls.slug === 'sorcerer' ? 'bloodline' : 'patron'} first; it sets your spell tradition.</p>;

  const { cantrips, spells } = spellOptions(build, data);
  const toggle = (field, max) => (slug) => {
    const list = build[field];
    if (list.includes(slug)) update({ [field]: list.filter((s) => s !== slug) });
    else if (list.length < max) update({ [field]: [...list, slug] });
  };
  const full = (field, max) => (s) => (!build[field].includes(s.slug) && build[field].length >= max ? `You've chosen ${max}` : null);

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">
          {SPELL_LIST_NAME[casting.kind]} · {cap(casting.tradition)}
        </h2>
        <p className="rule-note" style={{ margin: 0 }}>
          {SPELL_NOTE[casting.kind]} You have {casting.slots} 1st-rank spell slots a day; cantrips are free to cast.
          {casting.prepares && ` You prepare ${casting.prepares.cantrips} cantrips and ${casting.prepares.spells} spells each day.`}
        </p>
      </section>

      {casting.granted.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">Granted by your {cls.slug === 'sorcerer' ? 'bloodline' : 'class'}</h2>
          <ul className="log">
            {casting.granted.map((s) => (
              <li key={s.slug}>
                <strong>{s.name}</strong> <span className="muted">{s.rank === 0 ? 'cantrip' : '1st rank'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="panel__title builder__subhead">
        Cantrips · {build.cantrips.length}/{casting.cantrips}
      </h2>
      <OptionList
        label="Cantrips"
        items={cantrips}
        selected={build.cantrips}
        multiple
        onSelect={toggle('cantrips', casting.cantrips)}
        meta={spellMeta}
        blocked={full('cantrips', casting.cantrips)}
      />

      <h2 className="panel__title builder__subhead">
        1st-rank spells · {build.spells.length}/{casting.spells}
      </h2>
      <OptionList
        label="1st-rank spells"
        items={spells}
        selected={build.spells}
        multiple
        onSelect={toggle('spells', casting.spells)}
        meta={spellMeta}
        blocked={full('spells', casting.spells)}
      />
    </>
  );
}

export function GearStep({ build, update, data }) {
  const { cls } = lookup(build, data);
  const spent = gearCost(build, data);
  const left = STARTING_GOLD_CP - spent;
  const untrained = (rank) => (cls && rank === 'untrained' ? `Your class is untrained with this` : null);

  const toggle = (field) => (slug) => update({ [field]: build[field] === slug ? null : slug });
  const toggleWeapon = (slug) =>
    update({ weapons: build.weapons.includes(slug) ? build.weapons.filter((w) => w !== slug) : [...build.weapons, slug] });

  return (
    <>
      <section className={`panel ${left < 0 ? 'panel--hot' : ''} budget`}>
        <span>
          Spent <strong>{formatPrice(spent)}</strong> of 15 gp
        </span>
        <span className={left < 0 ? 'rule-note--warn' : 'muted'}>{left < 0 ? `${formatPrice(-left)} over` : `${formatPrice(left)} left`}</span>
      </section>

      <h2 className="panel__title builder__subhead">Armor</h2>
      <OptionList
        label="Armor"
        items={data.armor}
        selected={build.armor}
        onSelect={toggle('armor')}
        meta={(a) => `${cap(a.category)} · AC +${a.acBonus}${a.dexCap != null ? ` · Dex cap +${a.dexCap}` : ''}${a.strength ? ` · Str +${a.strength}` : ''} · ${formatPrice(a.price)}`}
        warn={(a) => untrained(cls?.defenses[a.category])}
      />

      <h2 className="panel__title builder__subhead">Shield</h2>
      <OptionList
        label="Shields"
        items={data.shields}
        selected={build.shield}
        onSelect={toggle('shield')}
        meta={(s) => `AC +${s.acBonus} when raised · Hardness ${s.hardness} · ${formatPrice(s.price)}`}
      />

      <h2 className="panel__title builder__subhead">Weapons</h2>
      <p className="rule-note">The first weapon you pick is the one your Turn screen strikes with.</p>
      <OptionList
        label="Weapons"
        items={data.weapons}
        selected={build.weapons}
        multiple
        onSelect={toggleWeapon}
        meta={(w) =>
          `1d${w.die} ${w.damageType} · ${cap(w.category)}${w.range ? ` · Range ${w.range} ft` : ''} · ${formatPrice(w.price)}${
            build.weapons[0] === w.slug ? ' · Primary' : ''
          }`
        }
        warn={(w) => untrained(cls?.attacks[w.category])}
      />
    </>
  );
}

export function ReviewStep({ build, update, data, goTo }) {
  const problems = buildProblems(build, data).filter((p) => p.step !== 'review');
  const character = problems.length ? null : buildCharacter({ ...build, name: build.name || 'Unnamed' }, data);

  return (
    <>
      <label className="form-field">
        <span>Character name</span>
        <input value={build.name} maxLength={60} onChange={(e) => update({ name: e.target.value })} placeholder="Mira Ashvale" />
      </label>

      {problems.length > 0 && (
        <section className="panel panel--hot">
          <h2 className="panel__title">Still to do</h2>
          <ul className="todo">
            {problems.map((p, i) => (
              <li key={i}>
                <button type="button" className="todo__link" onClick={() => goTo(p.step)}>
                  <span className="eyebrow">{p.step}</span> {p.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {character && (
        <section className="panel">
          <h2 className="panel__title">
            {character.ancestry.name} {character.className}
          </h2>
          <p className="rule-note center" style={{ marginTop: 0 }}>
            {character.heritage} · {character.background}
          </p>
          <div className="stats" style={{ marginBottom: 10 }}>
            {[
              ['HP', maxHp(character)],
              ['AC', armorClass(character).total],
              ['FORT', signed(savingThrow(character, 'fortitude').total)],
              ['REF', signed(savingThrow(character, 'reflex').total)],
              ['WILL', signed(savingThrow(character, 'will').total)],
            ].map(([k, v]) => (
              <div key={k} className="stat">
                <span className="stat__label">{k}</span>
                <span className="stat__value">{v}</span>
              </div>
            ))}
          </div>
          <AbilityTiles mods={character.abilities} />
          <ul className="log" style={{ marginTop: 12 }}>
            <li>
              Perception {signed(perception(character).total)} · Class DC {classDc(character).total}
              {character.spellcasting && ` · Spell DC ${spellDc(character).total}`}
            </li>
            {character.deity && (
              <li>
                Deity: {character.deity.name}
                {character.deity.sanctification !== 'none' && ` (${character.deity.sanctification})`}
                {character.deity.font && ` · ${cap(character.deity.font)} font`}
              </li>
            )}
            {character.spellcasting && (
              <li>Spells: {[...character.spellcasting.cantrips, ...character.spellcasting.spells].map((s) => s.name).join(', ')}</li>
            )}
            <li>Skills: {[...Object.keys(character.skills).map(cap), ...character.lores].join(', ')}</li>
            <li>Feats: {character.feats.map((f) => f.name).join(', ')}</li>
            <li>
              Gear: {[character.armor?.name, character.shield?.name, ...character.weapons.map((w) => w.name)].filter(Boolean).join(', ')}
            </li>
          </ul>
        </section>
      )}
    </>
  );
}
