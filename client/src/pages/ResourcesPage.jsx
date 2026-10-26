import { Link } from 'react-router-dom';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import { cardArtFor } from '../builder/art.js';

// Places outside RollBound worth knowing about, each a tile that opens in a new tab.
// `art` is a class whose banner crop heads the tile.
const RESOURCES = [
  {
    name: 'Free Rules & Adventures',
    site: 'paizo.com',
    icon: 'learn',
    art: 'fighter',
    tags: ['Free', 'Official'],
    text: 'Paizo’s free downloads for Second Edition: a one-hour demo adventure, ready-to-play Remaster heroes and short adventures to try the game.',
    href: 'https://paizo.com/pathfinder/2e/freeresources',
    cta: 'Get the free downloads',
  },
  {
    name: 'Archives of Nethys',
    site: '2e.aonprd.com',
    icon: 'book',
    art: 'cleric',
    tags: ['Free', 'Official'],
    text: 'Every rule, spell, feat, item and creature, free to read and search. Paizo’s official online reference, and where RollBound links for the full rules.',
    href: 'https://2e.aonprd.com/',
    cta: 'Open Archives of Nethys',
  },
  {
    name: 'Paizo Store',
    site: 'store.paizo.com',
    icon: 'crown',
    art: 'alchemist',
    tags: ['Paid', 'Official'],
    text: 'Rulebooks like Player Core and GM Core, the Beginner Box, Adventure Paths, maps, cards and pawns, in print and PDF.',
    href: 'https://store.paizo.com/pathfinder/',
    cta: 'Visit the store',
  },
  {
    name: 'Foundry VTT',
    site: 'foundryvtt.com',
    icon: 'map',
    art: 'guardian',
    tags: ['Play online', 'Paid app, free system'],
    text: 'A virtual tabletop for playing online, with maps, tokens and lighting. Its Pathfinder 2e system automates the rules, and RollBound’s rules data comes from it.',
    href: 'https://foundryvtt.com/packages/pf2e',
    cta: 'See Foundry’s Pathfinder system',
  },
];

// For someone brand new: what to do first, in order.
const START = [
  { title: 'Learn the basics', text: 'Short lessons on the core roll, building a hero and combat.', to: '/learn/overview' },
  { title: 'Try a free adventure', text: 'Paizo’s one-hour demo, with heroes ready to play.', href: 'https://paizo.com/pathfinder/2e/freeresources' },
  { title: 'Look up any rule', text: 'Archives of Nethys has all of it, free.', href: 'https://2e.aonprd.com/' },
];

function StartStep({ step, number }) {
  const inner = (
    <>
      <span className="start__number">{number}</span>
      <span className="start__text">
        <span className="start__title">
          {step.title} {step.href && <Icon name="external" size={14} />}
        </span>
        <span className="start__blurb">{step.text}</span>
      </span>
      <Icon name="arrow" />
    </>
  );
  return step.to ? (
    <Link className="start__step" to={step.to}>{inner}</Link>
  ) : (
    <a className="start__step" href={step.href} target="_blank" rel="noreferrer">{inner}</a>
  );
}

/** Resources: where to start, then tiles that link out to Pathfinder sites and tools. */
export default function ResourcesPage() {
  return (
    <PageShell crumbs={[{ label: 'Resources' }]}>
      <header className="resources__head">
        <h1 className="title">Resources</h1>
        <p className="rule-note">Rules, books and tools for playing Pathfinder, beyond RollBound.</p>
      </header>

      <section className="panel start" aria-labelledby="start-title">
        <h2 className="panel__title" id="start-title">New to Pathfinder? Start here</h2>
        <ol className="start__steps">
          {START.map((s, i) => (
            <li key={s.title}>
              <StartStep step={s} number={i + 1} />
            </li>
          ))}
        </ol>
      </section>

      <div className="ornament" aria-hidden="true">
        <span className="ornament__label">EVERYTHING ELSE</span>
      </div>

      <ul className="resources">
        {RESOURCES.map((r) => (
          <li key={r.name}>
            <a className="resource" href={r.href} target="_blank" rel="noreferrer">
              <span className="resource__art">
                <span className="resource__frame">{cardArtFor(r.art) && <img src={cardArtFor(r.art)} alt="" loading="lazy" />}</span>
                <span className="resource__icon"><Icon name={r.icon} size={28} /></span>
              </span>
              <span className="resource__body">
                <span className="resource__tags">
                  {r.tags.map((t) => (
                    <span key={t} className={`resource__tag ${t === 'Free' ? 'resource__tag--free' : ''}`}>{t}</span>
                  ))}
                </span>
                <span className="resource__name">{r.name}</span>
                <span className="resource__site">{r.site}</span>
                <span className="resource__text">{r.text}</span>
                <span className="resource__cta">
                  {r.cta} <Icon name="external" size={14} />
                </span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
