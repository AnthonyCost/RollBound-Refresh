import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { STEPS, emptyBuild, buildProblems, buildCharacter, migrateBuild, dropMissingChoices, reviewCharacter } from '@rollbound/rules';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { AncestryStep, BackgroundStep, ClassStep } from '../builder/IdentitySteps.jsx';
import { AttributesStep, SkillsStep, FeatsStep, SpellsStep, GearStep, ReviewStep } from '../builder/DetailSteps.jsx';
import { DEMO_ID_PREFIX, getDemoCharacter, saveDemoCharacter } from '../state/demoCharacters.js';
import { isOutdated, loadRules, replaceCharacter } from '../state/rulesData.js';
import { savePortrait } from '../state/portraits.js';
import ImagePicker from '../components/ImagePicker.jsx';

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

// Whether the player has chosen anything on each step yet (not whether it's complete).
const STEP_TOUCHED = {
  ancestry: (b) => Boolean(b.ancestry || b.heritage),
  background: (b) => Boolean(b.background),
  class: (b) => Boolean(b.class),
  attributes: (b) => b.altAncestryBoosts || b.freeBoosts.length > 0 || [...b.ancestryBoosts, ...b.backgroundBoosts].some(Boolean) || Boolean(b.keyAbility),
  skills: (b) => b.skills.length > 0 || b.languages.length > 0,
  feats: (b) => Boolean(b.ancestryFeat || b.classFeat || Object.values(b.bonusFeats).some(Boolean)),
  spells: (b) => b.cantrips.length > 0 || b.spells.length > 0,
  gear: (b) => Boolean(b.armor || b.shield || b.weapons.length),
  review: (b) => Boolean(b.name.trim()),
};

const BLANK = { build: emptyBuild(), step: STEPS[0] };

/** The saved draft under this key, or null if there isn't one. */
function loadDraft(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    // Drafts saved before builds had a version are version 1 (slugs); they're
    // converted to IDs once the rules data has loaded (see below).
    if (saved?.build) return { build: { ...emptyBuild(), ...saved.build, v: saved.build.v ?? 1 }, step: STEPS.includes(saved.step) ? saved.step : STEPS[0] };
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return null;
}

function saveDraft(key, draft) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked: the draft just won't survive a reload.
  }
}

/** Loads a saved character's sheet for editing, from demo storage or the server. */
const fetchCharacter = (id) =>
  id.startsWith(DEMO_ID_PREFIX) ? Promise.resolve(getDemoCharacter(id)?.data ?? null) : api.getCharacter(id).then((row) => row.data);

/**
 * The character builder. At /create it builds a new character; at
 * /characters/:id/edit it edits a saved one, for example to re-pick choices a
 * rules-data update removed. Each keeps its own draft, so leaving and coming
 * back picks up where the player was.
 */
export default function BuilderPage() {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const { characterId: editId } = useParams();
  const draftKey = editId ? `${DRAFT_KEY}:${editId}` : DRAFT_KEY;
  const [data, setData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hadDraft] = useState(() => Boolean(loadDraft(draftKey)));
  const [{ build, step }, setDraft] = useState(() => loadDraft(draftKey) ?? BLANK);
  // Edit mode: { name, original, repick } once the saved character has loaded.
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [portrait, setPortrait] = useState({});

  useEffect(() => {
    loadRules()
      .then(setData)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(() => {
    // A draft saved before a rules update can point at items that are gone; clearing
    // them makes their steps ask again.
    if (data) setDraft((d) => ({ ...d, build: dropMissingChoices(migrateBuild(d.build, data), data) }));
  }, [data]);

  // Edit mode: start from the saved character, with choices the rules data no longer
  // has cleared so their steps ask again, on the first step that needs attention.
  useEffect(() => {
    if (!editId || !data) return;
    let cancelled = false;
    fetchCharacter(editId)
      .then((c) => {
        if (cancelled) return;
        if (!c?.build) throw new Error('no build');
        const original = dropMissingChoices(migrateBuild(c.build, data), data);
        const repick = isOutdated(c) ? (reviewCharacter(c, data).missing ?? []) : [];
        setEditing({ name: c.name, original, repick });
        if (!hadDraft) setDraft({ build: original, step: buildProblems(original, data)[0]?.step ?? 'review' });
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [editId, data, hadDraft]);

  const ready = Boolean(data) && (!editId || Boolean(editing));
  useEffect(() => {
    if (ready) saveDraft(draftKey, { build, step });
  }, [ready, draftKey, build, step]);

  const update = (patch) => setDraft((d) => ({ ...d, build: { ...d.build, ...patch } }));
  const goTo = (s) => {
    setDraft((d) => ({ ...d, step: s }));
    window.scrollTo(0, 0);
  };

  const index = STEPS.indexOf(step);
  const info = STEP_INFO[step];
  const problems = data ? buildProblems(build, data) : [];
  const touched = (s) => STEP_TOUCHED[s](build);
  const anyTouched = STEPS.some(touched);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const character = buildCharacter(build, data);
      if (editId) {
        await replaceCharacter(editId, character);
        saveDraft(draftKey, null);
        navigate(`/play/${editId}/sheet`, { replace: true });
        return;
      }
      const id = isDemo ? saveDemoCharacter(character) : (await api.createCharacter(character)).id;
      if (!id) throw new Error('Your browser is blocking storage, so the demo can’t keep this character.');
      saveDraft(draftKey, null);
      // The character is saved either way; a portrait that fails can be added from the sheet.
      if (portrait.file) await savePortrait(id, portrait.file, { isDemo }).catch(() => {});
      navigate(`/play/${id}/sheet`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setSaving(false);
    }
  };

  // Editing resets to the character as it was saved; a new character starts blank.
  const reset = () => {
    setDraft(editing ? { build: editing.original, step: STEPS[0] } : BLANK);
    setConfirmReset(false);
    setErrors([]);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          {anyTouched && (
            <button type="button" className="topbar__signout" onClick={() => setConfirmReset(true)}>
              Reset
            </button>
          )}
          <Link to={editId ? `/play/${editId}/sheet` : '/home'} className="topbar__signout">Close</Link>
        </div>
      </header>

      {confirmReset && (
        <div className="confirm" role="alertdialog" aria-labelledby="reset-title">
          <p id="reset-title">{editing ? `Undo your changes and go back to ${editing.name} as saved?` : 'Reset every choice and start from a blank character?'}</p>
          <div className="btn-row">
            <button type="button" className="btn btn--grow" onClick={() => setConfirmReset(false)}>Keep my choices</button>
            <button type="button" className="btn btn--blood btn--grow" onClick={reset}>Reset</button>
          </div>
        </div>
      )}

      <nav className="steps" aria-label="Builder steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`steps__pip ${touched(s) ? 'steps__pip--touched' : ''}`}
            aria-current={s === step ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${STEP_INFO[s].title}${touched(s) ? ' (started)' : ''}`}
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

        {loadFailed && (
          <p className="form-errors" role="alert">
            {editId ? "Couldn't open this character for editing. Try refreshing." : "Couldn't load the rules data. Try refreshing."}
          </p>
        )}
        {!ready && !loadFailed && <p className="muted italic center">Opening the rulebooks…</p>}
        {editing?.repick.length > 0 && (
          <section className="notice" aria-labelledby="repick-title">
            <h2 id="repick-title" className="notice__title">Re-pick for {editing.name}</h2>
            <p>A rules update removed these choices. Pick something else on each step:</p>
            <ul className="notice__list">
              {editing.repick.map((m) => (
                <li key={`${m.kind}-${m.id}`}>
                  <strong>{m.name ?? `A ${m.kind}`}</strong> ({m.kind}, {STEP_INFO[m.step].title} step)
                </li>
              ))}
            </ul>
            <div className="notice__steps">
              {[...new Set(editing.repick.map((m) => m.step))].map((s) => (
                <button key={s} type="button" className="btn" aria-current={s === step ? 'step' : undefined} onClick={() => goTo(s)}>
                  {STEP_INFO[s].title}
                </button>
              ))}
            </div>
          </section>
        )}

        {ready && <info.Component build={build} update={update} data={data} goTo={goTo} />}

        {step === 'review' && (
          <>
            {!editId && <ImagePicker label="Portrait (optional)" shape="square" hint="you can add or change it later from the sheet" value={portrait} onChange={setPortrait} />}
            <FormErrors errors={errors} />
            {isDemo && !editId && <p className="rule-note center">In demo mode this character lasts until you close the tab. Create an account to keep it.</p>}
            <button type="button" className="btn btn--blood" disabled={!ready || problems.length > 0 || saving} onClick={save}>
              {saving ? 'Saving…' : editId ? 'Save changes' : isDemo ? 'Play this character' : 'Save character'}
            </button>
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
