import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import Icon from '../components/Icon.jsx';
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

/** The tabs under a campaign's header, like a GitHub repository's. Encounters is the GM's alone. */
function CampaignTabs({ id, isGm }) {
  const tabs = [
    { to: `/campaigns/${id}`, label: 'Overview', icon: 'overview', end: true },
    { to: `/campaigns/${id}/logs`, label: 'Session logs', icon: 'logs' },
    ...(isGm ? [{ to: `/campaigns/${id}/encounters`, label: 'Encounters', icon: 'swords' }] : []),
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

  const actions = campaign.isGm && <Link to={`/campaigns/${id}/edit`} className="btn btn--small">Edit</Link>;
  return (
    <PageShell crumbs={all} actions={actions} tabs={<CampaignTabs id={id} isGm={campaign.isGm} />}>
      <Outlet context={{ campaign, reload: load, setCrumbs }} />
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
  const stats = [
    { label: 'Party', value: campaign.characters.length, to: null },
    { label: 'Party level', value: campaign.partyLevel, to: null },
    { label: 'Sessions', value: logs ? logs.length : '…', to: `/campaigns/${id}/logs` },
    ...(campaign.isGm ? [{ label: 'Encounters', value: encounters ? encounters.length : '…', to: `/campaigns/${id}/encounters` }] : []),
  ];

  return (
    <div className="campaign-home">
      {/* The cover as a banner: shorter than the cover's own shape, with the name over its foot. */}
      <header className={`campaign-banner ${campaign.coverUrl ? '' : 'campaign-banner--plain'}`}>
        {campaign.coverUrl && <img className="campaign-banner__img" src={campaign.coverUrl} alt="" />}
        <div className="campaign-banner__text">
          <h1 className="campaign-banner__name">{campaign.name}</h1>
          <p className="campaign-card__byline">
            <Avatar url={campaign.gmAvatarUrl} name={campaign.gmName} size={22} />
            {campaign.isGm ? 'You run this campaign' : `Run by ${campaign.gmName}`}
          </p>
          <p className="campaign-tags">
            <span className="tag tag--theme">{path ? path.name : 'Homebrew'}</span>
            {path && <span className="tag">Levels {path.levels.join('–')}</span>}
            {path && <span className="tag">{path.setting}</span>}
          </p>
        </div>
      </header>

      <div className="campaign-layout">
        <aside className="campaign-side" aria-label="About the campaign">
          <section className="sheet-panel campaign-card">
            <h2 className="sheet-panel__title">At a glance</h2>
            <dl className="campaign-card__stats">
              {stats.map((st) => (
                <div key={st.label}>
                  <dt>{st.label}</dt>
                  <dd>{st.to ? <Link to={st.to}>{st.value} <span aria-hidden="true">›</span></Link> : st.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {campaign.isGm && (
            <section className="sheet-panel campaign-gm" aria-labelledby="gm-title">
              <h2 id="gm-title" className="sheet-panel__title">Game master's tools</h2>
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

        <div className="campaign-main">
          {state?.created && (
            <p className="panel panel--hot" role="status" style={{ margin: 0 }}>
              Your campaign is ready. Share the invite code with your players.
            </p>
          )}
          <FormErrors errors={errors} />
          <section className="sheet-panel campaign-chronicle" aria-labelledby="chronicle-title">
            <h2 id="chronicle-title" className="sheet-panel__title">The chronicle</h2>
            {path && (
              <p className="campaign-path">
                <strong>{path.name}</strong>
                <span className="muted"> · Levels {path.levels.join('–')} · {path.setting}</span>
              </p>
            )}
            {campaign.backstory ? <p className="backstory campaign-chronicle__story">{campaign.backstory}</p> : <p className="rule-note">No backstory yet.</p>}
            <div className="campaign-books">
              <span className="sheet-panel__label">Books</span>
              <p className="rule-note" style={{ margin: 0 }}>{booksLabel(campaign.books)}. Characters are built from these, and characters using other books can't join.</p>
            </div>
          </section>

          <section className="sheet-panel" aria-labelledby="latest-title">
            <h2 id="latest-title" className="sheet-panel__title">Latest session</h2>
            {latest ? (
              <Link to={`/campaigns/${id}/logs/${latest.id}`} className="campaign-latest">
                <span className="eyebrow">Session {latest.number}</span>
                <span className="campaign-latest__title">{latest.title}</span>
                {latest.excerpt && <span className="campaign-latest__excerpt">{latest.excerpt.length >= 280 ? `${latest.excerpt.trimEnd()}…` : latest.excerpt}</span>}
                <span className="campaign-latest__more">Read it in the journal ›</span>
              </Link>
            ) : (
              <p className="muted italic" style={{ margin: 0 }}>
                {logs ? (campaign.isGm ? 'No sessions logged yet. After you play, write up what happened.' : 'No sessions logged yet.') : 'Gathering the chronicle…'}
              </p>
            )}
          </section>
          <section className="sheet-panel" aria-labelledby="party-title">
            <h2 id="party-title" className="sheet-panel__title">The party</h2>
            {campaign.characters.length ? (
              <ul className="party-banners">
                {campaign.characters.map((c) => {
                  const art = c.className ? cardArtFor(c.className.toLowerCase().replace(/\s+/g, '-')) : null;
                  return (
                    <li key={c.id} className="party-banner">
                      {art && <img className="party-banner__art" src={art} alt="" loading="lazy" />}
                      {/* Your own character opens to play; anyone else's opens read-only, for the party and the GM. */}
                      <Link
                        to={c.mine ? `/play/${c.id}/sheet` : `/campaigns/${id}/characters/${c.id}/sheet`}
                        className="party-banner__open"
                        aria-label={`${c.mine ? 'Play' : 'View'} ${c.name}'s sheet`}
                      >
                        <Portrait url={c.portraitUrl} name={c.name} size="sm" />
                        <span className="party-banner__body">
                          <span className="party-banner__name">{c.name}</span>
                          <span className="party-banner__sub">
                            {[c.ancestry, c.className].filter(Boolean).join(' ')} · Level {c.level}
                          </span>
                          <span className="party-banner__player">
                            {!c.mine && <Avatar url={c.playerAvatarUrl} name={c.player} size={18} />}
                            {c.mine ? 'Your character' : `Played by ${c.player}`}
                          </span>
                          {c.outsideBooks?.length > 0 && (
                            <span className="hub-card__alert hub-card__warn">Uses books this campaign doesn't: {c.outsideBooks.join(', ')}</span>
                          )}
                        </span>
                      </Link>
                      {c.mine && (
                        <div className="party-banner__actions">
                          {c.outsideBooks?.length > 0 && <Link to={`/characters/${c.id}/edit`} className="chip chip--link">Edit</Link>}
                          <button type="button" className="chip" onClick={() => leave(c.id)}>Leave</button>
                        </div>
                      )}
                      {!c.mine && campaign.isGm && removing !== c.id && (
                        <div className="party-banner__actions">
                          <button type="button" className="chip" onClick={() => setRemoving(c.id)}>Remove</button>
                        </div>
                      )}
                      {removing === c.id && (
                        <div className="confirm confirm--inline party-banner__confirm" role="alertdialog" aria-label={`Remove ${c.name}`}>
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
              <p className="muted italic" style={{ margin: 0 }}>
                {campaign.isGm ? 'No one has joined yet. Share your invite code to gather a party.' : 'No characters yet.'}
              </p>
            )}
            {!campaign.isGm && others.length === 0 && campaign.characters.length > 0 && (
              <p className="rule-note" style={{ margin: '10px 0 0' }}>Ask your GM for the invite code to bring more players in.</p>
            )}
          </section>

          {campaign.isGm && (
            <section className="sheet-panel" aria-labelledby="ready-title">
              <h2 id="ready-title" className="sheet-panel__title">Ready encounters</h2>
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
                <p className="muted italic" style={{ margin: 0 }}>{encounters ? 'No encounters ready. Build one from the bestiary.' : 'Checking the war table…'}</p>
              )}
              {ready.length > 4 && <Link to={`/campaigns/${id}/encounters`} className="campaign-latest__more">All {ready.length} encounters ›</Link>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
