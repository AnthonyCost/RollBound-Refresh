import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useCampaignService } from '../state/campaignService.js';
import { inboxChanged, onInboxChanged } from '../state/inbox.js';
import { lastCampaign } from '../state/lastCampaign.js';
import { isOutdated } from '../state/rulesData.js';
import { campaignCover } from '../state/campaignCovers.js';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import Portrait from '../components/Portrait.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import homeMap from '../assets/home-map.webp';
import buildArt from '../assets/start/build-your-own.webp';
import campaignArt from '../assets/campaign-covers/snowy-village.webp';
import bestiaryArt from '../assets/creatures/adult-cinder-dragon.webp';
import spellsArt from '../assets/art/class-wizard.webp';
import learnArt from '../assets/resources/free-rules.webp';
import { adventurePath } from '@rollbound/rules';
import { classArtOf, lineOf } from './CharactersPage.jsx';

// How many characters, campaigns and party portraits Home shows; See All opens the rest.
const RECENT_CHARACTERS = 4;
const RECENT_CAMPAIGNS = 3;
const PARTY_SHOWN = 6;
// Newest first: IDs go up as things are created.
const newestFirst = (a, b) => b.id - a.id;
/** "October 24, 2026" for a "2026-10-24" date, read as written (no time zone shift). */
const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Places to go besides your own table.
const REFERENCE = [
  { to: '/bestiary', icon: 'bestiary', name: 'Bestiary' },
  { to: '/spells', icon: 'spells', name: 'Spells' },
  { to: '/armory', icon: 'armory', name: 'Armory' },
  { to: '/learn/overview', icon: 'learn', name: 'Learn' },
  { to: '/resources', icon: 'links', name: 'Resources' },
];

// A new account's first look: the places to start, as big art panels like the builder's
// start screen. The first two are what you make; the rest are what you can explore.
const WELCOME = [
  { to: '/create', art: buildArt, at: '40% 100%', name: 'Build your first hero', blurb: 'Pick an ancestry, background and class, or start with an iconic hero. Each step explains what your choices do.' },
  { to: '/campaigns/new', art: campaignArt, at: '50% 60%', name: 'Start a campaign', blurb: 'Gather a party with an invite code, then run encounters, track initiative and keep session logs.' },
  { to: '/bestiary', art: bestiaryArt, at: '50% 25%', name: 'Bestiary', blurb: 'Hundreds of creatures with full stat blocks.' },
  { to: '/spells', art: spellsArt, at: '50% 8%', name: 'Spell Book', blurb: 'Every spell with its ranks, traditions and full rules text.' },
  { to: '/learn/overview', art: learnArt, at: '50% 35%', name: 'Learn the Game', blurb: 'New to Pathfinder? Short guides to checks, combat and your first session.' },
];

function Welcome() {
  return (
    <section className="home-welcome" aria-labelledby="home-welcome-title">
      <h2 id="home-welcome-title" className="eyebrow">Where to begin</h2>
      <ul className="home-welcome__grid">
        {WELCOME.map((w) => (
          <li key={w.to}>
            <Link className="start-choice" to={w.to}>
              <img className="start-choice__art" src={w.art} alt="" style={{ objectPosition: w.at }} />
              <span className="start-choice__text">
                <span className="start-choice__name">{w.name}</span>
                <span className="start-choice__blurb">{w.blurb}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="rule-note">Have an invite code from your GM? <Link to="/campaigns">Join a campaign</Link>.</p>
    </section>
  );
}

/** A home section: its title links to the full page, with the section's main action beside it. */
function Section({ id, title, to, count, action, children }) {
  return (
    <section className={`home-section ${id}`} id={id} aria-labelledby={`${id}-title`}>
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

/** The top of the page: art beside what to do next. */
function Spotlight({ art, tag, gm = false, title, lines, party, children }) {
  return (
    <section className="home-spotlight" aria-labelledby="home-spotlight-title">
      <div className={`home-spotlight__art ${art ? '' : 'home-spotlight__art--map'}`} aria-hidden="true">
        <img src={art ?? homeMap} alt="" />
      </div>
      <div className="home-spotlight__text">
        <h2 id="home-spotlight-title" className="home-spotlight__title">{title}</h2>
        {tag && <span className={`camp-row__role ${gm ? 'camp-row__role--gm' : ''}`}>{tag}</span>}
        {lines.filter(Boolean).map((line) => <p key={line} className="home-spotlight__line">{line}</p>)}
        {party}
        <div className="home-spotlight__actions">{children}</div>
      </div>
    </section>
  );
}

/** The party's portraits, overlapping, with a count of any that don't fit. */
function PartyStack({ party }) {
  if (!party.length) return null;
  const extra = party.length - PARTY_SHOWN;
  return (
    <div className="home-party" aria-hidden="true">
      {party.slice(0, PARTY_SHOWN).map((m) => <Portrait key={m.id} url={m.portraitUrl} name={m.name} size="sm" />)}
      {extra > 0 && <span className="home-party__more">+{extra}</span>}
    </div>
  );
}

/** Stands in for the page while it loads, so nothing jumps when the real content arrives. */
function HomeSkeleton() {
  return (
    <div className="home-skeleton" role="status">
      <span className="visually-hidden">Gathering your party…</span>
      <div className="home-skeleton__spotlight" />
      <div className="home-table" aria-hidden="true">
        <div className="home-skeleton__column">{[0, 1, 2, 3].map((i) => <div key={i} className="home-skeleton__row" />)}</div>
        <div className="home-skeleton__column">{[0, 1, 2].map((i) => <div key={i} className="home-skeleton__row home-skeleton__row--tall" />)}</div>
      </div>
    </div>
  );
}

/** Picks up the campaign you were last in, with the shortcuts your role uses most. */
function ContinueCampaign({ campaign: c, hosting }) {
  const [logs, setLogs] = useState(null);
  const [encounters, setEncounters] = useState(null);
  useEffect(() => {
    api.listLogs(c.id).then(setLogs, () => setLogs([]));
    if (hosting) api.listEncounters(c.id).then(setEncounters, () => setEncounters([]));
  }, [c.id, hosting]);

  const path = adventurePath(c.adventurePath);
  const mine = c.party.find((m) => m.mine);
  const ready = encounters?.filter((e) => e.creatures.length).length;
  const latest = logs?.length ? logs.reduce((a, b) => (b.number > a.number ? b : a)) : null;
  const facts = [
    `Party level ${c.partyLevel}`,
    plural(c.party.length, 'player'),
    hosting ? ready > 0 && plural(ready, 'ready encounter') : `Run by ${c.gmName}`,
  ].filter(Boolean).join(' · ');

  return (
    <Spotlight
      art={campaignCover(c)}
      tag={hosting ? 'Game Master' : 'Player'}
      gm={hosting}
      title={c.name}
      lines={[`${path ? path.name : 'Homebrew'} · ${facts}`, latest && `Last session: ${latest.title}`]}
      party={<PartyStack party={c.party} />}
    >
      <Link to={`/campaigns/${c.id}`} className="btn btn--blood">Open Campaign</Link>
      {hosting ? (
        <>
          <Link to={`/campaigns/${c.id}/logs/new`} className="btn">Write Session Log</Link>
          <Link to={`/campaigns/${c.id}/encounters`} className="btn">Encounters</Link>
        </>
      ) : (
        <>
          {mine && <Link to={`/play/${mine.id}/sheet`} className="btn">Character Sheet</Link>}
          <Link to={`/campaigns/${c.id}/logs`} className="btn">Session Logs</Link>
        </>
      )}
    </Spotlight>
  );
}

/** One join request waiting on you. Rejecting can't be undone, so it asks once more. */
function JoinRequest({ request: r, onAnswered }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState([]);
  const answer = async (accept) => {
    setBusy(true);
    setErrors([]);
    try {
      await api.answerJoinRequest(r.id, accept);
      inboxChanged();
    } catch (err) {
      setErrors(errorsFrom(err));
      // Someone else may have answered: show the current state.
      onAnswered();
      setBusy(false);
    }
  };
  const character = r.character;
  return (
    <li className="home-request">
      <Portrait url={character.portraitUrl} name={character.name} size="sm" />
      <p className="home-request__text">
        <strong>{character.name}</strong> wants to join <Link to={`/campaigns/${r.campaign.id}`}>{r.campaign.name}</Link>
        <span className="muted"> · Level {character.level} {[character.ancestry, character.className].filter(Boolean).join(' ')} · Played by {character.player}</span>
      </p>
      <div className="home-request__actions">
        {confirming ? (
          <>
            <button type="button" className="btn btn--small" disabled={busy} onClick={() => setConfirming(false)}>Keep</button>
            <button type="button" className="btn btn--small btn--blood" disabled={busy} onClick={() => answer(false)}>Reject {character.name}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn--small" disabled={busy} onClick={() => setConfirming(true)}>Reject</button>
            <button type="button" className="btn btn--small btn--blood" disabled={busy} onClick={() => answer(true)}>Accept</button>
          </>
        )}
      </div>
      <FormErrors errors={errors} />
    </li>
  );
}

/** Join requests for your campaigns. Only shows when something is waiting. */
function NeedsAttention() {
  const [requests, setRequests] = useState([]);
  const load = useCallback(() => {
    api.inbox().then(
      ({ messages }) => setRequests(messages.filter((m) => m.kind === 'join-request' && m.request?.status === 'pending').map((m) => m.request)),
      () => {},
    );
  }, []);
  useEffect(load, [load]);
  useEffect(() => onInboxChanged(load), [load]);
  if (!requests.length) return null;
  return (
    <section className="home-attention" aria-labelledby="home-attention-title">
      <h2 id="home-attention-title" className="eyebrow">Waiting on you</h2>
      <ul>{requests.map((r) => <JoinRequest key={r.id} request={r} onAnswered={load} />)}</ul>
    </section>
  );
}

/** The newest session log from your campaigns, as a card that opens it in the campaign's journal. */
function LatestLog({ log }) {
  return (
    <Link className="home-log" to={`/campaigns/${log.campaignId}/logs/${log.id}`}>
      <span className="home-log__text">
        <span className="home-log__title">{log.title}</span>
        <span className="home-log__date">
          {log.campaignName} · Session {log.number}
          {log.playedOn && ` · Played ${longDate(log.playedOn)}`}
        </span>
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
          <img src={campaignCover(c)} alt="" />
        </span>
        <span className="camp-row__text">
          <span className={`camp-row__role ${hosting ? 'camp-row__role--gm' : ''}`}>{hosting ? 'Game Master' : 'Player'}</span>
          <span className="camp-row__name">{c.name}</span>
          <span className="camp-row__meta">
            {path ? path.name : 'Homebrew'} · {plural(c.party.length, 'player')}
            {!hosting && ` · Run by ${c.gmName}`}
          </span>
          {mine.length > 0 && <span className="camp-row__mine">Playing {mine.map((m) => m.name).join(', ')}</span>}
        </span>
        <Icon name="arrow" />
      </Link>
    </li>
  );
}

/** One character as a compact row that opens their sheet. Editing and deleting live on the Characters page. */
function CharacterRow({ character: c }) {
  const { banner, isBanner } = classArtOf(c);
  return (
    <li>
      <Link className="char-row" to={`/play/${c.id}/sheet`}>
        {banner && <img className={`char-row__art ${isBanner ? 'char-row__art--banner' : ''}`} src={banner} alt="" />}
        <Portrait url={c.portraitUrl} name={c.name} size="sm" />
        <span className="char-row__text">
          <span className="char-row__name">{c.name}</span>
          <span className="char-row__line">{lineOf(c)}</span>
          {(c.campaignName || c.joinRequest || isOutdated(c.data)) && (
            <span className="char-row__campaign">
              {c.campaignName}
              {c.joinRequest && <span className="char-card__alert">Asked to join {c.joinRequest.campaignName}</span>}
              {isOutdated(c.data) && <span className="char-card__alert">Rules updated</span>}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

/**
 * Home, as a launchpad: what to pick up next, anything waiting on you, your table
 * (characters, campaigns, the latest session), then the reference pages.
 */
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
  const retry = () => {
    setFailed(false);
    load();
  };
  useEffect(load, [load]);
  // Accepting someone changes the party shown on this page.
  useEffect(() => onInboxChanged(load), [load]);

  // Every campaign once, hosted or played, whichever was created most recently first.
  const campaigns = data ? [...data.running.map((c) => ({ c, hosting: true })), ...data.playing.map((c) => ({ c, hosting: false }))].sort((a, b) => newestFirst(a.c, b.c)) : [];
  const characters = data ? [...data.characters].sort(newestFirst) : [];
  const log = data?.latest?.log ?? null;
  const brandNew = data && !characters.length && !campaigns.length;
  // The campaign you were last in, or your newest if that's gone or there isn't one.
  const current = campaigns.find(({ c }) => c.id === lastCampaign(user.id)) ?? campaigns[0];

  return (
    <PageShell>
      <h1 className="home-greeting">{data && brandNew ? 'Welcome' : 'Welcome back'}, {user.displayName}</h1>

      {failed && (
        <div className="form-errors home-failed" role="alert">
          <p>Couldn't load your table. Check your connection, then try again.</p>
          <button type="button" className="btn btn--small" onClick={retry}>Try Again</button>
        </div>
      )}
      {!data && !failed && <HomeSkeleton />}

      {data && (
        <>
          {current && <ContinueCampaign key={current.c.id} campaign={current.c} hosting={current.hosting} />}
          {!current && characters[0] && (
            <Spotlight art={classArtOf(characters[0]).banner} tag="Newest hero" title={characters[0].name} lines={[lineOf(characters[0]), 'Not in a campaign yet.']}>
              <Link to={`/play/${characters[0].id}/sheet`} className="btn btn--blood">Open Sheet</Link>
              <Link to="/campaigns" className="btn">Join a Campaign</Link>
              <Link to="/campaigns/new" className="btn">Start a Campaign</Link>
            </Spotlight>
          )}
          {brandNew && <Welcome />}

          <NeedsAttention />

          {!brandNew && (
            <div className="home-table">
              <Section id="home-characters" title="Your Characters" to="/characters" count={characters.length} action={<Link to="/create" className="home-section__new" aria-label="New character"><Icon name="plus" size={12} />New</Link>}>
                {characters.length ? (
                  <ul className="char-rows">
                    {characters.slice(0, RECENT_CHARACTERS).map((c) => <CharacterRow key={c.id} character={c} />)}
                  </ul>
                ) : (
                  <p className="panel panel--dashed muted italic center"><Link to="/create">Create a character</Link> to bring to your table.</p>
                )}
              </Section>

              <Section id="home-campaigns" title="Your Campaigns" to="/campaigns" count={campaigns.length} action={<Link to="/campaigns/new" className="home-section__new" aria-label="New campaign"><Icon name="plus" size={12} />New</Link>}>
                {campaigns.length ? (
                  <ul className="camp-rows">
                    {campaigns.slice(0, RECENT_CAMPAIGNS).map(({ c, hosting }) => <CampaignRow key={c.id} campaign={c} hosting={hosting} />)}
                    <li>
                      <Link className="home-invite" to="/campaigns">
                        <Icon name="plus" />
                        <span>Have an invite code? Join a campaign</span>
                      </Link>
                    </li>
                  </ul>
                ) : (
                  <p className="panel panel--dashed muted italic center"><Link to="/campaigns/new">Start a campaign</Link> or <Link to="/campaigns">join with an invite code</Link>.</p>
                )}
              </Section>

              {log && (
                <Section id="home-logs" title="Latest Session" to={`/campaigns/${log.campaignId}/logs`}>
                  <LatestLog log={log} />
                </Section>
              )}
            </div>
          )}
        </>
      )}

      <nav className="home-reference" aria-label="Reference">
        <h2 className="eyebrow">Reference</h2>
        <ul>
          {REFERENCE.map((e) => (
            <li key={e.to}>
              <Link className="reference-tile" to={e.to}>
                <Icon name={e.icon} size={22} />
                <span>{e.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </PageShell>
  );
}
