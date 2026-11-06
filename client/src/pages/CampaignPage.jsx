import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import { campaignCover } from '../state/campaignCovers.js';
import InviteCode from '../components/InviteCode.jsx';
import Portrait from '../components/Portrait.jsx';
import Avatar from '../components/Avatar.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { adventurePath } from '@rollbound/rules';
import { booksLabel } from '../state/rulesData.js';
import { api } from '../api.js';
import { inboxChanged, onInboxChanged } from '../state/inbox.js';
import { useAuth } from '../state/AuthContext.jsx';
import { rememberCampaign } from '../state/lastCampaign.js';
import { cardArtFor } from '../builder/art.js';
import { encounterRating } from '../state/encounters.js';
import { useRunningEncounter } from '../state/runningEncounter.js';

/** What each tab under a campaign gets: { campaign, reload, setCrumbs }. */
export const useCampaign = () => useOutletContext();

/**
 * Sets the breadcrumbs after "Campaigns / <name>" while a tab is open, e.g.
 * [{ label: 'Session logs', to: '…' }, { label: 'Session 3' }].
 */
export function useCampaignCrumbs(crumbs) {
  const { setCrumbs } = useCampaign();
  const key = JSON.stringify(crumbs);
  useEffect(() => {
    setCrumbs(JSON.parse(key));
    return () => setCrumbs([]);
  }, [key, setCrumbs]);
}

/**
 * The tabs under a campaign's header, like a GitHub repository's. Encounters and Settings
 * are the GM's alone; while the GM runs an encounter, players get an Encounter tab to watch it.
 */
function CampaignTabs({ id, isGm, running }) {
  const tabs = [
    { to: `/campaigns/${id}`, label: 'Overview', icon: 'overview', end: true },
    { to: `/campaigns/${id}/logs`, label: 'Session logs', icon: 'logs' },
    ...(isGm
      ? [
          { to: `/campaigns/${id}/encounters`, label: 'Encounters', icon: 'swords' },
          { to: `/campaigns/${id}/settings`, label: 'Settings', icon: 'settings' },
        ]
      : running
        ? [{ to: `/campaigns/${id}/encounter`, label: 'Encounter', icon: 'swords' }]
        : []),
  ];
  return (
    <nav className="nav" aria-label="Campaign">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}>
          <Icon name={t.icon} />
          {t.label.toUpperCase()}
        </NavLink>
      ))}
    </nav>
  );
}

/** A campaign's frame: loads it once, then the header, tabs, and the open tab. */
export default function CampaignLayout() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [errors, setErrors] = useState([]);
  const [missing, setMissing] = useState(false);
  const [crumbs, setCrumbs] = useState([]);
  const service = useCampaignService();
  const { user } = useAuth();
  // Players follow the GM's running encounter (the Encounter tab and page).
  const running = useRunningEncounter(id, Boolean(campaign && !campaign.isGm));

  const load = useCallback(() => {
    service
      .get(id)
      .then(setCampaign)
      .catch((err) => (err.status === 404 ? setMissing(true) : setErrors(errorsFrom(err))));
  }, [service, id]);

  useEffect(load, [load]);
  // Answering a request from the inbox updates the party here too.
  useEffect(() => onInboxChanged(load), [load]);
  // Home's Continue card opens with the campaign you were last in.
  useEffect(() => {
    if (campaign && user) rememberCampaign(user.id, campaign.id);
  }, [campaign, user]);
  const all = [
    { label: 'Campaigns', to: '/campaigns' },
    { label: campaign?.name ?? 'Campaign', to: `/campaigns/${id}` },
    ...crumbs,
  ];
  if (missing) {
    return (
      <PageShell crumbs={all}>
        <p className="muted italic center">This campaign doesn't exist, or you're not part of it. <Link to="/campaigns">Back to your campaigns</Link></p>
      </PageShell>
    );
  }
  if (!campaign) {
    return (
      <PageShell crumbs={all}>
        <FormErrors errors={errors} />
        {!errors.length && <p className="muted italic center">Unrolling the map…</p>}
      </PageShell>
    );
  }

  return (
    <PageShell crumbs={all} tabs={<CampaignTabs id={id} isGm={campaign.isGm} running={running} />}>
      <Outlet context={{ campaign, reload: load, setCrumbs, running }} />
    </PageShell>
  );
}

/**
 * The Overview tab, as the campaign's title page: the cover, its numbers (each opening
 * its tab), the chronicle and latest session, then the GM's tools, the party with their
 * class art, and the encounters ready to run.
 */
export function CampaignOverview() {
  const { id } = useParams();
  const { state } = useLocation();
  const { campaign, reload: load } = useCampaign();
  const [errors, setErrors] = useState([]);
  const service = useCampaignService();
  // The latest session and ready encounters, for the previews (encounters are the GM's alone).
  const [logs, setLogs] = useState(null);
  const [encounters, setEncounters] = useState(null);
  useEffect(() => {
    api.listLogs(id).then(setLogs, () => setLogs([]));
    if (campaign.isGm) api.listEncounters(id).then(setEncounters, () => setEncounters([]));
  }, [id, campaign.isGm]);

  const answer = async (requestId, accept) => {
    setErrors([]);
    try {
      await api.answerJoinRequest(requestId, accept);
      inboxChanged();
    } catch (err) {
      setErrors(errorsFrom(err));
      load();
    }
  };

  // The GM removing someone's character asks first; this is the one being asked about.
  const [removing, setRemoving] = useState(null);
  const remove = async (characterId) => {
    try {
      await service.removeCharacter(id, characterId);
      setRemoving(null);
      load();
    } catch (err) {
      setErrors(errorsFrom(err));
    }
  };

  const leave = async (characterId) => {
    try {
      await service.leave(id, characterId);
      load();
    } catch (err) {
      setErrors(errorsFrom(err));
    }
  };

  const others = campaign.characters.filter((c) => !c.mine);
  const path = adventurePath(campaign.adventurePath);
  const latest = logs?.length ? [...logs].sort((a, b) => b.number - a.number)[0] : null;
  const ready = encounters?.filter((e) => e.creatures.length) ?? [];
  // The backstory's first sentence becomes the pull-quote; the rest is the chronicle.
  const story = campaign.backstory?.trim() ?? '';
  const firstEnd = story.search(/[.!?](\s|$)/);
  const quote = firstEnd > 0 && firstEnd < story.length - 2 ? story.slice(0, firstEnd + 1) : null;
  const chronicle = quote ? story.slice(firstEnd + 1).trim() : story;

  return (
    <div className="saga campaign-home">
      {/* The splash: the cover across the whole screen, the name over its foot. */}
      <header className="saga__splash">
        <img className="saga__splash-art" src={campaignCover(campaign)} alt="" />
        <div className="saga__title">
          <h1 className="saga__name">{campaign.name}</h1>
          <p className="saga__subtitle">{campaign.isGm ? 'You run this campaign' : `Run by ${campaign.gmName}`}</p>
        </div>
      </header>

      {state?.created && (
        <p className="panel panel--hot" role="status" style={{ margin: 0 }}>
          Your campaign is ready. Share the invite code with your players.
        </p>
      )}
      <FormErrors errors={errors} />

      <div className="saga__grid">
        <section className="saga__box saga__party" aria-labelledby="party-title">
          <h2 id="party-title" className="saga__label">The party</h2>
          {campaign.characters.length ? (
            <ul className="saga__members">
              {campaign.characters.map((c) => {
                const art = c.portraitUrl ?? (c.className ? cardArtFor(c.className.toLowerCase().replace(/\s+/g, '-')) : null);
                return (
                  <li key={c.id} className="saga-member">
                    {/* Your own character opens to play; anyone else's opens read-only, for the party and the GM. */}
                    <Link to={c.mine ? `/play/${c.id}/sheet` : `/campaigns/${id}/characters/${c.id}/sheet`} className="saga-member__open">
                      <span className="saga-ring">
                        {art ? <img src={art} alt="" loading="lazy" /> : <span aria-hidden="true">{c.name.trim()[0]}</span>}
                      </span>
                      <span className="saga-member__name">{c.name}</span>
                      <span className="saga-member__line">{[c.ancestry, c.className].filter(Boolean).join(' ')} · Level {c.level}</span>
                      <span className="saga-member__player">{c.mine ? 'Your character' : `Played by ${c.player}`}</span>
                    </Link>
                    {c.outsideBooks?.length > 0 && (
                      <span className="hub-card__alert hub-card__warn">Uses books this campaign doesn't: {c.outsideBooks.join(', ')}</span>
                    )}
                    {c.mine && (
                      <div className="saga-member__actions">
                        {c.outsideBooks?.length > 0 && <Link to={`/characters/${c.id}/edit`} className="chip chip--link">Edit</Link>}
                        <button type="button" className="chip" onClick={() => leave(c.id)}>Leave</button>
                      </div>
                    )}
                    {!c.mine && campaign.isGm && removing !== c.id && (
                      <div className="saga-member__actions">
                        <button type="button" className="chip" onClick={() => setRemoving(c.id)}>Remove</button>
                      </div>
                    )}
                    {removing === c.id && (
                      <div className="confirm confirm--inline" role="alertdialog" aria-label={`Remove ${c.name}`}>
                        <p>Remove {c.name} from {campaign.name}? {c.player} keeps the character and can rejoin with the invite code.</p>
                        <div className="btn-row">
                          <button type="button" className="btn btn--grow" onClick={() => setRemoving(null)}>Keep</button>
                          <button type="button" className="btn btn--blood btn--grow" onClick={() => remove(c.id)}>Remove</button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="saga__empty">{campaign.isGm ? 'No one has joined yet. Share your invite code to gather a party.' : 'No characters yet.'}</p>
          )}
          {!campaign.isGm && others.length === 0 && campaign.characters.length > 0 && (
            <p className="saga__empty">Ask your GM for the invite code to bring more players in.</p>
          )}
        </section>

        <div className="saga__center">
          <section className="saga__box saga__quote-box" aria-label="The premise">
            <span className="saga__medallion" aria-hidden="true"><Icon name="crown" size={40} /></span>
            {quote || !story ? (
              <blockquote className="saga__quote">
                <p>{quote ? `“${quote}”` : 'Every legend starts somewhere.'}</p>
                <footer>~ {campaign.gmName}</footer>
              </blockquote>
            ) : (
              <p className="saga__quote saga__quote--plain">A tale told by {campaign.gmName}</p>
            )}
          </section>
          <section className="saga__box saga__chronicle" aria-labelledby="chronicle-title">
            <h2 id="chronicle-title" className="visually-hidden">The chronicle</h2>
            {chronicle ? <p className="saga__story">{chronicle}</p> : <p className="saga__empty center">{campaign.isGm ? 'No backstory yet. Add one in Settings.' : 'No backstory yet.'}</p>}
            <Link to={`/campaigns/${id}/logs`} className="saga__cta">
              Read the session logs{logs?.length ? ` (${logs.length})` : ''} <span aria-hidden="true">›</span>
            </Link>
          </section>
        </div>

        <aside className="saga__side" aria-label="About the campaign">
          <div className="saga__box saga-tile">
            <span className="saga-tile__icon"><Icon name="crown" size={30} /></span>
            <span className="saga-tile__text">
              <span className="saga__label">Party level</span>
              <strong className="saga-tile__value">{campaign.partyLevel}</strong>
            </span>
          </div>
          <div className="saga__box saga-tile saga-tile--emblem">
            <span className="saga-tile__emblem" aria-hidden="true"><Icon name={path ? 'book' : 'map'} size={110} /></span>
            <span className="saga-tile__foot">
              <span className="saga__label">{path ? 'Adventure Path' : 'Adventure'}</span>
              <span className="saga-tile__name">{path ? path.name : 'Homebrew'}</span>
              {path && <span className="saga-tile__sub">Levels {path.levels.join('–')} · {path.setting}</span>}
            </span>
          </div>
          <div className="saga__box saga-tile">
            <span className="saga-tile__icon"><Icon name="spells" size={30} /></span>
            <span className="saga-tile__text">
              <span className="saga__label">Books</span>
              <span className="saga-tile__sub">{booksLabel(campaign.books)}. Characters using other books can't join.</span>
            </span>
          </div>
          {campaign.isGm && (
            <section className="saga__box saga-gm" aria-labelledby="gm-title">
              <h2 id="gm-title" className="saga__label">Game master’s tools</h2>
              <InviteCode code={campaign.inviteCode} />
              {campaign.requests?.length > 0 && (
                <div className="campaign-requests">
                  <span className="sheet-panel__label">Waiting to join</span>
                  <ul className="hub__list">
                    {campaign.requests.map((r) => (
                      <li key={r.id} className="hub-card party-card request-card">
                        <Portrait url={r.character.portraitUrl} name={r.character.name} size="sm" />
                        <div className="hub-card__body">
                          <span className="hub-card__name">{r.character.name}</span>
                          <span className="hub-card__sub">
                            {[r.character.ancestry, r.character.className].filter(Boolean).join(' ')} · Level {r.character.level}
                          </span>
                          <span className="hub-card__tag hub-card__player">
                            <Avatar url={r.playerAvatarUrl} name={r.player} size={18} /> Played by {r.player}
                          </span>
                        </div>
                        <div className="hub-card__actions">
                          <button type="button" className="chip" onClick={() => answer(r.id, false)}>Reject</button>
                          <button type="button" className="chip chip--accept" onClick={() => answer(r.id, true)}>Accept</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      {/* The featured block: the latest session, like a feature beside its title. */}
      <section className={`saga__box saga__feature ${latest ? '' : 'saga__feature--empty'}`} aria-labelledby="latest-title">
        {latest && (
          <div className="saga__feature-art" aria-hidden="true">
            <img src={campaignCover(campaign)} alt="" />
            <span className="saga__feature-number">{latest.number}</span>
          </div>
        )}
        <div className="saga__feature-text">
          <h2 id="latest-title" className="saga__label">Latest session</h2>
          {latest ? (
            <Link to={`/campaigns/${id}/logs/${latest.id}`} className="saga__feature-link">
              <span className="saga__feature-title"><span className="visually-hidden">Session {latest.number}: </span>{latest.title}</span>
              {latest.excerpt && <span className="saga__feature-excerpt">{latest.excerpt.length >= 280 ? `${latest.excerpt.trimEnd()}…` : latest.excerpt}</span>}
              <span className="saga__feature-more">Read it in the journal ›</span>
            </Link>
          ) : (
            <p className="saga__empty">
              {logs ? (campaign.isGm ? 'No sessions logged yet. After you play, write up what happened.' : 'No sessions logged yet.') : 'Gathering the chronicle…'}
            </p>
          )}
        </div>
      </section>

      {campaign.isGm && (
        <section className="saga__box saga__encounters" aria-labelledby="ready-title">
          <header className="saga__encounters-head">
            <h2 id="ready-title" className="saga__label">Ready encounters</h2>
            <Link to={`/campaigns/${id}/encounters`} className="saga__feature-more">
              {encounters?.length ? `All ${encounters.length} encounters ›` : 'Build one ›'}
            </Link>
          </header>
          {ready.length ? (
            <ul className="sheet-list">
              {ready.slice(0, 4).map((e) => {
                const r = encounterRating(e, campaign);
                return (
                  <li key={e.id}>
                    <Link to={`/campaigns/${id}/encounters/${e.id}`}>{e.name}</Link>
                    <span className="book__entry-dots" aria-hidden="true" />
                    <span className={`encounter__threat encounter__threat--${r.threat.replace(' ', '-')}`}>{r.threat}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="saga__empty">{encounters ? 'No encounters ready. Build one from the bestiary.' : 'Checking the war table…'}</p>
          )}
        </section>
      )}
    </div>
  );
}
