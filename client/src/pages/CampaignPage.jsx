import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
import { campaignCover } from '../state/campaignCovers.js';
import Avatar from '../components/Avatar.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { adventurePath } from '@rollbound/rules';
import { booksLabel } from '../state/rulesData.js';
import { api } from '../api.js';
import { onInboxChanged } from '../state/inbox.js';
import { useAuth } from '../state/AuthContext.jsx';
import { shortDate } from './SessionLogPages.jsx';
import { rememberCampaign } from '../state/lastCampaign.js';
import { cardArtFor } from '../builder/art.js';
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
 * The Overview tab, as a legend's page: the cover across the screen with the name over it,
 * the party as a cast, the backstory, the session logs, and a line of facts at the foot.
 */
export function CampaignOverview() {
  const { id } = useParams();
  const { state } = useLocation();
  const { campaign, reload: load } = useCampaign();
  const [errors, setErrors] = useState([]);
  const service = useCampaignService();
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api.listLogs(id).then(setLogs, () => setLogs([]));
  }, [id]);

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
  // The latest sessions, oldest first, so the timeline reads down like the story.
  const chapters = logs ? [...logs].sort((a, b) => a.number - b.number).slice(-5) : [];
  const waiting = campaign.requests?.length ?? 0;
  const mine = campaign.characters.find((c) => c.mine);

  return (
    <div className="saga campaign-home">
      {/* The splash: the cover across the whole screen, the name over its foot. */}
      <header className="saga__splash">
        <img className="saga__splash-art" src={campaignCover(campaign)} alt="" />
        <div className="saga__title">
          <h1 className="saga__name">{campaign.name}</h1>
        </div>
      </header>

      {state?.created && (
        <p className="panel panel--hot" role="status" style={{ margin: 0 }}>
          Your campaign is ready. Your invite code is in <Link to={`/campaigns/${id}/settings`}>Settings</Link>: share it with your players.
        </p>
      )}
      <FormErrors errors={errors} />

      {/* Below the cover: the story so far as a timeline, beside the table's card (host, details, party). */}
      <div className="tale">
        <section className="tale__story" aria-labelledby="story-title">
          <h2 id="story-title" className="tale__heading">The story so far…</h2>
          <ol className="timeline">
            <li className="timeline__node timeline__node--prologue">
              <span className="timeline__mark" aria-hidden="true"><Icon name="lore" size={20} /></span>
              <div className="timeline__body">
                <span className="timeline__kicker">Synopsis</span>
                {campaign.backstory?.trim() ? (
                  <p className="timeline__prologue">{campaign.backstory.trim()}</p>
                ) : (
                  <p className="saga__empty">{campaign.isGm ? 'No backstory yet. Add one in Settings.' : 'No backstory yet.'}</p>
                )}
              </div>
            </li>
            {logs?.length > chapters.length && (
              <li className="timeline__node timeline__node--gap">
                <span className="timeline__mark" aria-hidden="true" />
                <Link to={`/campaigns/${id}/logs`} className="timeline__earlier">{logs.length - chapters.length} earlier {logs.length - chapters.length === 1 ? 'session' : 'sessions'} ›</Link>
              </li>
            )}
            {chapters.map((l) => (
              <li key={l.id} className="timeline__node">
                <span className="timeline__mark timeline__mark--number" aria-hidden="true">{l.number}</span>
                <Link to={`/campaigns/${id}/logs/${l.id}`} className="timeline__body timeline__chapter">
                  <span className="timeline__kicker">Session {l.number}{l.playedOn ? ` · ${shortDate(l.playedOn)}` : ''}</span>
                  <span className="timeline__title">{l.title}</span>
                  {l.excerpt && <span className="timeline__excerpt">{l.excerpt}</span>}
                  <span className="timeline__more">Read the session ›</span>
                </Link>
              </li>
            ))}
            <li className="timeline__node timeline__node--next">
              <span className="timeline__mark" aria-hidden="true"><Icon name="logs" size={18} /></span>
              <div className="timeline__body">
                <span className="timeline__title timeline__title--next">To be continued…</span>
                {campaign.isGm ? (
                  <Link to={`/campaigns/${id}/logs/new`} className="timeline__more">After you play, write up what happened ›</Link>
                ) : (
                  <span className="timeline__excerpt">{logs?.length ? 'The next session is yet to be written.' : 'No sessions logged yet.'}</span>
                )}
              </div>
            </li>
          </ol>
        </section>

        <aside className="tale__card" aria-label="The table">
          <div className="tale__host">
            <Avatar url={campaign.gmAvatarUrl} name={campaign.gmName} size={52} />
            <div>
              <span className="tale__host-kicker">Hosted by</span>
              <span className="tale__host-name">{campaign.isGm ? 'You' : campaign.gmName}</span>
            </div>
          </div>
          <ul className="tale__facts">
            <li><Icon name="crown" size={18} /><span>Party level <strong>{campaign.partyLevel}</strong></span></li>
            <li><Icon name={path ? 'book' : 'map'} size={18} /><span>{path ? <><strong>{path.name}</strong> · Levels {path.levels.join('–')} · {path.setting}</> : <strong>Homebrew</strong>}</span></li>
            <li><Icon name="logs" size={18} /><span><strong>{logs ? logs.length : '…'}</strong> {logs?.length === 1 ? 'session' : 'sessions'} played</span></li>
            <li><Icon name="spells" size={18} /><span>{booksLabel(campaign.books)}</span></li>
          </ul>
          <div className="tale__actions">
            {mine && <Link to={`/play/${mine.id}/sheet`} className="btn btn--blood"><Icon name="swords" size={16} /> Play {mine.name}</Link>}
            <Link to={`/campaigns/${id}/logs`} className="btn"><Icon name="logs" size={16} /> Session logs</Link>
          </div>

          <section className="tale__party" aria-labelledby="party-title">
            <h2 id="party-title" className="tale__party-title">
              The party <span className="tale__count">{campaign.characters.length}</span>
            </h2>
            {campaign.characters.length ? (
              <ul className="guests">
                {campaign.characters.map((c) => {
                  const art = c.portraitUrl ?? (c.className ? cardArtFor(c.className.toLowerCase().replace(/\s+/g, '-')) : null);
                  return (
                    <li key={c.id} className="guest">
                      {/* Your own character opens to play; anyone else's opens read-only, for the party and the GM. */}
                      <Link to={c.mine ? `/play/${c.id}/sheet` : `/campaigns/${id}/characters/${c.id}/sheet`} className="guest__open">
                        <span className="guest__ring">{art ? <img src={art} alt="" loading="lazy" /> : <span aria-hidden="true">{c.name.trim()[0]}</span>}</span>
                        <span className="guest__text">
                          <span className="guest__name">{c.name}</span>
                          <span className="guest__line">{[c.ancestry, c.className].filter(Boolean).join(' ')} · Level {c.level}</span>
                          <span className="guest__player">{c.mine ? 'You' : c.player}</span>
                        </span>
                      </Link>
                      {c.mine && (
                        <span className="guest__actions">
                          {c.outsideBooks?.length > 0 && <Link to={`/characters/${c.id}/edit`} className="chip chip--link">Edit</Link>}
                          <button type="button" className="chip" onClick={() => leave(c.id)}>Leave</button>
                        </span>
                      )}
                      {!c.mine && campaign.isGm && removing !== c.id && (
                        <span className="guest__actions">
                          <button type="button" className="chip" onClick={() => setRemoving(c.id)}>Remove</button>
                        </span>
                      )}
                      {c.outsideBooks?.length > 0 && (
                        <span className="hub-card__alert hub-card__warn guest__wide">Uses books this campaign doesn't: {c.outsideBooks.join(', ')}</span>
                      )}
                      {removing === c.id && (
                        <div className="confirm confirm--inline guest__wide" role="alertdialog" aria-label={`Remove ${c.name}`}>
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
              <p className="saga__empty">{campaign.isGm ? 'No one has joined yet.' : 'No characters yet.'}</p>
            )}
            {campaign.isGm ? (
              <Link to={`/campaigns/${id}/settings`} className="tale__invite">
                <Icon name="user" size={16} /> Invite players{waiting ? ` · ${waiting} waiting to join` : ''} ›
              </Link>
            ) : (
              others.length === 0 && campaign.characters.length > 0 && <p className="saga__empty">Ask your GM for the invite code to bring more players in.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
