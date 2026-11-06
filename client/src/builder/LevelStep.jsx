import { Fragment, useState } from 'react';
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

const FEAT_FIELDS = [['classFeat', 'Class feat'], ['ancestryFeat', 'Ancestry feat'], ['skillFeat', 'Skill feat'], ['generalFeat', 'General feat']];
const byName = (a, b) => a.name.localeCompare(b.name);

/**
 * Levels 2-20: a level counter, a track of the levels reached (each with what's left to
 * choose), and the open level's page: the class features it brings, its feats and new
 * spells as a book each (like the Feats step), its skill increase, boosts and feature choices.
 */
export function LevelStep({ build, update, data }) {
  const level = levelOf(build);
  // A level's to-do: its own problems, plus any bonus feat a feat picked there still needs.
  const pickedAt = new Map((build.levels ?? []).flatMap((e, i) => FEAT_FIELDS.map(([f]) => [e[f], i + 2])));
  const problems = [
    ...buildProblems(build, data).filter((p) => p.step === 'level'),
    ...featSummary(build, data).slots.filter((b) => !b.chosen && pickedAt.has(b.parent.id)).map((b) => ({ message: `Level ${pickedAt.get(b.parent.id)}: choose the feat from ${b.parent.name}.` })),
  ];
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

  const slots = FEAT_FIELDS.filter(([field]) => plan[field]).map(([field, name]) => ({ key: field, field, name, chosen: entry[field] }));
  const summary = featSummary(build, data);
  const owned = new Set(summary.owned.map((o) => o.feat.id));
  // Feats picked here that grant another feat (Ancestral Paragon): their slot is chosen here too.
  const picked = new Set(slots.map((slot) => slot.chosen).filter(Boolean));
  const bonus = summary.slots.filter((b) => picked.has(b.parent.id)).map((b) => ({ ...b, name: `Bonus feat from ${b.parent.name}` }));
  const featItems = (feats) => feats.sort((a, b) => b.level - a.level || byName(a, b)).map((f) => ({ id: f.id, name: f.name, feat: f, section: f.level }));
  const featBlocked = (chosenId) => (i) => {
    if (chosenId !== i.id && owned.has(i.id) && !/more than once/i.test(i.feat.description)) return 'You already have this feat';
    const pre = featPrerequisites(i.feat, at, data);
    return pre.met ? null : `Requires ${pre.failed.join('; ')}`;
  };
  const featTab = (lv) => ({ tab: String(lv), name: `Level ${lv} feats` });
  const picks = entry.spells ?? [];
  const spellsFull = picks.length >= plan.spells;
  const casting = spellcastingOf(build, data);

  // Each feat slot, bonus feat and the new spells: a tab each, hosting that choice's own book.
  const books = [
    ...slots.map((slot) => ({
      key: slot.key,
      title: slot.name,
      chosen: slot.chosen && nameOf(slot.chosen),
      book: (
        <LevelBook
          noun="feats"
          // Tabs by feat level, newest first.
          items={featItems(levelFeatOptions(build, data, level, slot.field))}
          tab={featTab}
          startOpen={slot.chosen}
          marked={(i) => slot.chosen === i.id}
          blocked={featBlocked(slot.chosen)}
          meta={(i) => featMeta(i.feat)}
          leaf={(i, close) => (
            <FeatLeaf
              item={{ feat: i.feat, slot }}
              build={at}
              data={data}
              onChoose={() => setEntry({ [slot.field]: i.id })}
              onRemove={() => setEntry({ [slot.field]: null })}
              onClose={close}
            />
          )}
          blankIcon="feats"
          blank={`Choose your ${slot.name.toLowerCase()}`}
        />
      ),
    })),
    ...bonus.map((b) => ({
      key: b.parent.id,
      title: b.name,
      chosen: b.chosen && nameOf(b.chosen),
      book: (
        <LevelBook
          noun="feats"
          items={featItems(b.options.filter((f) => f.id !== b.parent.id))}
          tab={featTab}
          startOpen={b.chosen}
          marked={(i) => b.chosen === i.id}
          blocked={featBlocked(b.chosen)}
          meta={(i) => featMeta(i.feat)}
          leaf={(i, close) => (
            <FeatLeaf
              item={{ feat: i.feat, slot: b }}
              build={at}
              data={data}
              onChoose={() => update({ bonusFeats: { ...build.bonusFeats, [b.parent.id]: i.id } })}
              onRemove={() => update({ bonusFeats: { ...build.bonusFeats, [b.parent.id]: null } })}
              onClose={close}
            />
          )}
          blankIcon="feats"
          blank={`Choose your ${b.name.toLowerCase()}`}
        />
      ),
    })),
    ...(plan.spells > 0 ? [{
      key: 'spells',
      title: 'New spells',
      chosen: spellsFull && `${picks.length} of ${plan.spells}`,
      need: `${picks.length} of ${plan.spells} chosen`,
      book: (
        <LevelBook
          noun="spells"
          // Tabs by rank, highest first.
          items={levelSpellOptions(build, data, level).sort((a, b) => b.rank - a.rank || byName(a, b)).map((s) => ({ id: s.id, name: s.name, spell: s, section: s.rank }))}
          tab={(r) => ({ tab: `Rank ${r}`, name: `Rank ${r} spells` })}
          startOpen={picks[0]}
          marked={(i) => picks.includes(i.id)}
          blocked={(i) => (!picks.includes(i.id) && spellsFull ? `You've chosen ${plan.spells}` : null)}
          meta={(i) => <ActionCost actions={i.spell.actions} />}
          leaf={(i, close) => (
            <SpellLeaf
              spell={i.spell}
              kind={casting?.kind}
              chosen={picks.includes(i.id)}
              full={spellsFull}
              fullNote={`You've chosen ${plan.spells} new spell${plan.spells === 1 ? '' : 's'}. Remove one to add this.`}
              add={() => setEntry({ spells: [...picks, i.id] })}
              remove={() => setEntry({ spells: picks.filter((x) => x !== i.id) })}
              close={close}
            />
          )}
          blankIcon="spells"
          blank="Choose your new spells"
        />
      ),
    }] : []),
  ];

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

      {books.length > 0 && <ChoiceTabs books={books} />}

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

/**
 * The tabs for a level's feat slots, bonus feats and new spells, each with its status in
 * words, and the selected one's book beneath. Arrow keys move between tabs (WAI-ARIA tabs).
 */
function ChoiceTabs({ books }) {
  const [picked, setPicked] = useState(() => (books.find((b) => !b.chosen) ?? books[0]).key);
  const current = books.find((b) => b.key === picked) ?? books[0];
  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault(); // so the book doesn't turn its page too
    const next = books[(books.indexOf(current) + step + books.length) % books.length];
    setPicked(next.key);
    document.getElementById(`level-tab-${next.key}`)?.focus();
  };
  return (
    <>
      <div className="level-tabs" role="tablist" aria-label="This level's feats and spells" onKeyDown={onKeyDown}>
        {books.map((b) => (
          <button
            key={b.key}
            id={`level-tab-${b.key}`}
            type="button"
            role="tab"
            className="level-tab"
            aria-selected={b === current}
            aria-controls="level-tab-panel"
            tabIndex={b === current ? 0 : -1}
            onClick={() => setPicked(b.key)}
          >
            <span className="choice-head__title">{b.title}</span>
            <span className={`choice-head__status ${b.chosen ? 'choice-head__status--done' : ''}`}>
              {b.chosen ? <><span aria-hidden="true">✓ </span><span className="visually-hidden">Chosen: </span>{b.chosen}</> : b.need ?? 'Choose one'}
            </span>
          </button>
        ))}
      </div>
      <div id="level-tab-panel" role="tabpanel" aria-labelledby={`level-tab-${current.key}`}>
        {/* Keyed, so each choice's book starts fresh rather than keeping the last one's open entry or page. */}
        <Fragment key={current.key}>{current.book}</Fragment>
      </div>
    </>
  );
}

/**
 * One level-up choice's book: the index (tabbed by items' section, highest first) and
 * the open entry. leaf(item, close) draws the page.
 */
function LevelBook({ noun, items, tab, startOpen, marked, blocked, meta, leaf, blank, blankIcon }) {
  const [openId, setOpenId] = useState(() => (wide() && startOpen ? startOpen : null));
  const open = items.find((i) => i.id === openId) ?? null;
  const sections = [...new Set(items.map((i) => i.section))].map((key) => ({ key, ...tab(key) }));
  return (
    <div className="choice">
      <BookSpread
        items={items}
        total={items.length}
        noun={noun}
        sections={sections}
        sectionOf={(i) => i.section}
        tabsOnTop
        open={open}
        onOpen={(i) => setOpenId(i.id)}
        marked={marked}
        blocked={blocked}
        meta={meta}
        emptyText={`No ${noun} to choose from.`}
        leaf={open && leaf(open, () => setOpenId(null))}
        blankIcon={blankIcon}
        blank={
          <>
            <p className="book__blank-title">{blank}</p>
            <p className="rule-note">Open an entry from the index to read it here. Grayed-out entries need something you don’t have yet.</p>
          </>
        }
      />
    </div>
  );
}
