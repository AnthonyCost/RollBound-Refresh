import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import homeMap from '../assets/home-map.webp';
import { adventurePath } from '@rollbound/rules';
import { CharacterCard } from './CharactersPage.jsx';

// How many characters and campaigns Home shows; See All opens the rest.
const RECENT = 6;
// Newest first: IDs go up as things are created.
const newestFirst = (a, b) => b.id - a.id;
/** "October 24, 2026" for a "2026-10-24" date, read as written (no time zone shift). */
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

// Places to go besides your own table.
const EXPLORE = [
  { to: '/bestiary', icon: 'book', name: 'Bestiary', text: 'Every creature, with full stat blocks.' },
  { to: '/spells', icon: 'spark', name: 'Spell Book', text: 'Search every spell by rank and tradition.' },
  { to: '/learn/overview', icon: 'learn', name: 'Learning The Game', text: 'Short lessons, from the first roll to running a game.' },
  { to: '/resources', icon: 'links', name: 'Resources', text: 'Free rules, the rules reference, books and tools.' },
];

/** A home section: its title links to the full page, with the section's main action beside it. */
function Section({ id, title, to, count, action, children }) {
  return (
    <section className="home-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="home-section__head">
        <h2 id={`${id}-title`}>
          <Link to={to}>{title}</Link>
          {count > 0 && <span className="home-section__count">{count}</span>}
        </h2>
        <div className="home-section__actions">
          {action}
          <Link to={to} className="home-section__all">See All</Link>
        </div>
      </div>
      {children}
    </section>
  );
}

/** The newest session log from your campaigns, as a card that opens it in the campaign's journal. */
function LatestLog({ log }) {
  return (
    <Link className="home-log" to={`/campaigns/${log.campaignId}/logs/${log.id}`}>
      <span className="home-log__cover" aria-hidden="true">
        {log.coverUrl ? <img src={log.coverUrl} alt="" /> : <span>{log.campaignName[0]}</span>}
      </span>
      <span className="home-log__text">
        <span className="eyebrow">{log.campaignName} · Session {log.number}</span>
        <span className="home-log__title">{log.title}</span>
        {log.playedOn && <span className="home-log__date">Played {longDate(log.playedOn)}</span>}
        {log.excerpt && <span className="home-log__excerpt">{log.excerpt.length >= 280 ? `${log.excerpt.trimEnd()}…` : log.excerpt}</span>}
        <span className="home-log__more">Read the log ›</span>
      </span>
    </Link>
  );
}

/** One campaign as a compact row: cover, name, your role, and who runs it. */
function CampaignRow({ campaign: c, hosting }) {
  const path = adventurePath(c.adventurePath);
  const mine = c.party.filter((m) => m.mine);
  return (
    <li>
      <Link className="camp-row" to={`/campaigns/${c.id}`}>
        <span className="camp-row__cover" aria-hidden="true">
          {c.coverUrl ? <img src={c.coverUrl} alt="" /> : <span>{c.name[0]}</span>}
        </span>
        <span className="camp-row__text">
          <span className={`camp-row__role ${hosting ? 'camp-row__role--gm' : ''}`}>{hosting ? 'Game Master' : 'Player'}</span>
          <span className="camp-row__name">{c.name}</span>
          <span className="camp-row__meta">
            {path ? path.name : 'Homebrew'} · {c.party.length} {c.party.length === 1 ? 'player' : 'players'}
            {!hosting && ` · Run by ${c.gmName}`}
          </span>
          {mine.length > 0 && <span className="camp-row__mine">Playing {mine.map((m) => m.name).join(', ')}</span>}
        </span>
        <Icon name="arrow" />
      </Link>
    </li>
  );
}

/** Home: a welcome over a map of the world, places to explore, your latest session log, then your newest characters and campaigns. */
export default function HomePage() {
  const { user } = useAuth();
  const service = useCampaignService();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    // A log that can't load only affects its own section, not the whole page.
    Promise.all([api.listCharacters(), service.list(), api.latestLog().catch(() => ({ failed: true }))]).then(
      ([characters, campaigns, latest]) => setData({ characters, latest, ...campaigns }),
      () => setFailed(true),
    );
  }, [service]);
  useEffect(load, [load]);

  // Every campaign once, hosted or played, whichever was created most recently first.
  const campaigns = data ? [...data.running.map((c) => ({ c, hosting: true })), ...data.playing.map((c) => ({ c, hosting: false }))].sort((a, b) => newestFirst(a.c, b.c)) : [];
  const recentCharacters = data ? [...data.characters].sort(newestFirst).slice(0, RECENT) : [];
  const log = data?.latest?.log ?? null;
  const dropCharacter = (id) => setData((d) => ({ ...d, characters: d.characters.filter((c) => c.id !== id) }));

  return (
    <PageShell>
      <header className="home-hero">
        <img className="home-hero__art" src={homeMap} alt="" />
        <div className="home-hero__content">
          <span className="eyebrow">Welcome back</span>
          <h1 className="title">{user.displayName}</h1>
        </div>
      </header>

      <section className="home-explore" aria-labelledby="home-explore-title">
        <h2 className="eyebrow" id="home-explore-title">Explore</h2>
        <ul>
          {EXPLORE.map((e) => (
            <li key={e.to}>
              <Link className="explore-tile" to={e.to}>
                <span className="explore-tile__icon"><Icon name={e.icon} size={22} /></span>
                <span className="explore-tile__text">
                  <span className="explore-tile__name">{e.name}</span>
                  <span className="explore-tile__blurb">{e.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {failed && <p className="form-errors" role="alert">Couldn't load your table. Try refreshing.</p>}
      {!data && !failed && <p className="muted italic center">Gathering your party…</p>}

      {data && (
        <>
          <Section id="home-logs" title="Session Logs" to={log ? `/campaigns/${log.campaignId}/logs` : '/campaigns'}>
            {log ? (
              <LatestLog log={log} />
            ) : (
              <p className="panel panel--dashed muted italic center">
                {data.latest?.failed
                  ? "Couldn't load the latest session log. Try refreshing."
                  : 'No session logs yet. The latest from your campaigns will appear here once a GM writes one.'}
              </p>
            )}
          </Section>

          <Section id="home-characters" title="My Characters" to="/characters" count={data.characters.length} action={<Link to="/create" className="home-section__new">+ New</Link>}>
            {data.characters.length ? (
              <ul className="char-grid">
                {recentCharacters.map((c) => <CharacterCard key={c.id} character={c} onDelete={dropCharacter} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">No characters yet. Create one and they'll gather here.</p>
            )}
          </Section>

          <Section id="home-campaigns" title="Campaigns" to="/campaigns" count={campaigns.length} action={<Link to="/campaigns/new" className="home-section__new">+ New</Link>}>
            {campaigns.length ? (
              <ul className="camp-rows">
                {campaigns.slice(0, RECENT).map(({ c, hosting }) => <CampaignRow key={c.id} campaign={c} hosting={hosting} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">
                No campaigns yet. <Link to="/campaigns/new">Start one</Link> or <Link to="/campaigns">join with an invite code</Link>.
              </p>
            )}
          </Section>
        </>
      )}

    </PageShell>
  );
}
