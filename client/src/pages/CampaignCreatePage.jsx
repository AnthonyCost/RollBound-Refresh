import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ADVENTURE_PATHS, THEMES, adventurePath, pathThemes } from '@rollbound/rules';
import { useCampaignService } from '../state/campaignService.js';
import { adventureCover, adventureCoverFile } from '../state/adventureCovers.js';
import PageShell from '../components/PageShell.jsx';
import CampaignForm from '../components/CampaignForm.jsx';

const KINDS = [
  {
    id: 'adventure-path',
    title: 'Adventure Path',
    text: "Run one of Paizo's published campaigns. We'll fill in its premise, starting level and cover for you to adjust.",
  },
  { id: 'homebrew', title: 'Homebrew', text: 'Your own world and your own story, from a blank page.' },
];

const STEP_INFO = {
  kind: { title: 'What are you running?', note: 'An Adventure Path is a campaign Paizo has written and published; homebrew is one you make yourself.' },
  path: {
    title: 'Choose your Adventure Path',
    note: "Every Pathfinder Second Edition Adventure Path, newest first. Ones written before the Remaster are tagged Pre-Remaster. Pick one to see its premise.",
  },
  details: { title: 'Set the scene', note: "Name your campaign and set the scene. You'll get an invite code to share, and players use it to ask to bring their characters in." },
};

// Filters for which rules a path was written for, alongside the themes.
const EDITIONS = {
  remastered: { label: 'Remastered', about: 'Written for the Remastered rules, or remastered since.' },
  'pre-remaster': { label: 'Pre-Remaster', about: 'Written for the original Second Edition rules. They run with the Remastered rules, with a few names to adjust.' },
};

const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

/** A path's cover, or a title card when there's no cover for it. */
function PathArt({ path }) {
  const url = adventureCover(path.slug);
  return url ? (
    <img className="path-card__art" src={url} alt="" />
  ) : (
    <span className="path-card__art path-card__art--plain" aria-hidden="true">{path.name}</span>
  );
}

/** Things worth knowing before choosing a path: how RollBound handles it today. */
function pathNotes(path) {
  return [
    path.status === 'upcoming' && `Comes out ${longDate(path.released)}.`,
    path.levels[0] > 1 && `It starts at level ${path.levels[0]}. RollBound's builder makes level 1 characters for now, so you'll level them up by hand.`,
    path.mythic && "It uses mythic rules, which RollBound doesn't track yet.",
    path.preRemaster && 'It was written for the original Second Edition rules, before the Remaster. It runs fine with the Remastered rules; a few spell and condition names have changed.',
    path.sequelTo && `It continues the story of ${adventurePath(path.sequelTo).name}.`,
  ].filter(Boolean);
}

/**
 * Starting a campaign, step by step like the character builder: what kind of
 * campaign, which Adventure Path (if it's one), then the details. An Adventure Path
 * prefills the title, starting level, backstory and cover, all of which the GM can
 * change before creating it.
 */
export default function CampaignCreatePage() {
  const campaigns = useCampaignService();
  const navigate = useNavigate();
  const [kind, setKind] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [path, setPath] = useState(null);
  const [step, setStep] = useState('kind');
  // Show only paths with this theme or edition (null: every path).
  const [theme, setTheme] = useState(null);
  const matches = (p) => !theme || (theme === 'remastered' ? !p.preRemaster : theme === 'pre-remaster' ? p.preRemaster : pathThemes(p).includes(theme));
  // The chosen path's cover as a File to prefill the form with (null: it has none),
  // with the slug it belongs to, so a previous path's cover is never shown.
  const [cover, setCover] = useState({ slug: null, file: null });

  const steps = kind === 'adventure-path' ? ['kind', 'path', 'details'] : ['kind', 'details'];
  const index = steps.indexOf(step);
  const info = STEP_INFO[step];
  const go = (next) => {
    setStep(next);
    window.scrollTo(0, 0);
  };

  useEffect(() => {
    if (step !== 'details' || !path) return undefined;
    let cancelled = false;
    adventureCoverFile(path.slug).then(
      (file) => !cancelled && setCover({ slug: path.slug, file }),
      () => !cancelled && setCover({ slug: path.slug, file: null }),
    );
    return () => {
      cancelled = true;
    };
  }, [step, path]);

  const create = async (input) => {
    const campaign = await campaigns.create({ ...input, adventurePath: path?.slug ?? null });
    navigate(`/campaigns/${campaign.id}`, { replace: true, state: { created: true } });
  };

  const selected = chosen && adventurePath(chosen);
  return (
    <PageShell
      crumbs={[{ label: 'Campaigns', to: '/home?mode=gm' }, { label: 'New campaign' }]}
      actions={<Link to="/home" className="btn btn--small">Cancel</Link>}
    >
      <nav className="steps" aria-label="Campaign steps">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`steps__pip ${i < index ? 'steps__pip--touched' : ''}`}
            aria-current={s === step ? 'step' : undefined}
            aria-label={`Step ${i + 1}: ${STEP_INFO[s].title}`}
            disabled={i > index}
            onClick={() => go(s)}
          />
        ))}
      </nav>
      <header className="builder__header">
        <span className="eyebrow">
          Game master · Step {index + 1} of {steps.length}
        </span>
        <h1 className="title">{info.title}</h1>
        <p className="rule-note">{info.note}</p>
      </header>

      {step === 'kind' && (
        <div className="narrow">
          <div className="kind-choice" role="radiogroup" aria-label="Kind of campaign">
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="kind-card" onClick={() => setKind(k.id)}>
                <span className="kind-card__title">{k.title}</span>
                <span className="kind-card__text">{k.text}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--blood"
            disabled={!kind}
            onClick={() => {
              if (kind === 'homebrew') setPath(null);
              go(kind === 'homebrew' ? 'details' : 'path');
            }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 'path' && (
        <>
          <div className="theme-filter" role="group" aria-label="Show Adventure Paths by theme">
            <button type="button" className="chip" aria-pressed={!theme} onClick={() => setTheme(null)}>All</button>
            {Object.entries(EDITIONS).map(([id, e]) => (
              <button key={id} type="button" className="chip" aria-pressed={theme === id} title={e.about} onClick={() => setTheme(theme === id ? null : id)}>
                {e.label}
              </button>
            ))}
            {Object.entries(THEMES)
              .filter(([id]) => ADVENTURE_PATHS.some((p) => pathThemes(p).includes(id)))
              .map(([id, t]) => (
                <button key={id} type="button" className={`chip chip--theme-${id}`} aria-pressed={theme === id} title={t.about} onClick={() => setTheme(theme === id ? null : id)}>
                  {t.label}
                </button>
              ))}
          </div>
          {theme && <p className="rule-note theme-filter__about">{(THEMES[theme] ?? EDITIONS[theme]).about}</p>}
          <ul className="paths" role="radiogroup" aria-label="Adventure Paths">
            {ADVENTURE_PATHS.filter(matches).map((p) => (
              <li key={p.slug}>
                <button type="button" role="radio" aria-checked={chosen === p.slug} className="path-card" onClick={() => setChosen(p.slug)}>
                  <PathArt path={p} />
                  <span className="path-card__body">
                    {/* Without a cover, the title card already shows the name. */}
                    {adventureCover(p.slug) && <span className="path-card__name">{p.name}</span>}
                    <span className="path-card__meta">
                      Levels {p.levels[0]}–{p.levels[1]} · {p.setting}
                    </span>
                    <span className="path-card__tags">
                      {pathThemes(p).map((t) => (
                        <span key={t} className={`tag tag--theme tag--theme-${t}`} title={THEMES[t].about}>{THEMES[t].label}</span>
                      ))}
                      {p.status === 'upcoming' && <span className="tag tag--warn">Coming soon</span>}
                      {p.edition && <span className="tag">{p.edition}</span>}
                      {p.mythic && <span className="tag">Mythic</span>}
                      {p.preRemaster && <span className="tag">Pre-Remaster</span>}
                    </span>
                    {chosen === p.slug && (
                      <span className="path-card__more" aria-live="polite">
                        <span className="path-card__synopsis">{p.synopsis}</span>
                        {pathNotes(p).map((n) => (
                          <span key={n} className="path-card__note">{n}</span>
                        ))}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="btn-row path-actions">
            <button type="button" className="btn" onClick={() => go('kind')}>Back</button>
            <button
              type="button"
              className="btn btn--blood btn--grow"
              disabled={!selected}
              onClick={() => {
                setPath(selected);
                go('details');
              }}
            >
              {selected ? `Run ${selected.name}` : 'Choose an Adventure Path'}
            </button>
          </div>
        </>
      )}

      {step === 'details' &&
        (path && cover.slug !== path.slug ? (
          <p className="muted italic center">Unrolling {path.name}…</p>
        ) : (
          <CampaignForm
            key={path?.slug ?? 'homebrew'}
            initial={path ? { name: path.name, partyLevel: path.levels[0] } : undefined}
            prefill={path ? { from: path.name, backstory: path.synopsis, cover: cover.file } : undefined}
            submitLabel="Create campaign"
            onSubmit={create}
          >
            <button type="button" className="btn" onClick={() => go(path ? 'path' : 'kind')}>Back</button>
          </CampaignForm>
        ))}
    </PageShell>
  );
}
