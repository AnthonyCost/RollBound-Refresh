import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import StyleLabPalette from './StyleLabPalette.jsx';
import StyleLabDice from './StyleLabDice.jsx';
import Portrait from '../components/Portrait.jsx';
import Icon from '../components/Icon.jsx';
import { cardArtFor, artFor, PLACEHOLDER_ART } from '../builder/art.js';
import cover from '../assets/campaign-covers/mountain-shrine.webp';
import './styleLab.css';

/*
 * Style lab: the proposed visual changes, side by side with how the site looks today.
 * Sample content only. Nothing here is saved, and no other page uses this file or styleLab.css,
 * so deleting the two files and the /style-lab route removes it completely.
 */

const HEROES = [
  { name: 'Valeros', line: 'Level 1 · Human · Fighter', campaign: 'The Sunken Vault', slug: 'fighter', portrait: '/stock/valeros.webp' },
  { name: 'Ezren', line: 'Level 1 · Human · Wizard', campaign: null, slug: 'wizard', portrait: '/stock/ezren.webp' },
  { name: 'Merisiel', line: 'Level 1 · Elf · Rogue', campaign: null, slug: 'rogue', portrait: '/stock/merisiel.webp' },
  { name: 'Kyra', line: 'Level 1 · Human · Cleric', campaign: 'Wolves at the Ford', slug: 'cleric', portrait: '/stock/kyra.webp' },
];

const DEFENSES = [
  { label: 'Armor Class', short: 'AC', value: '18', note: 'Chain mail' },
  { label: 'Fortitude', short: 'Fort', value: '+7' },
  { label: 'Reflex', short: 'Ref', value: '+6' },
  { label: 'Will', short: 'Will', value: '+5' },
  { label: 'Perception', short: 'Perc', value: '+7' },
  { label: 'Class DC', short: 'DC', value: '17' },
  { label: 'Speed', short: 'Speed', value: '25', unit: 'ft' },
];

const noNav = (e) => e.preventDefault();

/** One comparison: what changes, then today's version or the proposed one. */
function Study({ n, title, why, before, after, mode }) {
  return (
    <section className="lab-study" aria-labelledby={`lab-${n}`}>
      <header className="lab-study__head">
        <h2 id={`lab-${n}`}>{title}</h2>
        <p>{why}</p>
      </header>
      <div className={`lab-stage lab-stage--${mode}`}>
        {mode !== 'after' && <div className="lab-pane lab-before"><span className="lab-pane__tag">Today</span>{before}</div>}
        {mode !== 'before' && <div className="lab-pane lab-after"><span className="lab-pane__tag">Proposed</span>{after}</div>}
      </div>
    </section>
  );
}

/* ---------- 1 · Type ---------- */

function TypeBefore() {
  return (
    <div className="lab-col">
      <header className="list-head">
        <div>
          <h1 className="title">My Characters</h1>
          <p className="list-head__count">24 characters</p>
        </div>
        <a href="#" onClick={noNav} className="btn btn--blood">Create a Character</a>
      </header>
      <section className="sheet-panel">
        <h2 className="sheet-panel__title">The chronicle</h2>
        <p className="backstory">Beneath the drowned chapel lies a vault no one has opened in three hundred years.</p>
      </section>
      <div className="field"><label htmlFor="lab-email-a">Email</label><input id="lab-email-a" placeholder="you@example.com" /></div>
    </div>
  );
}

function TypeAfter() {
  return (
    <div className="lab-col">
      <header className="x-head">
        <div>
          <h1 className="x-title">My characters</h1>
          <p className="x-count">24 characters</p>
        </div>
        <a href="#" onClick={noNav} className="x-btn x-btn--blood">Create a character</a>
      </header>
      <section>
        <h2 className="x-h2 x-accent">The Sunken Vault</h2>
        <p className="x-body">Beneath the drowned chapel lies a vault no one has opened in three hundred years.</p>
      </section>
      <div className="x-field"><label htmlFor="lab-email-b">Email</label><input id="lab-email-b" placeholder="you@example.com" /></div>
    </div>
  );
}

/* ---------- 2 · Character cards ---------- */

function CardBefore({ hero: h }) {
  return (
    <li className="char-card">
      <a href="#" onClick={noNav} className="char-card__banner">
        <img className="char-card__art char-card__art--banner" src={cardArtFor(h.slug) ?? PLACEHOLDER_ART} alt="" />
        <Portrait url={h.portrait} name={h.name} size="lg" />
        <span className="char-card__text">
          <span className="char-card__name">{h.name}</span>
          <span className="char-card__line">{h.line}</span>
          <span className="char-card__campaign">{h.campaign ?? 'No campaign'}</span>
        </span>
      </a>
      <div className="char-card__actions">
        <a href="#" onClick={noNav}>View</a>
        <a href="#" onClick={noNav}>Edit</a>
        <button type="button" className="char-card__delete">Delete</button>
      </div>
    </li>
  );
}

/** The whole card opens the sheet; the rarer actions wait behind a menu. */
function CardAfter({ hero: h }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <li className="x-card">
      <a href="#" onClick={noNav} className="x-card__open">
        <img className="x-card__art" src={artFor('class', h.slug)} alt="" />
        <span className="x-card__text">
          <span className="x-card__name">{h.name}</span>
          <span className="x-card__line">{h.line}</span>
          {h.campaign && <span className="x-card__camp">In {h.campaign}</span>}
        </span>
      </a>
      <div className="x-card__menu" ref={ref}>
        <button type="button" className="x-card__more" aria-label={`More for ${h.name}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
        </button>
        {open && (
          <ul className="x-menu">
            <li><button type="button" onClick={() => setOpen(false)}>Edit build</button></li>
            <li><button type="button" onClick={() => setOpen(false)}>Download PDF</button></li>
            <li><button type="button" className="x-menu__danger" onClick={() => setOpen(false)}>Delete…</button></li>
          </ul>
        )}
      </div>
    </li>
  );
}

/* ---------- 3 · Campaign: fewer boxes ---------- */

function CampaignBefore() {
  return (
    <div className="lab-camp-before">
      <aside className="sheet-panel campaign-card">
        <h2 className="sheet-panel__title">At a glance</h2>
        <dl className="campaign-card__stats">
          <div><dt>Party</dt><dd>1</dd></div>
          <div><dt>Party level</dt><dd>1</dd></div>
          <div><dt>Sessions</dt><dd>0 ›</dd></div>
        </dl>
      </aside>
      <section className="sheet-panel campaign-chronicle">
        <h2 className="sheet-panel__title">The chronicle</h2>
        <p className="backstory campaign-chronicle__story">Beneath the drowned chapel lies a vault no one has opened in three hundred years. Sam is gathering a party to open it.</p>
      </section>
    </div>
  );
}

function CampaignAfter() {
  return (
    <article className="x-camp">
      <div className="x-camp__banner">
        <img src={cover} alt="" />
        <div className="x-camp__title">
          <h3>The Sunken Vault</h3>
          <p>Run by Sam · Homebrew · 1 player · Party level 1 · No sessions yet</p>
        </div>
      </div>
      <p className="x-body x-camp__story">Beneath the drowned chapel lies a vault no one has opened in three hundred years. Sam is gathering a party to open it.</p>
    </article>
  );
}

/* ---------- 4 · Sheet: one stat line, figures that line up ---------- */

function SheetBefore() {
  return (
    <div className="lab-col">
      <section className="sheet-panel sheet-defense lab-defense-before">
        {DEFENSES.filter((d) => d.short !== 'DC').map((d) => (
          <div key={d.label} className="sheet-def">
            <span className="sheet-def__label">{d.label}</span>
            <span className="sheet-def__value">{d.value}{d.unit && <small> {d.unit}</small>}</span>
            {d.note && <span className="sheet-def__extra">{d.note}</span>}
          </div>
        ))}
      </section>
      <section className="sheet-panel lab-dc-before">
        <h2 className="sheet-panel__title">Class DC</h2>
        <div className="sheet-def"><span className="sheet-def__label">Class DC</span><span className="sheet-def__value">17</span></div>
      </section>
    </div>
  );
}

function SheetAfter() {
  return (
    <div className="x-sheet">
      <dl className="x-stats">
        {DEFENSES.map((d) => (
          <div key={d.label} className={d.short === 'AC' ? 'x-stat x-stat--ac' : 'x-stat'}>
            <dt><abbr title={d.label}>{d.short}</abbr></dt>
            <dd>{d.value}{d.unit && <small>{d.unit}</small>}</dd>
            {d.note && <span className="x-stat__note">{d.note}</span>}
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ---------- 5 · Learn: no section numbers, no stripe ---------- */

function LearnBefore() {
  return (
    <section className="lesson">
      <h2 className="lesson__title"><span className="lesson__number">7</span> What you need</h2>
      <p>A set of polyhedral dice, a character sheet, and the rules. The full rules are free to read on Archives of Nethys.</p>
      <p className="lesson__tip"><span className="eyebrow">In RollBound</span> RollBound keeps your character sheet and does the maths for you. <a href="#" onClick={noNav}>Create a character</a></p>
    </section>
  );
}

function LearnAfter() {
  return (
    <section className="x-lesson">
      <h2 className="x-h2">What you need</h2>
      <p className="x-body">A set of polyhedral dice, a character sheet, and the rules. The full rules are free to read on Archives of Nethys.</p>
      <aside className="x-tip">
        <Icon name="sheet" size={22} />
        <p>RollBound keeps your character sheet and does the maths for you. <a href="#" onClick={noNav}>Create a character</a></p>
      </aside>
    </section>
  );
}

/* ---------- 6 · Create: the page is the decision ---------- */

function StartBefore() {
  return (
    <ul className="start-choices">
      <li><button type="button" className="start-choice"><img className="start-choice__art" src={PLACEHOLDER_ART} alt="" /><span className="start-choice__text"><span className="eyebrow">Step by step</span><span className="start-choice__name">Build your own</span><span className="start-choice__blurb">Choose an ancestry, background and class. Every choice is explained.</span></span></button></li>
      <li><button type="button" className="start-choice"><img className="start-choice__art" src={artFor('class', 'champion')} alt="" /><span className="start-choice__text"><span className="eyebrow">24 heroes</span><span className="start-choice__name">Play a pregenerated hero</span><span className="start-choice__blurb">Pick one of Pathfinder's iconic heroes, ready to play.</span></span></button></li>
    </ul>
  );
}

function StartAfter() {
  return (
    <ul className="x-start">
      <li><button type="button" className="x-start__choice"><img src={PLACEHOLDER_ART} alt="" /><span className="x-start__text"><span className="x-start__name">Build your own</span><span className="x-start__blurb">Ancestry, background, class, then the rest. Every choice is explained.</span></span></button></li>
      <li><button type="button" className="x-start__choice"><img src={artFor('class', 'champion')} alt="" /><span className="x-start__text"><span className="x-start__name">Take an iconic hero</span><span className="x-start__blurb">24 heroes, ready at level 1. Rename them and change anything later.</span></span></button></li>
    </ul>
  );
}

/* ---------- 7 · The browser's own parts ---------- */

function SurfaceDemo() {
  return (
    <div className="lab-col">
      <p className="x-body">Select this sentence to see the highlight color. Then try the dropdown and the checkbox.</p>
      <div className="lab-row">
        <label className="x-field x-field--inline">Sort by
          <select defaultValue="name"><option value="name">Name</option><option value="level">Level</option><option value="newest">Newest</option></select>
        </label>
        <label className="x-check"><input type="checkbox" defaultChecked /> Show rare creatures</label>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'proposals', label: 'Proposals', icon: 'overview' },
  { id: 'palette', label: 'Themes', icon: 'spark' },
  { id: 'dice', label: 'Dice', icon: 'roll' },
];

/** The lab's tabs, as the site's own tab bar; the tab lives in the URL (?tab=palette) so it can be linked. */
function LabTabs({ tab }) {
  return (
    <nav className="nav" aria-label="Style lab">
      {TABS.map((t) => (
        <Link key={t.id} to={t.id === 'proposals' ? '/style-lab' : `/style-lab?tab=${t.id}`} className={tab === t.id ? 'active' : undefined} aria-current={tab === t.id ? 'page' : undefined}>
          <Icon name={t.icon} size={22} />
          {t.label.toUpperCase()}
        </Link>
      ))}
    </nav>
  );
}

export default function StyleLabPage() {
  const [mode, setMode] = useState('both');
  const [params] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'proposals';
  return (
    <PageShell crumbs={[{ label: 'Style lab' }]} tabs={<LabTabs tab={tab} />}>
      <div className="lab">
        <header className="lab-intro">
          <h1 className="x-title">Style lab</h1>
          <p className="x-body">
            {tab === 'dice' ? 'Every die in the current theme. Click one to roll it.' : tab === 'palette'
              ? 'A color scheme to try on RollBound, shown on the site’s real components. Nothing here is live anywhere else on the site.'
              : 'Proposed changes to make RollBound feel made rather than generated, on sample content. Nothing here is live anywhere else on the site.'}
          </p>
          {tab === 'proposals' && (
            <div className="lab-toggle" role="group" aria-label="Show">
              {[['before', 'Today'], ['both', 'Side by side'], ['after', 'Proposed']].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)}>{label}</button>
              ))}
            </div>
          )}
        </header>

        {tab === 'dice' ? <StyleLabDice /> : tab === 'palette' ? <StyleLabPalette /> : (
        <>

        <Study mode={mode} n={1} title="Capitals only where they label, and a second typeface"
          why="Headings and buttons in title case at normal spacing. Old Fenris, already loaded but never used, takes campaign and hero names."
          before={<TypeBefore />} after={<TypeAfter />} />

        <Study mode={mode} n={2} title="Character cards: the art leads, the buttons go"
          why="The whole card opens the sheet. Edit and Delete move behind a menu, so the page isn't 72 buttons with 24 red Deletes."
          before={<ul className="char-grid lab-grid">{HEROES.map((h) => <CardBefore key={h.name} hero={h} />)}</ul>}
          after={<ul className="x-cards">{HEROES.map((h) => <CardAfter key={h.name} hero={h} />)}</ul>} />

        <Study mode={mode} n={3} title="Campaign: fewer boxes"
          why="A panel of 1, 1 and 0 becomes one line under the title. The story reads as text, not as the contents of another frame."
          before={<CampaignBefore />} after={<CampaignAfter />} />

        <Study mode={mode} n={4} title="Character sheet: one stat line"
          why="Defences, Class DC and Speed share a single ruled row. Numbers use tabular figures so they line up, and the corner brackets stay here, where the page really is a sheet."
          before={<SheetBefore />} after={<SheetAfter />} />

        <Study mode={mode} n={5} title="Learn: no numbered boxes or edge stripe"
          why="The heading carries itself. The tip gets a quiet full border and an icon instead of a gold stripe and a caps label."
          before={<LearnBefore />} after={<LearnAfter />} />

        <Study mode={mode} n={6} title="Create: the choice fills the page"
          why="Two tall panels where the art does the work, instead of two short cards above half a screen of nothing."
          before={<StartBefore />} after={<StartAfter />} />

        <section className="lab-study" aria-labelledby="lab-7">
          <header className="lab-study__head">
            <h2 id="lab-7">The browser's own parts</h2>
            <p>Text selection, dropdowns and checkboxes in the site's colors rather than browser blue and grey.</p>
          </header>
          <div className={`lab-stage lab-stage--${mode}`}>
            {mode !== 'after' && <div className="lab-pane lab-before"><span className="lab-pane__tag">Today</span><SurfaceDemo /></div>}
            {mode !== 'before' && <div className="lab-pane lab-after"><span className="lab-pane__tag">Proposed</span><SurfaceDemo /></div>}
          </div>
        </section>
        </>
        )}
      </div>
    </PageShell>
  );
}
