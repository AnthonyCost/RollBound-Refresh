import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ADVENTURE_PATHS, THEMES, adventurePath, pathThemes } from '@rollbound/rules';
import { useCampaignService } from '../state/campaignService.js';
import { adventureCover, adventureCoverFile } from '../state/adventureCovers.js';
import PageShell from '../components/PageShell.jsx';
import CampaignForm from '../components/CampaignForm.jsx';
import BookSpread from '../components/BookSpread.jsx';
import BookLeaf, { wide } from '../builder/BookLeaf.jsx';
import Icon from '../components/Icon.jsx';
import adventureArt from '../assets/art/campaign-kind-adventure.webp';
import homebrewArt from '../assets/art/campaign-kind-homebrew.webp';

const KINDS = [
  {
    id: 'adventure-path',
    title: 'Adventure Path',
    text: "Run one of Paizo's published campaigns.",
    gets: ['A written story, start to finish', 'Premise and level filled in'],
    icon: 'book',
    art: adventureArt,
  },
  {
    id: 'homebrew',
    title: 'Homebrew',
    text: 'Start from a blank page with your own world and story.',
    gets: ['Your world, your rules', 'Everything left for you to write'],
    icon: 'lore',
    art: homebrewArt,
  },
];

// The book of Adventure Paths: what's coming, then by the rules they were written for.
const PATH_SECTIONS = [
  { key: 'upcoming', tab: 'Coming soon', name: 'Coming soon' },
  { key: 'remastered', tab: 'Remastered', name: 'Remastered' },
  { key: 'pre', tab: 'Pre-Remaster', name: 'Pre-Remaster' },
];
const sectionOfPath = (p) => (p.status === 'upcoming' ? 'upcoming' : p.preRemaster ? 'pre' : 'remastered');
const BY_SECTION = PATH_SECTIONS.flatMap(({ key }) => ADVENTURE_PATHS.filter((p) => sectionOfPath(p) === key));

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
  // The path open in the book: on wide screens the newest opens to start with.
  const [chosen, setChosen] = useState(() => (wide() ? BY_SECTION[0]?.slug ?? null : null));
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
      crumbs={[{ label: 'Campaigns', to: '/campaigns' }, { label: 'New Campaign' }]}
      actions={<Link to="/campaigns" className="btn btn--small">Cancel</Link>}
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
        <div className="tome-choice">
          <div className="kind-choice" role="radiogroup" aria-label="Kind of campaign">
            {KINDS.map((k) => (
              <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className="kind-card tome-card" onClick={() => setKind(k.id)}>
                <img className="tome-card__art" src={k.art} alt="" />
                <span className="tome-card__emblem" aria-hidden="true"><Icon name={k.icon} size={30} /></span>
                <span className="kind-card__title">{k.title}</span>
                <span className="kind-card__text">{k.text}</span>
                <span className="tome-card__gets">
                  {k.gets.map((g) => <span key={g}>{g}</span>)}
                </span>
                <span className="tome-card__pick" aria-hidden="true">{kind === k.id ? 'Chosen' : 'Choose'}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--blood tome-choice__go"
            disabled={!kind}
            onClick={() => {
              if (kind === 'homebrew') setPath(null);
              go(kind === 'homebrew' ? 'details' : 'path');
            }}
          >
            {kind ? `Continue with ${KINDS.find((k) => k.id === kind).title}` : 'Choose one to continue'}
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
          <BookSpread
            items={BY_SECTION.filter(matches)}
            total={ADVENTURE_PATHS.length}
            noun="Adventure Paths"
            sections={PATH_SECTIONS}
            sectionOf={sectionOfPath}
            tabsOnTop
            open={selected && matches(selected) ? selected : null}
            onOpen={(p) => setChosen(p.slug)}
            resetKey={theme ?? ''}
            filtered={Boolean(theme)}
            meta={(p) => <span>Levels {p.levels[0]}–{p.levels[1]}</span>}
            emptyText="No Adventure Path has that theme."
            blankIcon="book"
            blank={
              <>
                <p className="book__blank-title">The Adventure Paths</p>
                <p className="rule-note">Open one to read its premise, then run it.</p>
              </>
            }
            leaf={selected && (
              <BookLeaf
                key={selected.slug}
                eyebrow={`${selected.setting} · Levels ${selected.levels[0]}–${selected.levels[1]}`}
                title={selected.name}
                facts={[
                  ['Levels', `${selected.levels[0]}–${selected.levels[1]}`],
                  ['Setting', selected.setting],
                  [selected.status === 'upcoming' ? 'Comes out' : 'Released', longDate(selected.released)],
                ]}
                notes={
                  <>
                    {adventureCover(selected.slug) && <PathArt path={selected} />}
                    <span className="path-card__tags">
                      {pathThemes(selected).map((t) => (
                        <span key={t} className={`tag tag--theme tag--theme-${t}`} title={THEMES[t].about}>{THEMES[t].label}</span>
                      ))}
                      {selected.status === 'upcoming' && <span className="tag tag--warn">Coming soon</span>}
                      {selected.edition && <span className="tag">{selected.edition}</span>}
                      {selected.mythic && <span className="tag">Mythic</span>}
                      {selected.preRemaster && <span className="tag">Pre-Remaster</span>}
                    </span>
                    <p className="path-leaf__synopsis">{selected.synopsis}</p>
                    {pathNotes(selected).map((n) => <p key={n} className="rule-note path-leaf__note">{n}</p>)}
                  </>
                }
                onClose={() => setChosen(null)}
              >
                <button
                  type="button"
                  className="btn btn--blood"
                  onClick={() => {
                    setPath(selected);
                    go('details');
                  }}
                >
                  Run {selected.name}
                </button>
              </BookLeaf>
            )}
          />
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => go('kind')}>Back</button>
          </div>
        </>
      )}

      {step === 'details' &&
        (path && cover.slug !== path.slug ? (
          <p className="muted italic center">Unrolling {path.name}…</p>
        ) : (
          <div className="tome">
          <CampaignForm
            key={path?.slug ?? 'homebrew'}
            initial={path ? { name: path.name, partyLevel: path.levels[0] } : undefined}
            prefill={path ? { from: path.name, backstory: path.synopsis, cover: cover.file } : undefined}
            submitLabel="Create campaign"
            onSubmit={create}
          >
            <button type="button" className="btn" onClick={() => go(path ? 'path' : 'kind')}>Back</button>
          </CampaignForm>
          </div>
        ))}
    </PageShell>
  );
}
