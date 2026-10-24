import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import CampaignCover from '../components/CampaignCover.jsx';
import InviteCode from '../components/InviteCode.jsx';
import Ornament from '../components/Ornament.jsx';
import Portrait from '../components/Portrait.jsx';
import Avatar from '../components/Avatar.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { adventurePath } from '@rollbound/rules';
import { booksLabel } from '../state/rulesData.js';
import { api } from '../api.js';
import { inboxChanged, onInboxChanged } from '../state/inbox.js';

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

const TAB_ICONS = {
  overview: <path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />,
  logs: (
    <>
      <path d="M7 4h11a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H6a2 2 0 0 1 0-4h1z" />
      <path d="M10 9h4M10 13h4" />
    </>
  ),
  encounters: <path d="M5 19L19 5M15 5h4v4M5 5l14 14M9 19H5v-4" />,
};

/** The tabs under a campaign's header, like a GitHub repository's. Encounters is the GM's alone. */
function CampaignTabs({ id, isGm }) {
  const tabs = [
    { to: `/campaigns/${id}`, label: 'Overview', icon: 'overview', end: true },
    { to: `/campaigns/${id}/logs`, label: 'Session logs', icon: 'logs' },
    ...(isGm ? [{ to: `/campaigns/${id}/encounters`, label: 'Encounters', icon: 'encounters' }] : []),
  ];
  return (
    <nav className="nav" aria-label="Campaign">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}>
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {TAB_ICONS[t.icon]}
          </svg>
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

  const load = useCallback(() => {
    service
      .get(id)
      .then(setCampaign)
      .catch((err) => (err.status === 404 ? setMissing(true) : setErrors(errorsFrom(err))));
  }, [service, id]);

  useEffect(load, [load]);
  // Answering a request from the inbox updates the party here too.
  useEffect(() => onInboxChanged(load), [load]);

  // Players reach their campaigns from Player Mode, GMs from Game Master Mode.
  const all = [
    { label: 'Campaigns', to: campaign?.isGm === false ? '/home?mode=player' : '/home?mode=gm' },
    { label: campaign?.name ?? 'Campaign', to: `/campaigns/${id}` },
    ...crumbs,
  ];
  if (missing) {
    return (
      <PageShell crumbs={all}>
        <p className="muted italic center">This campaign doesn't exist, or you're not part of it. <Link to="/home">Back to the hub</Link></p>
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

/** The Overview tab: cover, backstory, books, invite code, requests and the party. */
export function CampaignOverview() {
  const { id } = useParams();
  const { state } = useLocation();
  const { campaign, reload: load } = useCampaign();
  const [errors, setErrors] = useState([]);
  const service = useCampaignService();

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
  return (
    <>
      {state?.created && (
        <p className="panel panel--hot center" role="status">
          Your campaign is ready. Share the invite code below with your players.
        </p>
      )}

      <CampaignCover
        name={campaign.name}
        coverUrl={campaign.coverUrl}
        subtitle={
          <span className="cover__byline">
            <Avatar url={campaign.gmAvatarUrl} name={campaign.gmName} size={24} />
            {campaign.isGm ? 'You run this campaign' : `Run by ${campaign.gmName}`} · Party level {campaign.partyLevel}
          </span>
        }
      />
      <FormErrors errors={errors} />

      <div className="split">
        <section className="split__col" aria-label="Backstory">
          {adventurePath(campaign.adventurePath) && (
            <>
              <Ornament label="ADVENTURE PATH" />
              <p className="campaign-path">
                <strong>{adventurePath(campaign.adventurePath).name}</strong>
                <span className="muted">
                  {' '}· Levels {adventurePath(campaign.adventurePath).levels.join('–')} · {adventurePath(campaign.adventurePath).setting}
                </span>
              </p>
            </>
          )}
          <Ornament label="BACKSTORY" />
          {campaign.backstory ? (
            <p className="backstory">{campaign.backstory}</p>
          ) : (
            <p className="rule-note">No backstory yet.</p>
          )}
          <Ornament label="BOOKS" />
          <p className="rule-note">
            {booksLabel(campaign.books)}. Characters are built from these, and characters using other books can't join.
          </p>
        </section>

        <section className="split__col" aria-label="Party">
          {campaign.isGm && <InviteCode code={campaign.inviteCode} />}
          {campaign.isGm && (
            <Link to={`/create?invite=${encodeURIComponent(campaign.inviteCode)}`} className="btn">
              Build a character for this campaign
            </Link>
          )}

          {campaign.requests?.length > 0 && (
            <>
              <Ornament label="WAITING TO JOIN" />
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
            </>
          )}

          <Ornament label="THE PARTY" />
          {campaign.characters.length ? (
            <ul className="hub__list">
              {campaign.characters.map((c) => (
                <li key={c.id} className="hub-card party-card">
                  {/* Your own character opens to play; anyone else's opens read-only, for the party and the GM. */}
                  <Link
                    to={c.mine ? `/play/${c.id}/sheet` : `/campaigns/${id}/characters/${c.id}/sheet`}
                    className="party-card__open"
                    aria-label={`${c.mine ? 'Play' : 'View'} ${c.name}'s sheet`}
                  >
                    <Portrait url={c.portraitUrl} name={c.name} size="sm" />
                    <div className="hub-card__body">
                      <span className="hub-card__name">{c.name}</span>
                      <span className="hub-card__sub">
                        {[c.ancestry, c.className].filter(Boolean).join(' ')} · Level {c.level}
                      </span>
                      <span className="hub-card__tag hub-card__player">
                        {!c.mine && <Avatar url={c.playerAvatarUrl} name={c.player} size={18} />}
                        {c.mine ? 'Your character' : `Played by ${c.player}`}
                      </span>
                      {c.outsideBooks?.length > 0 && (
                        <span className="hub-card__alert hub-card__warn">Uses books this campaign doesn't: {c.outsideBooks.join(', ')}</span>
                      )}
                    </div>
                  </Link>
                  {c.mine && (
                    <div className="hub-card__actions">
                      {c.outsideBooks?.length > 0 && <Link to={`/characters/${c.id}/edit`} className="chip chip--link">Edit</Link>}
                      <button type="button" className="chip" onClick={() => leave(c.id)}>Leave</button>
                    </div>
                  )}
                  {!c.mine && campaign.isGm && removing !== c.id && (
                    <div className="hub-card__actions">
                      <button type="button" className="chip" onClick={() => setRemoving(c.id)}>Remove</button>
                    </div>
                  )}
                  {removing === c.id && (
                    <div className="confirm confirm--inline party-card__confirm" role="alertdialog" aria-label={`Remove ${c.name}`}>
                      <p>Remove {c.name} from {campaign.name}? {c.player} keeps the character and can rejoin with the invite code.</p>
                      <div className="btn-row">
                        <button type="button" className="btn btn--grow" onClick={() => setRemoving(null)}>Keep</button>
                        <button type="button" className="btn btn--blood btn--grow" onClick={() => remove(c.id)}>Remove</button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="panel panel--dashed muted italic center">
              {campaign.isGm ? 'No one has joined yet. Share your invite code to gather a party.' : 'No characters yet.'}
            </p>
          )}
          {!campaign.isGm && others.length === 0 && campaign.characters.length > 0 && (
            <p className="rule-note">Ask your GM for the invite code to bring more players in.</p>
          )}
        </section>
      </div>
    </>
  );
}
