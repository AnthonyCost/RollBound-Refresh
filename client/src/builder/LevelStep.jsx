import { useState } from 'react';
import {
  MAX_LEVEL, RANKS, buildProblems, entryFor, featPrerequisites, featSummary, levelDown, levelFeatOptions, levelOf, levelPlan,
  levelSpellOptions, levelUp, maxSkillRank, skillRanksOf, spellcastingOf,
} from '@rollbound/rules';
import BookSpread from '../components/BookSpread.jsx';
import ActionCost from '../components/ActionCost.jsx';
import ChoiceHeading from './ChoiceHeading.jsx';
import Chips, { pick } from './Chips.jsx';
import { wide } from './BookLeaf.jsx';
import { BoostLedger, FeatLeaf, SpellLeaf, featMeta } from './DetailSteps.jsx';
import { cap } from './labels.js';

const FEAT_FIELDS = [['classFeat', 'Class feat', 'Class'], ['ancestryFeat', 'Ancestry feat', 'Ancestry'], ['skillFeat', 'Skill feat', 'Skill'], ['generalFeat', 'General feat', 'General']];
const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Levels 2-20: a level counter, a track of the levels reached (each with what's left to
 * choose), and the open level's page: the class features it brings, its feats and new
 * spells as a book (like the Feats step), its skill increase, boosts and feature choices.
 */
export function LevelStep({ build, update, data }) {
  const level = levelOf(build);
  const problems = buildProblems(build, data).filter((p) => p.step === 'level');
  const todo = (lv) => problems.filter((p) => p.message.startsWith(`Level ${lv}:`));
  const [picked, setOpen] = useState(() => Array.from({ length: level - 1 }, (_, i) => i + 2).find((lv) => todo(lv).length) ?? level);
  const open = Math.min(Math.max(picked, 2), level);
  const left = problems.length;

  if (!data.classes.some((c) => c.id === build.class)) return <p className="rule-note">Choose a class first.</p>;

  return (
    <div className="level-step">
      <section className="panel level-head" aria-label="Character level">
        <div className="level-head__row">
          <button type="button" className="btn level-head__step" aria-label="Level down" disabled={level <= 1} onClick={() => update(levelDown(build))}>−</button>
          <div className="level-head__now" aria-live="polite">
            <span className="eyebrow">Level</span>
            <span className="level-head__num">{level}</span>
          </div>
          <button type="button" className="btn btn--blood level-head__step" aria-label="Level up" disabled={level >= MAX_LEVEL} onClick={() => { update(levelUp(build)); setOpen(level + 1); }}>+</button>
        </div>
        <p className="rule-note center" style={{ margin: 0 }}>
          {level === 1 ? 'Starting at 1st level? You’re done here. Level up to start higher.' : left ? `${left} thing${left === 1 ? '' : 's'} left to choose.` : 'Every level is filled in.'}
        </p>
        {level > 1 && (
          <nav aria-label="Levels">
            <ol className="level-track">
              {Array.from({ length: level - 1 }, (_, i) => i + 2).map((lv) => {
                const n = todo(lv).length;
                return (
                  <li key={lv}>
                    <button type="button" className={`level-track__tile ${n ? '' : 'level-track__tile--done'}`} aria-current={lv === open ? 'true' : undefined} onClick={() => setOpen(lv)}>
                      <span className="level-track__num"><span className="visually-hidden">Level </span>{lv}</span>
                      <span className="level-track__state">{n ? `${n} to do` : '✓ Done'}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        )}
      </section>

      {level > 1 && <LevelPage key={open} level={open} build={build} update={update} data={data} todo={todo(open)} />}
    </div>
  );
}

/** One level's choices. Keyed by level, so the open book entry resets when you switch levels. */
function LevelPage({ level, build, update, data, todo }) {
  const plan = levelPlan(build, data, level);
  const entry = entryFor(build, level);
  const at = { ...build, level };
  const setEntry = (patch) => update({ levels: build.levels.map((e, i) => (i === level - 2 ? { ...e, ...patch } : e)) });
  const nameOf = (id) => data.feats.find((f) => f.id === id)?.name;

  // The feat slots and the new spells share one book, a tab each.
  const slots = FEAT_FIELDS.filter(([field]) => plan[field]).map(([field, name, tab]) => ({ key: field, field, name, tab, chosen: entry[field] }));
  const owned = new Set(featSummary(build, data).owned.map((o) => o.feat.id));
  const spells = plan.spells ? levelSpellOptions(build, data, level) : [];
  const picks = entry.spells ?? [];
  const casting = spellcastingOf(build, data);
  const items = [
    ...slots.flatMap((slot) => levelFeatOptions(build, data, level, slot.field).sort(byName).map((f) => ({ id: `${slot.key}:${f.id}`, name: f.name, feat: f, slot }))),
    ...[...spells].sort(byName).map((s) => ({ id: `spells:${s.id}`, name: s.name, spell: s })),
  ];
  const sections = [...slots.map(({ key, tab, name }) => ({ key, tab, name })), ...(plan.spells ? [{ key: 'spells', tab: 'Spells', name: 'New spells' }] : [])];
  const [openId, setOpenId] = useState(() => {
    const first = slots.find((s) => s.chosen);
    return wide() && first ? `${first.key}:${first.chosen}` : null;
  });
  const openItem = items.find((i) => i.id === openId) ?? null;
  const spellsFull = picks.length >= plan.spells;

  // Skill ranks before this level's increase.
  const before = skillRanksOf({ ...build, level: level - 1 }, data).ranks;
  const cap1 = RANKS.indexOf(maxSkillRank(level));
  const nextRank = (s) => RANKS[RANKS.indexOf(before[s] ?? 'untrained') + 1];
  // Problems that aren't just "choose …" (a prerequisite, a skill above its cap).
  const warnings = todo.filter((p) => !/: (choose|make your|learn) /.test(p.message));

  return (
    <section className="choice level-page" aria-labelledby="level-page-title">
      <div className="choice-head">
        <h2 id="level-page-title" className="choice-head__title">Level {level}</h2>
        <span className={`choice-head__status ${todo.length ? '' : 'choice-head__status--done'}`}>{todo.length ? `${todo.length} to do` : '✓ Complete'}</span>
      </div>
      {warnings.map((p) => <p key={p.message} className="rule-note rule-note--warn">{p.message.replace(/^Level \d+: /, '')}</p>)}

      {plan.features.map((f) => (
        <details key={f.slug} className="feature">
          <summary>{f.name} <span className="feature__from">class feature</span></summary>
          <div className="option__desc" dangerouslySetInnerHTML={{ __html: f.description }} />
        </details>
      ))}

      {sections.length > 0 && (
        <>
          <div className="feat-slots">
            {slots.map((slot) => <ChoiceHeading key={slot.key} title={slot.name} chosen={slot.chosen && nameOf(slot.chosen)} level={3} />)}
            {plan.spells > 0 && <ChoiceHeading title="New spells" chosen={spellsFull && `${picks.length} of ${plan.spells}`} need={`${picks.length} of ${plan.spells} chosen`} level={3} />}
          </div>
          <BookSpread
            items={items}
            total={items.length}
            noun={plan.spells ? 'feats and spells' : 'feats'}
            sections={sections}
            sectionOf={(i) => (i.feat ? i.slot.key : 'spells')}
            tabsOnTop
            open={openItem}
            onOpen={(i) => setOpenId(i.id)}
            marked={(i) => (i.feat ? i.slot.chosen === i.feat.id : picks.includes(i.spell.id))}
            blocked={(i) => {
              if (i.spell) return !picks.includes(i.spell.id) && spellsFull ? `You've chosen ${plan.spells}` : null;
              if (i.slot.chosen !== i.feat.id && owned.has(i.feat.id) && !/more than once/i.test(i.feat.description)) return 'You already have this feat';
              const pre = featPrerequisites(i.feat, at, data);
              return pre.met ? null : `Requires ${pre.failed.join('; ')}`;
            }}
            meta={(i) => (i.feat ? [`Level ${i.feat.level}`, featMeta(i.feat)].filter(Boolean).join(' · ') : <>Rank {i.spell.rank} <ActionCost actions={i.spell.actions} /></>)}
            emptyText="Nothing to choose from here."
            leaf={openItem && (openItem.feat ? (
              <FeatLeaf
                key={openItem.id}
                item={openItem}
                build={at}
                data={data}
                onChoose={() => setEntry({ [openItem.slot.field]: openItem.feat.id })}
                onRemove={() => setEntry({ [openItem.slot.field]: null })}
                onClose={() => setOpenId(null)}
              />
            ) : (
              <SpellLeaf
                key={openItem.id}
                spell={openItem.spell}
                kind={casting?.kind}
                chosen={picks.includes(openItem.spell.id)}
                full={spellsFull}
                fullNote={`You've chosen ${plan.spells} new spell${plan.spells === 1 ? '' : 's'}. Remove one to add this.`}
                add={() => setEntry({ spells: [...picks, openItem.spell.id] })}
                remove={() => setEntry({ spells: picks.filter((x) => x !== openItem.spell.id) })}
                close={() => setOpenId(null)}
              />
            ))}
            blankIcon="feats"
            blank={
              <>
                <p className="book__blank-title">Choose this level’s {plan.spells ? 'feats and spells' : 'feats'}</p>
                <p className="rule-note">Open an entry from the index to read it here. Each tab is one of this level’s choices. Greyed-out entries need something you don’t have yet.</p>
              </>
            }
          />
        </>
      )}

      {plan.skillIncrease && (
        <div className="choice">
          <ChoiceHeading title="Skill increase" chosen={entry.skillIncrease && `${cap(entry.skillIncrease)} to ${nextRank(entry.skillIncrease)}`} level={3} />
          <p className="rule-note">Raise one skill a rank, or train a new one. At level {level} a skill can reach {maxSkillRank(level)}.</p>
          <Chips
            label="Skill to increase"
            options={data.skills}
            isOn={(s) => entry.skillIncrease === s}
            isDisabled={(s) => entry.skillIncrease !== s && (!nextRank(s) || RANKS.indexOf(nextRank(s)) > cap1)}
            onToggle={pick(entry.skillIncrease, (s) => setEntry({ skillIncrease: s }))}
            render={(s) => (nextRank(s) ? `${cap(s)} → ${cap(nextRank(s))}` : `${cap(s)} (legendary)`)}
          />
        </div>
      )}

      {plan.boosts && (
        <div className="choice ledger">
          <ChoiceHeading title="Attribute boosts" chosen={(entry.boosts ?? []).filter(Boolean).length === 4 && 'Four boosts'} need={`${(entry.boosts ?? []).filter(Boolean).length} of 4 chosen`} level={3} />
          <p className="rule-note">Boost four different attributes. An attribute already at +4 or more gets a partial boost (+½): two of them make +1.</p>
          <BoostLedger build={build} update={update} data={data} only={`level-${level}`} />
        </div>
      )}

      {plan.choices.map(({ feature, choice }) => (
        <div key={feature.slug} className="choice">
          <ChoiceHeading title={feature.name} chosen={entry.choices?.[feature.slug] && cap(entry.choices[feature.slug])} need={choice.kind === 'save' ? 'Choose a save' : 'Choose a weapon group'} level={3} />
          <Chips
            label={feature.name}
            options={choice.options}
            isOn={(o) => entry.choices?.[feature.slug] === o}
            onToggle={pick(entry.choices?.[feature.slug], (o) => setEntry({ choices: { ...entry.choices, [feature.slug]: o } }))}
            render={cap}
          />
        </div>
      ))}
    </section>
  );
}
