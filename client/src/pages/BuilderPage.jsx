import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  STEPS,
  BUILD_VERSION,
  EARLY_TYPES,
  runesOf,
  emptyBuild,
  buildProblems,
  buildCharacter,
  migrateBuild,
  dropMissingChoices,
  reviewCharacter,
  campaignData,
  bookIssues,
  dropBookIssues,
} from '@rollbound/rules';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { AncestryStep, BackgroundStep, ClassStep } from '../builder/IdentitySteps.jsx';
import { AttributesStep, SkillsStep, FeatsStep, SpellsStep, GearStep, ReviewStep } from '../builder/DetailSteps.jsx';
import { booksLabel, isOutdated, loadRules, replaceCharacter } from '../state/rulesData.js';
import { useCampaignService } from '../state/campaignService.js';
import { savePortrait } from '../state/portraits.js';
import ImagePicker from '../components/ImagePicker.jsx';
import StartStep from '../builder/StartStep.jsx';

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

const RUNES_INFO = {
  ...STEP_INFO.spells,
  title: 'Runes',
  note: 'Runesmiths carve magic into the world with runes instead of casting spells. You know a handful of runes and can apply them to allies, enemies, and gear.',
};

// Whether the player has chosen anything on each step yet (not whether it's complete).
const STEP_TOUCHED = {
  ancestry: (b) => Boolean(b.ancestry || b.heritage),
  background: (b) => Boolean(b.background),
  class: (b) => Boolean(b.class),
  attributes: (b) => b.altAncestryBoosts || b.freeBoosts.length > 0 || [...b.ancestryBoosts, ...b.backgroundBoosts].some(Boolean) || Boolean(b.keyAbility),
  skills: (b) => b.skills.length > 0 || b.languages.length > 0,
  feats: (b) => Boolean(b.ancestryFeat || b.classFeat || Object.values(b.bonusFeats).some(Boolean)),
  spells: (b) => b.cantrips.length > 0 || b.spells.length > 0 || b.runes?.length > 0,
  gear: (b) => Boolean(b.armor || b.shield || b.weapons.length),
  review: (b) => Boolean(b.name.trim()),
};

// start: null until the player picks Build your own ('custom') or a pregenerated hero ('pregen').
const BLANK = { build: emptyBuild(), step: STEPS[0], start: null };

// Steps that only need EARLY_TYPES, so they can show before feats, spells and gear arrive.
const EARLY_STEPS = ['ancestry', 'background', 'class'];

/** The saved draft under this key, or null if there isn't one. */
function loadDraft(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    // Drafts saved before builds had a version are version 1 (slugs); they're
    // converted to IDs once the rules data has loaded (see below).
    if (saved?.build) {
      return {
        build: { ...emptyBuild(), ...saved.build, v: saved.build.v ?? 1 },
        step: STEPS.includes(saved.step) ? saved.step : STEPS[0],
        campaign: saved.campaign ?? null,
        // Drafts from before the start screen were already under way.
        start: saved.start ?? 'custom',
      };
    }
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

/**
 * Loads a saved character for editing, with its
 * campaign's name and books (null: every book).
 */
async function fetchCharacter(id) {
  const row = await api.getCharacter(id);
  return { data: row.data, campaignName: row.campaignName, books: row.campaignBooks ?? null };
}

/** Choices a campaign's books rule out, in the re-pick list's shape. */
const outsideBooks = (build, data, books, campaignName) =>
  bookIssues(build, data, books).map((i) => ({ ...i, why: `${campaignName} doesn't use ${i.book}` }));

/**
 * Which campaign a new character is being built for, and what it allows. Shows a
 * bar when there is one, or a way to enter an invite code when there isn't.
 */
function CampaignBar({ campaign, removed, onChoose, onClear }) {
  const service = useCampaignService();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState([]);
  const find = async (e) => {
    e.preventDefault();
    setErrors([]);
    try {
      onChoose(code, await service.preview(code));
      setOpen(false);
      setCode('');
    } catch (err) {
      setErrors(errorsFrom(err));
    }
  };

  if (campaign) {
    return (
      <section className="notice notice--quiet" aria-label="Campaign">
        <p>
          Building for <strong>{campaign.name}</strong> · Books: {booksLabel(campaign.books)}
        </p>
        <p className="muted">
          {campaign.isGm ? 'Saving adds this character to your party.' : "Saving asks its GM to let this character in; you'll hear back in your inbox."}
        </p>
        {removed.length > 0 && (
          <p className="muted">
            Cleared because {campaign.name} doesn't use their books: {removed.map((r) => `${r.name} (${r.book})`).join(', ')}.
          </p>
        )}
        <button type="button" className="chip" onClick={onClear}>Not for a campaign</button>
      </section>
    );
  }
  if (!open) {
    return (
      <button type="button" className="chip builder__campaign" onClick={() => setOpen(true)}>
        Building for a campaign? Enter its invite code
      </button>
    );
  }
  return (
    <form className="notice notice--quiet join__find" onSubmit={find}>
      <label className="visually-hidden" htmlFor="builder-invite">Invite code</label>
      <input id="builder-invite" className="join__code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX" autoComplete="off" />
      <button type="submit" className="btn" disabled={code.replace(/[^a-z0-9]/gi, '').length < 8}>Use</button>
      <FormErrors errors={errors} />
    </form>
  );
}

/**
 * The character builder. At /create it builds a new character; at
 * /characters/:id/edit it edits a saved one, for example to re-pick choices a
 * rules-data update removed. Each keeps its own draft, so leaving and coming
 * back picks up where the player was.
 */
export default function BuilderPage() {
  const { isDemo } = useAuth();
  const navigate = useNavigate();
  const service = useCampaignService();
  const [search, setSearch] = useSearchParams();
  const { characterId: editId } = useParams();
  const draftKey = editId ? `${DRAFT_KEY}:${editId}` : DRAFT_KEY;
  const [data, setData] = useState(null);
  const [early, setEarly] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hadDraft] = useState(() => Boolean(loadDraft(draftKey)));
  // campaign: { code, name, books } when a new character is built for a campaign.
  const [{ build, step, campaign = null, start = null }, setDraft] = useState(() => loadDraft(draftKey) ?? BLANK);
  const [removed, setRemoved] = useState([]);
  // Edit mode: { name, original, repick, books, campaignName } once the saved character has loaded.
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const [portrait, setPortrait] = useState({});

  // The first steps' data loads first; everything else follows behind it. Files
  // are shared, so the full load reuses what the early one fetched.
  useEffect(() => {
    loadRules({ types: EARLY_TYPES })
      .then(setEarly)
      .catch(() => {}); // The full load below reports failures.
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
      .then(({ data: c, books, campaignName }) => {
        if (cancelled) return;
        if (!c?.build) throw new Error('no build');
        const current = dropMissingChoices(migrateBuild(c.build, data), data);
        // Choices the rules data lost, and choices from books the character's campaign doesn't use.
        const repick = [
          ...(isOutdated(c) ? (reviewCharacter(c, data).missing ?? []) : []).map((m) => ({ ...m, why: 'no longer in the rules data' })),
          ...outsideBooks(current, data, books, campaignName),
        ];
        const original = dropBookIssues(current, data, books);
        setEditing({ name: c.name, original, repick, books, campaignName });
        if (!hadDraft) setDraft({ build: original, step: buildProblems(original, data)[0]?.step ?? 'review' });
      })
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [editId, data, hadDraft]);

  // Starting from a campaign's invite link (/create?invite=CODE): limit the builder to its books.
  const inviteCode = editId ? null : search.get('invite');
  useEffect(() => {
    if (!inviteCode || !data) return;
    let cancelled = false;
    service
      .preview(inviteCode)
      .then((c) => !cancelled && chooseCampaign(inviteCode, c))
      .catch((err) => !cancelled && setErrors(errorsFrom(err)))
      .finally(() => !cancelled && setSearch({}, { replace: true }));
    return () => {
      cancelled = true;
    };
    // chooseCampaign only reads state through setDraft, so it doesn't need to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteCode, data, service, setSearch]);

  /** Builds this new character for a campaign, clearing choices from books it doesn't use. */
  const chooseCampaign = (code, c) => {
    const chosen = { code, name: c.name, books: c.books ?? null, isGm: Boolean(c.isGm) };
    setDraft((d) => {
      const gone = data ? bookIssues(d.build, data, chosen.books) : [];
      setRemoved(gone);
      return { ...d, campaign: chosen, build: data ? dropBookIssues(d.build, data, chosen.books) : d.build };
    });
  };
  const clearCampaign = () => {
    setRemoved([]);
    setDraft((d) => ({ ...d, campaign: null }));
  };

  // The books this character is limited to, and the rules data as that campaign sees it.
  const books = editId ? (editing?.books ?? null) : (campaign?.books ?? null);
  const view = useMemo(() => data && campaignData(data, books), [data, books]);
  const earlyView = useMemo(() => early && campaignData(early, books), [early, books]);

  const ready = Boolean(data) && (!editId || Boolean(editing));
  // A new character can start on the early data. Edits and older drafts wait for
  // everything, since they're checked against the full rules first.
  const earlyOk = !editId && build.v >= BUILD_VERSION && EARLY_STEPS.includes(step);
  const stepData = ready ? view : earlyOk ? earlyView : null;
  useEffect(() => {
    if (ready) saveDraft(draftKey, { build, step, start, ...(campaign && { campaign }) });
  }, [ready, draftKey, build, step, start, campaign]);

  const update = (patch) => setDraft((d) => ({ ...d, build: { ...d.build, ...patch } }));
  const goTo = (s) => {
    setDraft((d) => ({ ...d, step: s }));
    window.scrollTo(0, 0);
  };
  // The start screen shows for a new character until the player picks how to begin.
  const choosing = !editId && !start;
  const startCustom = () => {
    setDraft((d) => ({ ...d, start: 'custom', step: STEPS[0] }));
    setPortrait({});
    window.scrollTo(0, 0);
  };
  const startPregen = (pregen, headshotUrl) => {
    const chosen = data ? dropBookIssues(dropMissingChoices(migrateBuild(pregen.build, data), data), data, campaign?.books ?? null) : pregen.build;
    setDraft((d) => ({ ...d, start: 'pregen', build: chosen, step: 'review' }));
    window.scrollTo(0, 0);
    // Their headshot as the portrait, ready to save with them (it can still be changed).
    if (headshotUrl) {
      fetch(headshotUrl)
        .then((r) => r.blob())
        .then((blob) => setPortrait({ file: new File([blob], `${pregen.slug}.webp`, { type: 'image/webp' }) }))
        .catch(() => {});
    }
  };

  const index = STEPS.indexOf(step);
  // A runesmith picks runes where spellcasters pick spells.
  const infoFor = (s) => (s === 'spells' && view && runesOf(build, view) ? RUNES_INFO : STEP_INFO[s]);
  const info = infoFor(step);
  const problems = view ? buildProblems(build, view) : [];
  const touched = (s) => STEP_TOUCHED[s](build);
  const anyTouched = STEPS.some(touched);
  const [confirmReset, setConfirmReset] = useState(false);

  const save = async () => {
    setSaving(true);
    setErrors([]);
    try {
      const character = buildCharacter(build, view);
      if (editId) {
        await replaceCharacter(editId, character);
        saveDraft(draftKey, null);
        navigate(`/play/${editId}/sheet`, { replace: true });
        return;
      }
      const { id } = await api.createCharacter(character);
      saveDraft(draftKey, null);
      // The character is saved either way; a portrait that fails can be added from the sheet,
      // and a campaign it couldn't ask to join can be asked again from the Campaigns page. For
      // someone else's campaign this sends a join request; the GM's own joins directly.
      if (portrait.file) await savePortrait(id, portrait.file).catch(() => {});
      if (campaign) await service.join(campaign.code, id).catch(() => {});
      navigate(`/play/${id}/sheet`, { replace: true });
    } catch (err) {
      setErrors(errorsFrom(err));
      setSaving(false);
    }
  };

  // Editing resets to the character as it was saved; a new character starts blank.
  const reset = () => {
    setDraft(editing ? { build: editing.original, step: STEPS[0] } : { ...BLANK, campaign });
    setRemoved([]);
    setPortrait({});
    setConfirmReset(false);
    setErrors([]);
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <TopBar
        crumbs={[
          { label: 'Characters', to: '/characters' },
          ...(editId ? [{ label: editing?.name ?? 'Character', to: `/play/${editId}/sheet` }, { label: 'Edit' }] : [{ label: 'New character' }]),
        ]}
        actions={
          <>
            {(anyTouched || (!editId && start)) && (
              <button type="button" className="btn btn--small" onClick={() => setConfirmReset(true)}>
                Reset
              </button>
            )}
            <Link to={editId ? `/play/${editId}/sheet` : '/characters'} className="btn btn--small">Close</Link>
          </>
        }
      />

      {confirmReset && (
        <div className="confirm" role="alertdialog" aria-labelledby="reset-title">
          <p id="reset-title">{editing ? `Undo your changes and go back to ${editing.name} as saved?` : 'Reset every choice and start from a blank character?'}</p>
          <div className="btn-row">
            <button type="button" className="btn btn--grow" onClick={() => setConfirmReset(false)}>Keep my choices</button>
            <button type="button" className="btn btn--blood btn--grow" onClick={reset}>Reset</button>
          </div>
        </div>
      )}

      {!choosing && <nav className="steps" aria-label="Builder steps">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`steps__pip ${touched(s) ? 'steps__pip--touched' : ''}`}
            aria-current={s === step ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${infoFor(s).title}${touched(s) ? ' (started)' : ''}`}
            onClick={() => goTo(s)}
          />
        ))}
      </nav>}

      <main className="app__main">
        {choosing ? (
          <>
            <header className="builder__header">
              <span className="eyebrow">Getting started</span>
              <h1 className="title">How do you want to start?</h1>
              <p className="rule-note">Build a hero of your own, or jump in with one of Pathfinder’s iconic heroes.</p>
            </header>
            {!data && !loadFailed && <p className="muted italic center">Opening the rulebooks…</p>}
            {data && <CampaignBar campaign={campaign} removed={removed} onChoose={chooseCampaign} onClear={clearCampaign} />}
            <StartStep onCustom={startCustom} onPregen={startPregen} />
          </>
        ) : (
        <>
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
        {!stepData && !loadFailed && <p className="muted italic center">Opening the rulebooks…</p>}
        {!editId && data && <CampaignBar campaign={campaign} removed={removed} onChoose={chooseCampaign} onClear={clearCampaign} />}
        {editing?.books && (
          <p className="rule-note center">
            {editing.name} plays in {editing.campaignName}, so only its books are offered: {booksLabel(editing.books)}.
          </p>
        )}

        {editing?.repick.length > 0 && (
          <section className="notice" aria-labelledby="repick-title">
            <h2 id="repick-title" className="notice__title">Re-pick for {editing.name}</h2>
            <p>These choices need picking again. Choose something else on each step:</p>
            <ul className="notice__list">
              {editing.repick.map((m) => (
                <li key={`${m.kind}-${m.id}`}>
                  <strong>{m.name ?? `A ${m.kind}`}</strong> ({m.kind}, {infoFor(m.step).title} step): {m.why}
                </li>
              ))}
            </ul>
            <div className="notice__steps">
              {[...new Set(editing.repick.map((m) => m.step))].map((s) => (
                <button key={s} type="button" className="btn" aria-current={s === step ? 'step' : undefined} onClick={() => goTo(s)}>
                  {infoFor(s).title}
                </button>
              ))}
            </div>
          </section>
        )}

        {stepData && <info.Component build={build} update={update} data={stepData} goTo={goTo} />}

        {step === 'review' && (
          <>
            {!editId && <ImagePicker label="Portrait (optional)" shape="square" hint="you can add or change it later from the sheet" value={portrait} onChange={setPortrait} />}
            <FormErrors errors={errors} />
            {isDemo && !editId && <p className="rule-note center">Demo characters are deleted with the demo. Create an account to keep yours.</p>}
            <button type="button" className="btn btn--blood" disabled={!ready || problems.length > 0 || saving} onClick={save}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Save character'}
            </button>
          </>
        )}
        </>
        )}
      </main>

      {!choosing && <footer className="builder__footer">
        <button type="button" className="btn" disabled={index === 0 && Boolean(editId)} onClick={() => (index === 0 ? setDraft((d) => ({ ...d, start: null })) : goTo(STEPS[index - 1]))}>Back</button>
        <button type="button" className="btn btn--blood btn--grow" disabled={index === STEPS.length - 1} onClick={() => goTo(STEPS[index + 1])}>
          {index < STEPS.length - 1 ? `Next: ${infoFor(STEPS[index + 1]).title}` : 'Last step'}
        </button>
      </footer>}
    </div>
  );
}
