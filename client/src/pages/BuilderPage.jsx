import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STEPS, emptyBuild, buildProblems, buildCharacter } from '@rollbound/rules';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { AncestryStep, BackgroundStep, ClassStep } from '../builder/IdentitySteps.jsx';
import { AttributesStep, SkillsStep, FeatsStep, SpellsStep, GearStep, ReviewStep } from '../builder/DetailSteps.jsx';
import { saveDemoCharacter } from '../state/demoCharacters.js';

const DRAFT_KEY = 'rollbound:draft';

const STEP_INFO = {
  ancestry: {
    title: 'Ancestry',
    Component: AncestryStep,
    note: 'Your ancestry sets your starting Hit Points, size, Speed, and some attribute boosts. Your heritage narrows it down: the branch of that people you come from.',
  },
  background: {
    title: 'Background',
    Component: BackgroundStep,
    note: 'Your background is what you did before adventuring. It gives two attribute boosts, training in a skill and a Lore, and a skill feat.',
  },
  class: {
    title: 'Class',
    Component: ClassStep,
    note: 'Your class is your adventuring profession. It sets your Hit Points per level, your key attribute, and what you start trained in.',
  },
  attributes: {
    title: 'Attributes',
    Component: AttributesStep,
    note: 'Every attribute starts at +0. Each boost adds 1 and each flaw subtracts 1. You can’t boost the same attribute twice from one source, so at 1st level nothing goes above +4.',
  },
  skills: {
    title: 'Skills',
    Component: SkillsStep,
    note: 'Trained skills add +2 plus your level. If two sources train you in the same skill, you choose another skill instead.',
  },
  feats: {
    title: 'Feats',
    Component: FeatsStep,
    note: 'At 1st level you get an ancestry feat, the skill feat from your background, and (for most classes) a class feat. Some feats and class choices grant more feats.',
  },
  spells: {
    title: 'Spells',
    Component: SpellsStep,
    note: 'Spellcasters choose spells from their tradition: arcane, divine, occult, or primal. Cantrips can be cast as often as you like; other spells use up a spell slot.',
  },
  gear: {
    title: 'Gear',
    Component: GearStep,
    note: 'You start with 15 gp to spend on armor, a shield, and weapons of 1st level or lower.',
  },
  review: {
    title: 'Review',
    Component: ReviewStep,
    note: 'Name your character and check the numbers. Every total here uses the same math your sheet will show.',
  },
};

function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (saved?.build) return { build: { ...emptyBuild(), ...saved.build }, step: STEPS.includes(saved.step) ? saved.step : STEPS[0] };
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return { build: emptyBuild(), step: STEPS[0] };
}

function saveDraft(draft) {
  try {
    if (draft) localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage blocked: the draft just won't survive a reload.
  }
}

export default function BuilderPage() {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [{ build, step }, setDraft] = useState(loadDraft);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    import('@rollbound/rules/data/pf2e-level1.json')
      .then((m) => setData(m.default))
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => saveDraft({ build, step }), [build, step]);

  const update = (patch) => setDraft((d) => ({ ...d, build: { ...d.build, ...patch } }));
  const goTo = (s) => {
    setDraft((d) => ({ ...d, step: s }));
    window.scrollTo(0, 0);
  };

  const index = STEPS.indexOf(step);
  const info = STEP_INFO[step];
  const problems = data ? buildProblems(build, data) : [];
  const stepDone = (s) => data && !problems.some((p) => p.step === s);

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const character = buildCharacter(build, data);
      const id = isDemo ? saveDemoCharacter(character) : (await api.createCharacter(character)).id;
      if (!id) throw new Error('Your browser is blocking storage, so the demo can’t keep this character.');
      saveDraft(null);
      navigate(`/play/${id}/sheet`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setSaving(false);
    }
  };

  const startOver = () => {
    setDraft({ build: emptyBuild(), step: STEPS[0] });
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <Link to="/home" className="topbar__signout">Close</Link>
      </header>

      <nav className="steps" aria-label="Builder steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`steps__pip ${stepDone(s) ? 'steps__pip--done' : ''}`}
            aria-current={s === step ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${STEP_INFO[s].title}${stepDone(s) ? ' (done)' : ''}`}
            onClick={() => goTo(s)}
          />
        ))}
      </nav>

      <main className="app__main">
        <header className="builder__header">
          <span className="eyebrow">
            Step {index + 1} of {STEPS.length}
          </span>
          <h1 className="title">{info.title}</h1>
          <p className="rule-note">{info.note}</p>
        </header>

        {loadFailed && <p className="form-errors" role="alert">Couldn't load the rules data. Try refreshing.</p>}
        {!data && !loadFailed && <p className="muted italic center">Opening the rulebooks…</p>}
        {data && <info.Component build={build} update={update} data={data} goTo={goTo} />}

        {step === 'review' && (
          <>
            <FormErrors errors={errors} />
            {isDemo && <p className="rule-note center">In demo mode this character lasts until you close the tab. Create an account to keep it.</p>}
            <button type="button" className="btn btn--blood" disabled={!data || problems.length > 0 || saving} onClick={save}>
              {saving ? 'Saving…' : isDemo ? 'Play this character' : 'Save character'}
            </button>
            <button type="button" className="btn" onClick={startOver}>Start over</button>
          </>
        )}
      </main>

      <footer className="builder__footer">
        <button type="button" className="btn" disabled={index === 0} onClick={() => goTo(STEPS[index - 1])}>Back</button>
        <button type="button" className="btn btn--blood btn--grow" disabled={index === STEPS.length - 1} onClick={() => goTo(STEPS[index + 1])}>
          {index < STEPS.length - 1 ? `Next: ${STEP_INFO[STEPS[index + 1]].title}` : 'Last step'}
        </button>
      </footer>
    </div>
  );
}
