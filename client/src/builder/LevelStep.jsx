import { ABILITIES, MAX_LEVEL, buildProblems, entryFor, levelDown, levelFeatOptions, levelOf, levelPlan, levelSpellOptions, levelUp, lookup } from '@rollbound/rules';
import { ABILITY_SHORT, cap } from './labels.js';

const FEAT_FIELDS = [['classFeat', 'Class feat'], ['ancestryFeat', 'Ancestry feat'], ['skillFeat', 'Skill feat'], ['generalFeat', 'General feat']];
const byName = (a, b) => a.name.localeCompare(b.name);

// shortcut: native selects, no feat/spell text or prerequisite greying (the problems list names unmet ones); move to BookSpread if picking gets painful.
function Pick({ label, value, options, onChange }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Choose…</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Levels 2-20: the character's level, then what each level reached asks for (see levelPlan). */
export function LevelStep({ build, update, data }) {
  const { cls } = lookup(build, data);
  if (!cls) return <p className="rule-note">Choose a class first.</p>;
  const level = levelOf(build);
  const problems = buildProblems(build, data).filter((p) => p.step === 'level');
  const setEntry = (lv, patch) => update({ levels: build.levels.map((e, i) => (i === lv - 2 ? { ...e, ...patch } : e)) });

  return (
    <>
      <section className="panel">
        <h2 className="panel__title">Level {level}</h2>
        <button type="button" className="btn" disabled={level <= 1} onClick={() => update(levelDown(build))}>Level down</button>{' '}
        <button type="button" className="btn btn--blood" disabled={level >= MAX_LEVEL} onClick={() => update(levelUp(build))}>Level up</button>
        {level === 1 && <p className="rule-note">Starting at 1st level? You're done here. Level up to start higher.</p>}
        {problems.map((p) => <p key={p.message} className="rule-note rule-note--warn">{p.message}</p>)}
      </section>

      {Array.from({ length: level - 1 }, (_, i) => i + 2).map((lv) => {
        const plan = levelPlan(build, data, lv);
        const entry = entryFor(build, lv);
        return (
          <section key={lv} className="panel" aria-label={`Level ${lv}`}>
            <h2 className="panel__title">Level {lv}</h2>
            {plan.features.length > 0 && <p className="rule-note">Gains {plan.features.map((f) => f.name).join(', ')}.</p>}
            {FEAT_FIELDS.filter(([f]) => plan[f]).map(([field, label]) => (
              <Pick key={field} label={label} value={entry[field]} onChange={(v) => setEntry(lv, { [field]: v })}
                options={levelFeatOptions(build, data, lv, field).sort(byName).map((f) => ({ value: f.id, label: `${f.name} (${f.level})` }))} />
            ))}
            {plan.skillIncrease && (
              <Pick label="Skill increase" value={entry.skillIncrease} onChange={(v) => setEntry(lv, { skillIncrease: v })}
                options={data.skills.map((s) => ({ value: s, label: cap(s) }))} />
            )}
            {plan.boosts && [0, 1, 2, 3].map((i) => (
              <Pick key={i} label={`Boost ${i + 1}`} value={entry.boosts?.[i]} onChange={(v) => setEntry(lv, { boosts: [0, 1, 2, 3].map((j) => (j === i ? v : entry.boosts?.[j] ?? null)) })}
                options={ABILITIES.map((a) => ({ value: a, label: ABILITY_SHORT[a] }))} />
            ))}
            {plan.choices.map(({ feature, choice }) => (
              <Pick key={feature.slug} label={feature.name} value={entry.choices?.[feature.slug]} onChange={(v) => setEntry(lv, { choices: { ...entry.choices, [feature.slug]: v } })}
                options={choice.options.map((o) => ({ value: o, label: cap(o) }))} />
            ))}
            {plan.spells > 0 && Array.from({ length: plan.spells }, (_, i) => (
              <Pick key={`spell${i}`} label={`New spell ${i + 1}`} value={entry.spells?.[i]}
                onChange={(v) => setEntry(lv, { spells: Array.from({ length: plan.spells }, (_, j) => (j === i ? v : entry.spells?.[j] ?? null)).filter(Boolean) })}
                options={levelSpellOptions(build, data, lv).sort(byName).map((s) => ({ value: s.id, label: `${s.name} (rank ${s.rank})` }))} />
            ))}
          </section>
        );
      })}
    </>
  );
}
