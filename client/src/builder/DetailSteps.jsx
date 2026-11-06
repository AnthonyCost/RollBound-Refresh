import { useEffect, useState } from 'react';
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
  runesOf,
  runeOptions,
  weaponRank,
  proficienciesOf,
  spellDc,
  classDc,
  gearCost,
  formatPrice,
  lookup,
  buildProblems,
  buildCharacter,
  maxHp,
  armorAllowed,
  armorClass,
  equipCharacter,
  landSpeed,
  swimSpeed,
  savingThrow,
  perception,
  keyAbilityOf,
  abilityName,
  loresOf,
  skillCheck,
  SKILL_ABILITY,
  levelOf,
} from '@rollbound/rules';
import Chips from './Chips.jsx';
import ChoiceHeading from './ChoiceHeading.jsx';
import ActionCost from '../components/ActionCost.jsx';
import RankPips from '../components/RankPips.jsx';
import BookSpread from '../components/BookSpread.jsx';
import BookLeaf, { ChosenActions, wide } from './BookLeaf.jsx';
import { ABILITY_SHORT, cap, sourceTag } from './labels.js';
import { cardArtFor } from './art.js';
import { gearFacts } from './gearFacts.js';
import { starterGear } from './armoryGear.js';
import { loadArmory, loadItemDetails } from '../state/armory.js';
import { sentenceCase, signed, titleCase } from '../format.js';

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

const FIELD_OF = { ancestry: 'ancestryBoosts', background: 'backgroundBoosts' };

/**
 * Attributes as a ledger: a column for each attribute and a row for each source of
 * boosts (ancestry, background, class, free, and the boosts at levels 5, 10, 15 and 20),
 * with the totals beneath. Clicking a cell boosts that attribute from that source,
 * filling whichever of the source's slots it fits (the most limited first), or removes
 * the boost. only: show just that source's row (the Level step shows one level's boosts).
 */
export function BoostLedger({ build, update, data, only = null }) {
  const { sources, mods, partial } = attributes(build, data);
  const key = keyAbilityOf(build, data);

  // Where a new boost of `a` from source s would go: the empty slot that allows it, most limited first.
  const slotFor = (s, a) =>
    s.slots
      .map((slot, i) => ({ slot, i }))
      .filter(({ slot, i }) => s.boosts[i] == null && slot.includes(a))
      .sort((x, y) => x.slot.length - y.slot.length)[0]?.i ?? -1;

  const cell = (s, a) => {
    const at = s.boosts.indexOf(a);
    if (at >= 0) return { on: true, locked: s.slots[at].length === 1, i: at };
    return { on: false, i: slotFor(s, a) };
  };

  const toggle = (s, a) => {
    const c = cell(s, a);
    if (c.locked || (!c.on && c.i < 0)) return;
    if (s.id === 'free') {
      update({ freeBoosts: c.on ? build.freeBoosts.filter((x) => x !== a) : [...build.freeBoosts, a] });
    } else if (s.id === 'class') {
      update({ keyAbility: c.on ? null : a });
    } else if (s.level) {
      const next = [...s.boosts];
      next[c.i] = c.on ? null : a;
      update({ levels: build.levels.map((e, i) => (i === s.level - 2 ? { ...e, boosts: next } : e)) });
    } else {
      const field = FIELD_OF[s.id];
      const next = [...build[field]];
      next[c.i] = c.on ? null : a;
      update({ [field]: next });
    }
  };

  const filled = (s) => s.boosts.filter(Boolean).length;
  const describe = (s) => (s.id === 'class' ? (s.slots[0].length === 1 ? 'Fixed' : `One of ${s.slots[0].map((a) => ABILITY_SHORT[a]).join(', ')}`) : s.slots.map((slot) => (slot.length === 1 ? ABILITY_SHORT[slot[0]] : slot.length === 6 ? 'free' : slot.map((a) => ABILITY_SHORT[a]).join('/'))).join(' · '));

  return (
    <div className="ledger__scroll">
      <table className="ledger__table">
        <thead>
          <tr>
            <th scope="col" className="ledger__source">Source</th>
            {ABILITIES.map((a) => (
              <th key={a} scope="col">
                <abbr title={abilityName(a)}>{ABILITY_SHORT[a]}</abbr>
                {a === key && <span className="ledger__crown" title="Key attribute"> ♛<span className="visually-hidden"> (key attribute)</span></span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sources.filter((s) => !only || s.id === only).map((s) => (
            <tr key={s.id}>
              <th scope="row" className="ledger__source">
                <span className="ledger__label">{s.id === 'free' ? 'Free boosts' : s.label}</span>
                <span className={`ledger__count ${filled(s) === s.slots.length ? 'ledger__count--done' : ''}`}>
                  {filled(s)}/{s.slots.length} · {describe(s)}
                </span>
              </th>
              {ABILITIES.map((a) => {
                const c = cell(s, a);
                const flaw = s.flaws.includes(a);
                const open = c.on || c.i >= 0;
                return (
                  <td key={a} className={flaw ? 'ledger__flawed' : ''}>
                    {open ? (
                      <button
                        type="button"
                        className={`ledger__cell ${c.on ? 'ledger__cell--on' : ''}`}
                        aria-pressed={c.on}
                        disabled={c.locked}
                        aria-label={`${c.on ? 'Remove the' : 'Boost'} ${abilityName(a)} ${c.on ? 'boost ' : ''}from ${s.id === 'free' ? 'your free boosts' : s.label}${c.locked ? ' (fixed)' : ''}`}
                        onClick={() => toggle(s, a)}
                      >
                        {c.on ? '+1' : ''}
                      </button>
                    ) : (
                      <span className="ledger__cell ledger__cell--closed" aria-hidden="true" />
                    )}
                    {flaw && <span className="ledger__flaw" title="Flaw">−1<span className="visually-hidden"> flaw</span></span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="ledger__source">Modifier</th>
            {ABILITIES.map((a) => (
              <td key={a} className={`ledger__total ${mods[a] > 0 ? 'ledger__total--up' : mods[a] < 0 ? 'ledger__total--down' : ''}`}>{signed(mods[a])}
                {partial.has(a) && <span className="ledger__partial" title="A partial boost: one more raises this by 1">+½<span className="visually-hidden"> (a partial boost)</span></span>}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function AttributesStep({ build, update, data }) {
  const { ancestry } = lookup(build, data);

  return (
    <>
      <section className="panel ledger" aria-labelledby="ledger-title">
        <div className="pack__head">
          <h2 id="ledger-title" className="choice-head__title">Boost ledger</h2>
          <span className="muted">Each boost adds 1. A source can't boost the same attribute twice.</span>
        </div>
        <BoostLedger build={build} update={update} data={data} />
        {ancestry && (
          <label className="toggle" style={{ margin: 0 }}>
            <input type="checkbox" checked={build.altAncestryBoosts} onChange={(e) => update({ altAncestryBoosts: e.target.checked, ancestryBoosts: [] })} />
            <span>{ancestry.name}: use alternate boosts (two free boosts and no flaw)</span>
          </label>
        )}
      </section>
      <p className="rule-note">Most characters put their highest modifier, +4 at 1st level, in their key attribute ♛.</p>
    </>
  );
}

// A trained skill at 1st level adds +3 (trained +2, plus your level).
const TRAINED_AT_1 = 3;
/**
 * Skills as the character sheet lists them: every skill on one line with its
 * attribute, proficiency, modifier, and a button to train it (or where its training
 * comes from). Then languages.
 */
export function SkillsStep({ build, update, data }) {
  const picks = skillPicks(build, data);
  const langs = languagePicks(build, data);
  const { mods } = attributes(build, data);
  const chosen = build.skills.filter((s) => !picks.fixed.has(s));
  const full = chosen.length >= picks.total;
  const fromOf = Object.fromEntries(picks.grants.map((g) => [g.skill, g.from]));
  const lores = loresOf(build, data);
  const skills = [...data.skills].sort();

  const toggleSkill = (s) =>
    update({ skills: build.skills.includes(s) ? build.skills.filter((x) => x !== s) : [...chosen, s] });
  const toggleLang = (l) =>
    update({ languages: build.languages.includes(l) ? build.languages.filter((x) => x !== l) : [...build.languages, l] });

  return (
    <>
      <section className="panel choice" aria-labelledby="skills-title">
        <div className="choice-head">
          <h2 id="skills-title" className="choice-head__title">Skills</h2>
          <span className={`choice-head__status ${full && picks.total > 0 ? 'choice-head__status--done' : ''}`}>
            {full && picks.total > 0 ? '✓ ' : ''}
            {chosen.length} of {picks.total} chosen
          </span>
        </div>
        <p className="rule-note">
          Train {picks.total}: {picks.fromClass} from your class{picks.fromInt > 0 && ` + ${picks.fromInt} from Intelligence`}
          {picks.overlaps > 0 && ` + ${picks.overlaps} because two sources trained the same skill`}. A trained skill adds +{TRAINED_AT_1} at 1st level.
        </p>
        <div className="ledger__scroll">
          <table className="skill-sheet">
            <thead>
              <tr>
                <th scope="col" className="skill-sheet__skill">Skill</th>
                <th scope="col">Attr</th>
                <th scope="col">
                  <abbr title="Trained, expert, master, legendary">Prof</abbr>
                </th>
                <th scope="col">Mod</th>
                <th scope="col" className="skill-sheet__status"><span className="visually-hidden">Training</span></th>
              </tr>
            </thead>
            <tbody>
              {skills.map((s) => {
                const ab = SKILL_ABILITY[s];
                const fixed = picks.fixed.has(s);
                const picked = chosen.includes(s);
                const trained = fixed || picked;
                return (
                  <tr key={s} className={fixed ? 'skill-sheet--fixed' : picked ? 'skill-sheet--on' : ''}>
                    <th scope="row" className="skill-sheet__skill">{cap(s)}</th>
                    <td className="skill-sheet__attr">{ABILITY_SHORT[ab]}</td>
                    <td><RankPips rank={trained ? 'trained' : 'untrained'} /></td>
                    <td className="skill-sheet__mod">{signed(mods[ab] + (trained ? TRAINED_AT_1 : 0))}</td>
                    <td className="skill-sheet__status">
                      {fixed ? (
                        <span className="skill-sheet__from">from {fromOf[s] ?? 'your choices'}</span>
                      ) : picked ? (
                        <button type="button" className="skill-sheet__btn skill-sheet__btn--on" aria-label={`Untrain ${cap(s)}`} onClick={() => toggleSkill(s)}>
                          Your pick <span aria-hidden="true">✕</span>
                        </button>
                      ) : (
                        <button type="button" className="skill-sheet__btn" disabled={full} aria-label={`Train ${cap(s)}, for ${signed(mods[ab] + TRAINED_AT_1)}`} onClick={() => toggleSkill(s)}>
                          Train
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {lores.map((l) => (
                <tr key={l} className="skill-sheet--fixed">
                  <th scope="row" className="skill-sheet__skill">{l}</th>
                  <td className="skill-sheet__attr">INT</td>
                  <td><RankPips rank="trained" /></td>
                  <td className="skill-sheet__mod">{signed(mods.int + TRAINED_AT_1)}</td>
                  <td className="skill-sheet__status">
                    <span className="skill-sheet__from">from {l === build.lore?.trim() ? 'your background' : lookup(build, data).cls?.lores?.includes(l) ? 'your class' : 'a feat'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!picks.grants.length && <p className="muted italic" style={{ margin: 0 }}>Choose a background and class first; they train some skills for you.</p>}
      </section>

      <section className="panel choice" aria-labelledby="langs-title">
        <div className="choice-head">
          <h2 id="langs-title" className="choice-head__title">Languages</h2>
          <span className={`choice-head__status ${langs.total > 0 && build.languages.length >= langs.total ? 'choice-head__status--done' : ''}`}>
            {build.languages.length} of {langs.total} extra
          </span>
        </div>
        <p className="rule-note">
          You speak {langs.granted.map(cap).join(' and ') || 'your ancestry’s languages'}. Your ancestry and Intelligence let you learn {langs.total} more.
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

export const featMeta = (f) =>
  [actionLabel(f.actions), f.traits.filter((t) => t !== 'general' && t !== 'skill').map(cap).join(', ')]
    .filter(Boolean)
    .join(' · ');

/** The feat slots a level 1 character fills: ancestry, class (most classes), and bonus slots from feats or heritage. */
function featSlots(build, data) {
  const { ancestry, cls } = lookup(build, data);
  const { slots: bonus } = featSummary(build, data);
  return [
    ancestry && { key: 'ancestry', name: 'Ancestry feat', tab: 'Ancestry', options: ancestryFeatOptions(build, data), chosen: build.ancestryFeat, field: 'ancestryFeat' },
    cls?.classFeatAt1 && { key: 'class', name: 'Class feat', tab: 'Class', options: classFeatOptions(build, data), chosen: build.classFeat, field: 'classFeat' },
    ...bonus.map((slot) => ({
      key: `bonus:${slot.parent.id}`,
      name: `Bonus feat from ${slot.parent.name}`,
      tab: slot.parent.name,
      options: slot.options.filter((f) => f.id !== slot.parent.id),
      chosen: slot.chosen,
      parent: slot.parent.id,
    })),
  ].filter(Boolean);
}

/** A feat as the right-hand page: what it needs, its full text, and the choose button for its slot. */
export function FeatLeaf({ item, build, data, onChoose, onRemove, onClose }) {
  const { feat: f, slot } = item;
  const pre = featPrerequisites(f, build, data);
  const chosen = slot.chosen === f.id;
  const replacing = !chosen && slot.chosen ? data.feats.find((x) => x.id === slot.chosen)?.name : null;
  return (
    <BookLeaf
      eyebrow={`${slot.name} · ${sourceTag(f.source)}${f.rarity !== 'common' ? ` · ${f.rarity}` : ''}`}
      title={f.name}
      facts={[
        ['Level', f.level],
        ['Actions', actionLabel(f.actions)],
        ['Traits', f.traits.map(cap).join(', ')],
        ['Prerequisites', f.prerequisites.join('; ')],
      ]}
      notes={
        <>
          {!pre.met && <p className="rule-note rule-note--warn">Requires {pre.failed.join('; ')}, which you don't meet yet.</p>}
          {pre.unknown.length > 0 && <p className="rule-note">Check yourself: {pre.unknown.join('; ')}.</p>}
        </>
      }
      description={f.description}
      onClose={onClose}
    >
      {chosen ? (
        <ChosenActions label={`Your ${slot.name.toLowerCase()}`} onRemove={onRemove} />
      ) : (
        <>
          <button type="button" className="btn btn--blood" disabled={!pre.met} onClick={onChoose}>Choose {f.name}</button>
          {replacing && <span className="rule-note">Replaces {replacing}.</span>}
        </>
      )}
    </BookLeaf>
  );
}

export function FeatsStep({ build, update, data }) {
  const { cls } = lookup(build, data);
  const { owned } = featSummary(build, data);
  const granted = owned.filter((o) => o.kind === 'granted');
  const slots = featSlots(build, data);
  // Every slot's options in one index, a section per slot. A feat can be an option for
  // more than one slot, so each entry's id includes its slot.
  const items = slots.flatMap((slot) =>
    [...slot.options].sort((a, b) => a.name.localeCompare(b.name)).map((f) => ({ id: `${slot.key}:${f.id}`, name: f.name, feat: f, slot })),
  );
  const sections = slots.map((slot) => ({ key: slot.key, tab: slot.tab, name: slot.name }));
  const [openId, setOpenId] = useState(() => {
    const first = slots.find((slot) => slot.chosen);
    return wide() && first ? `${first.key}:${first.chosen}` : null;
  });
  const open = items.find((i) => i.id === openId) ?? null;
  const choose = (slot, id) => update(slot.parent ? { bonusFeats: { ...build.bonusFeats, [slot.parent]: id } } : { [slot.field]: id });
  const nameOf = (id) => data.feats.find((f) => f.id === id)?.name;

  return (
    <>
      <section className="choice" aria-label="Feats">
        <div className="feat-slots">
          {slots.map((slot) => (
            <ChoiceHeading key={slot.key} title={slot.name} chosen={slot.chosen && nameOf(slot.chosen)} level={3} />
          ))}
        </div>
        {cls && !cls.classFeatAt1 && <p className="rule-note">{cls.name}s don't get a class feat at 1st level; their first one comes at 2nd.</p>}
        {!slots.length && <p className="rule-note">Choose an ancestry and a class first.</p>}

        {slots.length > 0 && (
          <BookSpread
            items={items}
            total={items.length}
            noun="feats"
            sections={sections}
            sectionOf={(i) => i.slot.key}
            tabsOnTop
            open={open}
            onOpen={(i) => setOpenId(i.id)}
            marked={(i) => i.slot.chosen === i.feat.id}
            blocked={(i) => {
              const pre = featPrerequisites(i.feat, build, data);
              return pre.met ? null : `Requires ${pre.failed.join('; ')}`;
            }}
            meta={(i) => featMeta(i.feat)}
            emptyText="No feats to choose from here."
            leaf={open && (
              <FeatLeaf
                key={open.id}
                item={open}
                build={build}
                data={data}
                onChoose={() => choose(open.slot, open.feat.id)}
                onRemove={() => choose(open.slot, null)}
                onClose={() => setOpenId(null)}
              />
            )}
            blankIcon="feats"
            blank={
              <>
                <p className="book__blank-title">Choose your feats</p>
                <p className="rule-note">Open a feat from the index to read it here. Each tab is one of your feat slots. Feats you don't meet the prerequisites for are grayed out.</p>
              </>
            }
          />
        )}
      </section>

      {granted.length > 0 && (
        <>
          <h2 className="panel__title builder__subhead">Granted automatically</h2>
          {granted.map(({ feat, from }) => (
            <details key={feat.id} className="feature">
              <summary>
                {feat.name} <span className="feature__from">from {from}</span>
              </summary>
              <div className="option__desc" dangerouslySetInnerHTML={{ __html: feat.description }} />
            </details>
          ))}
        </>
      )}

      <p className="rule-note">
        Prerequisites the builder can't check, like your age, are listed on the feat for you to confirm with your GM.
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


/**
 * A builder book for picking several options from groups, each with its own limit:
 * cantrips and rank 1 spells, or a runesmith's runes. groups: [{ key, tab, name,
 * field, max, options }]; each group is a tab across the top and a line in the summary.
 * leaf(item, { chosen, full, add, remove, close }) draws the open option's page.
 */
function PicksBook({ groups, build, update, noun, meta, leaf, blank, blankIcon }) {
  const items = groups.flatMap((g) =>
    [...g.options].sort((a, b) => a.name.localeCompare(b.name)).map((o) => ({ id: `${g.key}:${o.id}`, name: o.name, option: o, group: g })),
  );
  const [openId, setOpenId] = useState(() => {
    const g = groups.find((x) => build[x.field].length);
    return wide() && g ? `${g.key}:${build[g.field][0]}` : null;
  });
  const open = items.find((i) => i.id === openId) ?? null;
  const isChosen = (i) => build[i.group.field].includes(i.option.id);
  const isFull = (g) => build[g.field].length >= g.max;
  const add = (i) => !isFull(i.group) && update({ [i.group.field]: [...build[i.group.field], i.option.id] });
  const remove = (i) => update({ [i.group.field]: build[i.group.field].filter((x) => x !== i.option.id) });

  return (
    <section className="choice" aria-label={noun}>
      <div className="feat-slots">
        {groups.map((g) => {
          const n = build[g.field].length;
          return <ChoiceHeading key={g.key} title={g.name} chosen={n >= g.max && `${n} of ${g.max}`} need={`${n} of ${g.max} chosen`} level={3} />;
        })}
      </div>
      <BookSpread
        items={items}
        total={items.length}
        noun={noun}
        sections={groups.map((g) => ({ key: g.key, tab: g.tab, name: g.name }))}
        sectionOf={(i) => i.group.key}
        tabsOnTop
        open={open}
        onOpen={(i) => setOpenId(i.id)}
        marked={isChosen}
        blocked={(i) => (!isChosen(i) && isFull(i.group) ? `You've chosen ${i.group.max}` : null)}
        meta={(i) => meta(i.option)}
        emptyText={`No ${noun} to choose from.`}
        leaf={open && leaf(open, { chosen: isChosen(open), full: isFull(open.group), add: () => add(open), remove: () => remove(open), close: () => setOpenId(null) })}
        blank={blank}
        blankIcon={blankIcon}
      />
    </section>
  );
}

/** A runesmith's runic repertoire: the runes they know and can trace or etch. */
function RunesPicker({ build, update, data, known }) {
  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Runic repertoire</h2>
        <p className="rule-note" style={{ margin: 0 }}>
          Runesmiths don't cast spells. You learn runes, which you trace in the air with the Trace Rune action or etch onto
          allies and gear during your daily preparations (up to 2 at a time at 1st level). Invoking a rune unleashes a
          stronger effect and uses it up.
        </p>
      </section>
      <PicksBook
        groups={[{ key: 'runes', tab: 'Runes', name: '1st-level runes', field: 'runes', max: known, options: runeOptions(build, data) }]}
        build={{ ...build, runes: build.runes ?? [] }}
        update={update}
        noun="runes"
        meta={(r) => r.usage && r.usage[0].toUpperCase() + r.usage.slice(1)}
        leaf={(i, { chosen, full, add, remove, close }) => (
          <BookLeaf
            eyebrow={`Rune · ${sourceTag(i.option.source)}`}
            title={i.option.name}
            facts={[['Usage', i.option.usage && cap(i.option.usage)], ['Traits', i.option.traits.map(cap).join(', ')]]}
            description={i.option.description}
            onClose={close}
          >
            {chosen ? <ChosenActions label="In your repertoire" onRemove={remove} /> : (
              <>
                <button type="button" className="btn btn--blood" disabled={full} onClick={add}>Learn {i.option.name}</button>
                {full && <span className="rule-note">You know {known} runes. Remove one to learn this.</span>}
              </>
            )}
          </BookLeaf>
        )}
        blankIcon="runes"
        blank={
          <>
            <p className="book__blank-title">Choose your runes</p>
            <p className="rule-note">Open a rune from the index to read it here, then learn it.</p>
          </>
        }
      />
    </>
  );
}

// What "adding" a spell means for each kind of caster.
const SPELL_ADD = { repertoire: 'Add to your repertoire', prepared: 'Prepare it', spellbook: 'Add to your spellbook', familiar: 'Add to your familiar' };
const SPELL_HAVE = { repertoire: 'In your repertoire', prepared: 'Prepared', spellbook: 'In your spellbook', familiar: 'Your familiar knows it' };

/** A spell as the right-hand page, with the button that adds it to (or removes it from) the caster's spells. */
export function SpellLeaf({ spell: s, kind, chosen, full, fullNote, add, remove, close }) {
  return (
    <BookLeaf
      eyebrow={`${s.rank === 0 ? 'Cantrip' : `Spell ${s.rank}`} · ${sourceTag(s.source)}${s.rarity !== 'common' ? ` · ${s.rarity}` : ''}`}
      title={s.name}
      facts={[
        ['Cast', <ActionCost key="cast" actions={s.actions} />],
        ['Range', sentenceCase(s.range)],
        ['Area', sentenceCase(s.area)],
        ['Targets', sentenceCase(s.target)],
        ['Defense', s.defense && titleCase(s.defense)],
        ['Duration', sentenceCase(s.duration)],
        ['Traits', s.traits.map(titleCase).join(', ')],
      ]}
      description={s.description}
      onClose={close}
    >
      {chosen ? <ChosenActions label={SPELL_HAVE[kind]} onRemove={remove} /> : (
        <>
          <button type="button" className="btn btn--blood" disabled={full} onClick={add}>{SPELL_ADD[kind]}</button>
          {full && <span className="rule-note">{fullNote}</span>}
        </>
      )}
    </BookLeaf>
  );
}

export function SpellsStep({ build, update, data }) {
  const casting = spellcastingOf(build, data);
  const { cls } = lookup(build, data);
  const runes = runesOf(build, data);

  if (!cls) return <p className="rule-note">Choose a class first.</p>;
  if (runes) return <RunesPicker build={build} update={update} data={data} known={runes.known} />;
  if (!casting) return <p className="rule-note">{cls.name}s don't cast spells at 1st level. Skip ahead to gear.</p>;
  if (casting.kind === 'focus') {
    return <p className="rule-note">Champions don't choose spells: your devotion spells come from your cause. They're listed in your class features.</p>;
  }
  // The subclass feature that sets the tradition (a sorcerer's Bloodline, a witch's Patron).
  const traditionFeature = cls.features.find((f) => f.choice?.options.some((o) => o.tradition || o.traditionChoice))?.name.toLowerCase() ?? 'class options';
  if (!casting.tradition) return <p className="rule-note">Choose your {traditionFeature} first; it sets your spell tradition.</p>;

  const { cantrips, spells } = spellOptions(build, data);
  const listName = casting.listName ? cap(casting.listName) : SPELL_LIST_NAME[casting.kind];
  const groups = [
    casting.cantrips > 0 && { key: 'c', tab: 'Cantrips', name: 'Cantrips', field: 'cantrips', max: casting.cantrips, options: cantrips },
    casting.spells > 0 && { key: '1', tab: 'Rank 1', name: '1st-rank spells', field: 'spells', max: casting.spells, options: spells },
  ].filter(Boolean);

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">{listName} · {cap(casting.tradition)}</h2>
        <p className="rule-note" style={{ margin: 0 }}>
          {SPELL_NOTE[casting.kind]} You have {casting.slots} 1st-rank spell slot{casting.slots === 1 ? '' : 's'} a day; cantrips are free to cast.
          {casting.prepares && ` You prepare ${casting.prepares.cantrips} cantrips and ${casting.prepares.spells} spell${casting.prepares.spells === 1 ? '' : 's'} each day.`}
        </p>
      </section>

      {casting.granted.length > 0 && (
        <section className="panel">
          <h2 className="panel__title">Always known</h2>
          <ul className="log">
            {casting.granted.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> <span className="muted">{s.rank === 0 ? 'cantrip' : '1st rank'}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <PicksBook
        groups={groups}
        build={build}
        update={update}
        noun="spells"
        meta={(s) => (
          <>
            {s.rarity !== 'common' && <span className={`tag tag--rarity-${s.rarity}`}>{s.rarity}</span>}
            <ActionCost actions={s.actions} />
          </>
        )}
        leaf={(i, { chosen, full, add, remove, close }) => {
          return (
            <SpellLeaf spell={i.option} kind={casting.kind} chosen={chosen} full={full} add={add} remove={remove} close={close}
              fullNote={`You've chosen ${i.group.max} ${i.group.name.toLowerCase()}. Remove one to add this.`} />
          );
        }}
        blankIcon="spells"
        blank={
          <>
            <p className="book__blank-title">Choose your spells</p>
            <p className="rule-note">Open a spell from the index to read it here. The tabs switch between cantrips and 1st-rank spells.</p>
          </>
        }
      />
    </>
  );
}

const GEAR_SECTIONS = [
  { key: 'armor', tab: 'Armor', name: 'Armor' },
  { key: 'shield', tab: 'Shields', name: 'Shields' },
  { key: 'weapon', tab: 'Weapons', name: 'Weapons' },
  { key: 'gear', tab: 'Gear', name: 'Adventuring gear' },
  { key: 'consumable', tab: 'Consumables', name: 'Consumables' },
];
const KIND_LABEL = { armor: 'Armor', shield: 'Shield', weapon: 'Weapon', gear: 'Gear', consumable: 'Consumable' };
const isArmoryGear = (i) => i.kind === 'gear' || i.kind === 'consumable';

/**
 * Gear as a merchant's ledger: your pack and purse above, then a book of armor, shields
 * and weapons. Open an item to see its numbers, then buy it (armor and shields replace
 * the one you have) or sell it back. The first weapon is the one the Combat tab uses.
 */
export function GearStep({ build, update, data }) {
  const { cls } = lookup(build, data);
  const spent = gearCost(build, data);
  const left = STARTING_GOLD_CP - spent;
  // Class plus subclass training (a Ruffian is trained in medium armor), so warnings match the sheet.
  const prof = cls ? proficienciesOf(build, data) : null;
  const untrainedWith = (i) => {
    if (!cls) return false;
    if (i.kind === 'armor') return prof.armor[i.item.category] === 'untrained';
    if (i.kind === 'weapon') return weaponRank({ proficiencies: prof }, i.item) === 'untrained';
    return false;
  };
  const byName = (a, b) => a.name.localeCompare(b.name);
  // Everything else from the armory loads behind the rest: armor, shields and weapons show at once.
  const [armoryGear, setArmoryGear] = useState([]);
  useEffect(() => {
    let live = true;
    loadArmory().then((a) => live && setArmoryGear(starterGear(a)), () => {});
    return () => { live = false; };
  }, []);
  const gear = build.gear ?? [];
  const qtyOf = (id) => gear.find((g) => g.id === id)?.qty ?? 0;
  const items = [
    // Armor a build can't start with stays listed if it's already in the pack, so it can be sold.
    ...data.armor.filter((a) => a.id === build.armor || armorAllowed(a, build, data)).sort(byName).map((a) => ({ id: `armor:${a.id}`, name: a.name, kind: 'armor', item: a })),
    ...[...data.shields].sort(byName).map((x) => ({ id: `shield:${x.id}`, name: x.name, kind: 'shield', item: x })),
    ...[...data.weapons].sort(byName).map((w) => ({ id: `weapon:${w.id}`, name: w.name, kind: 'weapon', item: w })),
    ...armoryGear,
  ];
  // Search by name or trait across every tab (what's in the pack stays listed, so it can be sold).
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? items.filter((i) => i.name.toLowerCase().includes(q) || i.item.traits?.some((t) => t.toLowerCase().includes(q))) : items;
  const owns = (i) => (isArmoryGear(i) ? qtyOf(i.item.id) > 0 : i.kind === 'weapon' ? build.weapons.includes(i.item.id) : build[i.kind] === i.item.id);
  const [openId, setOpenId] = useState(() => {
    const first = build.armor ? `armor:${build.armor}` : build.weapons[0] ? `weapon:${build.weapons[0]}` : build.shield ? `shield:${build.shield}` : null;
    return wide() ? first : null;
  });
  const open = items.find((i) => i.id === openId) ?? null;

  // Armory gear stacks (two potions, ten torches); armor and a shield replace, weapons add.
  const buyGear = (x) =>
    update({ gear: qtyOf(x.id) ? gear.map((g) => (g.id === x.id ? { ...g, qty: g.qty + 1 } : g)) : [...gear, { id: x.id, name: x.name, price: x.price, bulk: x.bulk, qty: 1 }] });
  const sellGear = (id) => update({ gear: gear.flatMap((g) => (g.id !== id ? [g] : g.qty > 1 ? [{ ...g, qty: g.qty - 1 }] : [])) });
  const buy = (i) => (isArmoryGear(i) ? buyGear(i.item) : update(i.kind === 'weapon' ? { weapons: [...build.weapons, i.item.id] } : { [i.kind]: i.item.id }));
  const sell = (i) => (isArmoryGear(i) ? sellGear(i.item.id) : update(i.kind === 'weapon' ? { weapons: build.weapons.filter((w) => w !== i.item.id) } : { [i.kind]: null }));
  const makePrimary = (id) => update({ weapons: [id, ...build.weapons.filter((w) => w !== id)] });

  const find = (list, id) => list.find((x) => x.id === id);
  const pack = [
    build.armor && { kind: 'armor', item: find(data.armor, build.armor) },
    build.shield && { kind: 'shield', item: find(data.shields, build.shield) },
    ...build.weapons.map((id, n) => ({ kind: 'weapon', item: find(data.weapons, id), primary: n === 0 })),
    ...gear.map((g) => ({ kind: 'gear', item: g, qty: g.qty })),
  ].filter((p) => p && p.item);

  return (
    <>
      <section className={`panel pack ${left < 0 ? 'panel--hot' : ''}`} aria-labelledby="pack-title">
        <div className="pack__head">
          <h2 id="pack-title" className="choice-head__title">Your pack</h2>
          <span className={left < 0 ? 'rule-note--warn' : 'muted'}>{left < 0 ? `${formatPrice(-left)} over budget` : `${formatPrice(left)} left`}</span>
        </div>
        <div
          className={`purse ${left < 0 ? 'purse--over' : ''}`}
          role="meter"
          aria-label="Starting gold spent"
          aria-valuemin={0}
          aria-valuemax={STARTING_GOLD_CP}
          aria-valuenow={Math.min(spent, STARTING_GOLD_CP)}
          aria-valuetext={`${formatPrice(spent)} of 15 gp`}
        >
          <span className="purse__fill" style={{ width: `${Math.min(100, (spent / STARTING_GOLD_CP) * 100)}%` }} />
        </div>
        {pack.length ? (
          <ul className="pack__list">
            {pack.map((p) => (
              <li key={`${p.kind}:${p.item.id}`}>
                <span className="pack__name">
                  {p.primary && <span className="pack__star" title="Primary weapon">★<span className="visually-hidden"> Primary weapon:</span></span>}
                  {p.item.name}
                  {p.qty > 1 && <span className="pack__qty"> ×{p.qty}</span>}
                </span>
                {p.kind === 'weapon' && !p.primary && (
                  <button type="button" className="link-button" onClick={() => makePrimary(p.item.id)}>Make primary</button>
                )}
                <span className="pack__dots" aria-hidden="true" />
                {p.kind === 'gear' && (
                  <button type="button" className="link-button" aria-label={`Remove one ${p.item.name}`} onClick={() => sellGear(p.item.id)}>Remove</button>
                )}
                <span className="pack__price">{formatPrice(p.item.price * (p.qty ?? 1))}</span>
              </li>
            ))}
            <li className="pack__total">
              <span className="pack__name">Total</span>
              <span className="pack__dots" aria-hidden="true" />
              <span className="pack__price">{formatPrice(spent)} of 15 gp</span>
            </li>
          </ul>
        ) : (
          <p className="muted italic" style={{ margin: 0 }}>Nothing yet. You have 15 gp to spend on armor, a shield, weapons, gear and consumables.</p>
        )}
        {build.weapons.length > 1 && <p className="rule-note" style={{ margin: 0 }}>★ Your primary weapon is the one you Strike with on the Combat tab.</p>}
      </section>

      <div className="filters" role="search">
        <label className="filters__field filters__field--wide">
          <span className="filters__label">Search</span>
          <input
            className="options__search"
            type="search"
            value={query}
            placeholder={`Search ${items.length} items by name or trait: rope, potion, healing…`}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {q && <p className="filters__count">{shown.length ? `${shown.length} match${shown.length === 1 ? '' : 'es'}` : `Nothing matches “${query.trim()}”.`}</p>}
      </div>

      <BookSpread
        items={shown}
        total={items.length}
        noun="items"
        resetKey={q}
        filtered={Boolean(q)}
        sections={GEAR_SECTIONS}
        sectionOf={(i) => i.kind}
        tabsOnTop
        open={open}
        onOpen={(i) => setOpenId(i.id)}
        marked={owns}
        meta={(i) => (
          <>
            {untrainedWith(i) && <span className="tag tag--warn">Untrained</span>}
            {i.item.rarity === 'uncommon' && <span className="tag tag--rare">Uncommon</span>}
            {qtyOf(i.item.id) > 1 && <span>×{qtyOf(i.item.id)}</span>}
            <span>{formatPrice(i.item.price)}</span>
          </>
        )}
        emptyText={q ? `Nothing matches “${query.trim()}”.` : "Nothing for sale."}
        leaf={open && (
          <GearLeaf
            key={open.id}
            i={open}
            owned={owns(open)}
            qty={isArmoryGear(open) ? qtyOf(open.item.id) : 0}
            primary={open.kind === 'weapon' && build.weapons[0] === open.item.id}
            untrained={untrainedWith(open)}
            replacing={open.kind !== 'weapon' && build[open.kind] && build[open.kind] !== open.item.id ? find(open.kind === 'armor' ? data.armor : data.shields, build[open.kind])?.name : null}
            over={left - (owns(open) && !isArmoryGear(open) ? 0 : open.item.price) < 0}
            onBuy={() => buy(open)}
            onSell={() => sell(open)}
            onPrimary={() => makePrimary(open.item.id)}
            onClose={() => setOpenId(null)}
          />
        )}
        blankIcon="inventory"
        blank={
          <>
            <p className="book__blank-title">The merchant's ledger</p>
            <p className="rule-note">Open an item from the index to see its numbers, then buy it. Armor and a shield replace the ones you have; you can carry several weapons, and buy gear and consumables more than once.</p>
          </>
        }
      />
    </>
  );
}

/** One item as the right-hand page: its numbers and traits, and buy or sell. */
function GearLeaf({ i, owned, qty = 0, primary, untrained, replacing, over, onBuy, onSell, onPrimary, onClose }) {
  const x = i.item;
  const stacks = isArmoryGear(i);
  // Armory gear's rules text loads from its category's file when it's opened.
  const [description, setDescription] = useState(null);
  useEffect(() => {
    if (!x.armory) return undefined;
    let live = true;
    loadItemDetails(x.armory).then((html) => live && setDescription(html), () => {});
    return () => { live = false; };
  }, [x.armory]);
  return (
    <BookLeaf
      eyebrow={`${x.category && stacks ? x.category : KIND_LABEL[i.kind]} · ${sourceTag(x.source)}${x.rarity && x.rarity !== 'common' ? ` · ${x.rarity}` : ''}`}
      title={x.name}
      facts={gearFacts(stacks ? 'item' : i.kind, x)}
      description={description}
      notes={
        <>
          {untrained && <p className="rule-note rule-note--warn">Your class is untrained with this, so you won't add your level to {i.kind === 'armor' ? 'AC' : 'attack rolls'} with it.</p>}
          {x.rarity === 'uncommon' && <p className="rule-note">Uncommon: ask your GM before buying it, since it needs access.</p>}
        </>
      }
      onClose={onClose}
    >
      {stacks ? (
        <>
          {qty > 0 && <ChosenActions label={`In your pack${qty > 1 ? ` ×${qty}` : ''}`} onRemove={onSell} removeLabel={qty > 1 ? 'Remove one' : 'Sell back'} />}
          <button type="button" className={`btn ${qty ? '' : 'btn--blood'}`} onClick={onBuy}>{qty ? 'Buy another' : 'Buy'} for {formatPrice(x.price)}</button>
          {over && <span className="rule-note rule-note--warn">That's more than you have left.</span>}
        </>
      ) : owned ? (
        <>
          <ChosenActions label={primary ? 'In your pack · primary' : 'In your pack'} onRemove={onSell} removeLabel="Sell back" />
          {i.kind === 'weapon' && !primary && <button type="button" className="btn" onClick={onPrimary}>Make primary</button>}
        </>
      ) : (
        <>
          <button type="button" className="btn btn--blood" onClick={onBuy}>Buy for {formatPrice(x.price)}</button>
          {replacing && <span className="rule-note">Replaces {replacing}.</span>}
          {over && <span className="rule-note rule-note--warn">That's more than you have left.</span>}
        </>
      )}
    </BookLeaf>
  );
}

const STEP_LABEL = { ancestry: 'Ancestry', background: 'Background', class: 'Class', classOptions: 'Class Options', attributes: 'Attributes', skills: 'Skills', feats: 'Feats', spells: 'Spells', gear: 'Gear', level: 'Level' };

/**
 * The finished page: the class banner behind the character's name (with the portrait
 * picker across from it, when one is passed in), what's still to do (each linking to its
 * step), then the character laid out as a two-page spread.
 */
export function ReviewStep({ build, update, data, goTo, inventory = null, portrait = null }) {
  const problems = buildProblems(build, data).filter((p) => p.step !== 'review');
  // A saved character's sheet wears what its inventory has equipped, so show the same here.
  const character = problems.length ? null : equipCharacter(buildCharacter({ ...build, name: build.name || 'Unnamed' }, data), inventory, data);
  const { ancestry, heritage, background, cls } = lookup(build, data);
  const banner = cls ? cardArtFor(cls.slug) : null;
  const line = [ancestry?.name, cls?.name].filter(Boolean).join(' ');
  const sub = [heritage?.name, background?.name].filter(Boolean).join(' · ');

  return (
    <>
      <header className={`review-hero ${portrait ? 'review-hero--portrait' : ''}`} style={banner ? { '--review-art': `url(${banner})` } : undefined}>
        {portrait && <div className="review-hero__portrait">{portrait}</div>}
        <div className="review-hero__main">
        <label className="review-hero__name">
          <span className="eyebrow">Character name</span>
          <input value={build.name} maxLength={60} onChange={(e) => update({ name: e.target.value })} placeholder="Brave Hero" aria-invalid={!build.name.trim()} aria-describedby="review-name-note" />
        </label>
        {!build.name.trim() && <p id="review-name-note" className="rule-note--warn">Name your character to save them.</p>}
        <p className="review-hero__line">
          Level {levelOf(build)}{line && ` ${line}`}
          {sub && <span className="muted"> · {sub}</span>}
        </p>
        </div>
      </header>

      {problems.length > 0 && (
        <section className="panel panel--hot" aria-labelledby="todo-title">
          <div className="choice-head">
            <h2 id="todo-title" className="choice-head__title">Still to do</h2>
            <span className="choice-head__status">{problems.length} left</span>
          </div>
          <ul className="todo">
            {problems.map((p, i) => (
              <li key={i}>
                <button type="button" className="todo__link" onClick={() => goTo(p.step)}>
                  <span className="todo__mark" aria-hidden="true" />
                  <span className="eyebrow">{STEP_LABEL[p.step] ?? p.step}</span> {p.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {character && (
        <>
          <div className="stats review__stats">
            {[
              ['HP', maxHp(character)],
              ['AC', armorClass(character).total],
              ['FORT', signed(savingThrow(character, 'fortitude').total)],
              ['REF', signed(savingThrow(character, 'reflex').total)],
              ['WILL', signed(savingThrow(character, 'will').total)],
              ['PERC', signed(perception(character).total)],
            ].map(([k, v]) => (
              <div key={k} className="stat">
                <span className="stat__label">{k}</span>
                <span className="stat__value">{v}</span>
              </div>
            ))}
          </div>
          <AbilityTiles mods={character.abilities} />

          <div className="review__spread">
            <section className="book__page review__page" aria-label="Who they are">
              <h2 className="book__section">Who they are</h2>
              <dl className="review__facts">
                <div><dt>Speed</dt><dd>{landSpeed(character).total} ft{swimSpeed(character) && `, swim ${swimSpeed(character)} ft`}</dd></div>
                <div><dt>Class DC</dt><dd>{classDc(character).total}</dd></div>
                {character.spellcasting && <div><dt>Spell DC</dt><dd>{spellDc(character).total}</dd></div>}
                {character.deity && (
                  <div>
                    <dt>Deity</dt>
                    <dd>
                      {character.deity.name}
                      {character.deity.sanctification && character.deity.sanctification !== 'none' && ` (${character.deity.sanctification})`}
                      {character.deity.font && ` · ${cap(character.deity.font)} font`}
                    </dd>
                  </div>
                )}
                <div><dt>Languages</dt><dd>{character.languages.map(cap).join(', ')}</dd></div>
              </dl>
              <h2 className="book__section">Skills</h2>
              <ul className="review__list">
                {[...data.skills.filter((sk) => character.skills[sk]).map((sk) => [cap(sk), skillCheck(character, sk).total]), ...character.lores.map((l) => [l, skillCheck(character, l).total])].map(([name, total]) => (
                  <li key={name}>
                    <span>{name}</span>
                    <span className="book__entry-dots" aria-hidden="true" />
                    <span className="review__num">{signed(total)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="book__page review__page" aria-label="What they bring">
              <h2 className="book__section">Feats</h2>
              <ul className="review__list">
                {character.feats.map((f) => (
                  <li key={f.id}>
                    <span>{f.name}</span>
                    <span className="book__entry-dots" aria-hidden="true" />
                    <span className="muted">{f.from}</span>
                  </li>
                ))}
              </ul>
              {character.spellcasting && (character.spellcasting.cantrips.length + character.spellcasting.spells.length > 0) && (
                <>
                  <h2 className="book__section">Spells</h2>
                  <ul className="review__list">
                    {[...character.spellcasting.cantrips, ...character.spellcasting.spells].map((sp) => (
                      <li key={sp.id ?? sp.slug}>
                        <span>{sp.name}</span>
                        <span className="book__entry-dots" aria-hidden="true" />
                        <span className="muted">{sp.rank === 0 ? 'Cantrip' : `Rank ${sp.rank}`}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h2 className="book__section">Gear</h2>
              <ul className="review__list">
                {[character.armor && [character.armor.name, 'Armor'], character.shield && [character.shield.name, 'Shield'], ...character.weapons.map((w, n) => [w.name, n === 0 ? 'Primary weapon' : 'Weapon'])]
                  .filter(Boolean)
                  .map(([name, kind]) => (
                    <li key={`${kind}:${name}`}>
                      <span>{name}</span>
                      <span className="book__entry-dots" aria-hidden="true" />
                      <span className="muted">{kind}</span>
                    </li>
                  ))}
              </ul>
              {!character.armor && !character.shield && !character.weapons.length && <p className="muted italic">No gear bought.</p>}
              {inventory && <p className="muted italic">This is what's equipped now. Change it on the Inventory tab.</p>}
            </section>
          </div>
        </>
      )}
    </>
  );
}
