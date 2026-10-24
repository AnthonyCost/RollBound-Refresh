import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { armorClass, equipCharacter, maxHp, mira } from '@rollbound/rules';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { DEMO_CHARACTER_ID } from '../state/TableContext.jsx';
import Ornament from '../components/Ornament.jsx';
import { listDemoCharacters } from '../state/demoCharacters.js';
import { demoMemberships } from '../state/demoCampaigns.js';
import { useCampaignService } from '../state/campaignService.js';
import JoinCampaign from '../components/JoinCampaign.jsx';
import Avatar from '../components/Avatar.jsx';
import AccountLink from '../components/AccountLink.jsx';
import Portrait from '../components/Portrait.jsx';
import { demoPortraitUrl } from '../state/portraits.js';
import { isOutdated, loadRules } from '../state/rulesData.js';
import { demoExtras } from '../state/demoExtras.js';

const summary = (data) => ({ maxHp: maxHp(data), ac: armorClass(data).total });

/**
 * Demo characters (Mira plus any built this session) shaped like the API's
 * character list, with AC from their equipped gear like the server's.
 */
async function demoCharacterCards() {
  const memberships = demoMemberships();
  const gear = await loadRules({ types: ['weapons', 'armor', 'shields'] }).catch(() => null);
  return [{ id: DEMO_CHARACTER_ID, data: mira }, ...listDemoCharacters()].map(({ id, data }) => ({
    id,
    name: data.name,
    level: data.level,
    campaignId: memberships[id]?.id ?? null,
    campaignName: memberships[id]?.name ?? null,
    portraitUrl: demoPortraitUrl(id),
    data,
    summary: summary(equipCharacter(data, demoExtras(id).inventory ?? null, gear)),
  }));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One campaign. members, when given, names the player's own characters in it. */
function CampaignCard({ campaign, members }) {
  const body = (
    <>
      {campaign.coverUrl ? (
        <img className="hub-card__thumb" src={campaign.coverUrl} alt="" />
      ) : (
        <span className="hub-card__thumb hub-card__thumb--plain" aria-hidden="true">{campaign.name[0]}</span>
      )}
      <div className="hub-card__body">
        <span className="hub-card__name">{campaign.name}</span>
        <span className="hub-card__sub hub-card__gm">
          {campaign.isGm === false && (
            <>
              <Avatar url={campaign.gmAvatarUrl} name={campaign.gmName} size={16} /> Run by {campaign.gmName} ·{' '}
            </>
          )}
          Party level {campaign.partyLevel} · {plural(campaign.characterCount, 'character')}
        </span>
        {members?.length > 0 && <span className="hub-card__tag">Playing {members.map((c) => c.name).join(', ')}</span>}
      </div>
      {campaign.isGm !== false && <span className="combatant__tag">GM</span>}
    </>
  );
  return (
    <li>
      <Link to={`/campaigns/${campaign.id}`} className="hub-card hub-card--link">{body}</Link>
    </li>
  );
}

const MODES = [
  { id: 'player', label: 'Player' },
  { id: 'gm', label: 'Game Master' },
];
const MODE_KEY = 'rollbound.hubMode';

/** The mode last picked on this browser; storage can be blocked, so fall back to player. */
function savedMode() {
  try {
    return localStorage.getItem(MODE_KEY) === 'gm' ? 'gm' : 'player';
  } catch {
    return 'player';
  }
}

/**
 * Switches between the player and GM views. Both are rendered from the same load;
 * this only hides one, so switching never fetches anything.
 */
function ModeSwitch({ mode, onChange, counts }) {
  const tabs = useRef({});
  const onKeyDown = (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const next = MODES[(MODES.findIndex((m) => m.id === mode) + 1) % MODES.length].id;
    onChange(next);
    tabs.current[next]?.focus();
  };
  return (
    <div className="mode-switch" role="tablist" aria-label="Home view">
      {MODES.map((m) => (
        <button
          key={m.id}
          ref={(el) => (tabs.current[m.id] = el)}
          type="button"
          role="tab"
          id={`hub-tab-${m.id}`}
          aria-selected={mode === m.id}
          aria-controls={`hub-panel-${m.id}`}
          tabIndex={mode === m.id ? 0 : -1}
          className="mode-switch__tab"
          onClick={() => onChange(m.id)}
          onKeyDown={onKeyDown}
        >
          <span>
            {m.label}
            <span className="mode-switch__suffix"> Mode</span>
          </span>
          <span className="mode-switch__count">{counts[m.id]}</span>
        </button>
      ))}
    </div>
  );
}

export default function HubPage() {
  const { user, isDemo, logout } = useAuth();
  const service = useCampaignService();
  const [hub, setHub] = useState(null);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState(savedMode);
  const { state } = useLocation();

  const load = useCallback(() => {
    let cancelled = false;
    Promise.all([isDemo ? demoCharacterCards() : api.listCharacters(), service.list()])
      .then(([characters, campaigns]) => !cancelled && setHub({ characters, campaigns }))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [isDemo, service]);

  useEffect(load, [load]);

  const chooseMode = (next) => {
    setMode(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Not remembered; the choice still holds for this visit.
    }
  };

  // Campaigns the player is in through one of their characters, including any
  // they also run, with the characters each one holds.
  const membersOf = (campaign) => hub.characters.filter((c) => c.campaignId === campaign.id);
  const playerCampaigns = hub
    ? [...hub.campaigns.playing, ...hub.campaigns.running].filter((c) => membersOf(c).length).sort((a, b) => a.name.localeCompare(b.name))
    : [];

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <div className="topbar__right">
          <AccountLink />
          <button type="button" className="topbar__signout" onClick={logout}>
            {isDemo ? 'Exit demo' : 'Sign out'}
          </button>
        </div>
      </header>

      {isDemo && <p className="demo-banner">Demo mode · nothing you do here is saved</p>}

      <main className="app__main">
        <section className="hub__greeting">
          <span className="eyebrow">Welcome back</span>
          <h1 className="title">{isDemo ? 'Adventurer' : user.displayName}</h1>
        </section>

        {state?.deleted && <p className="panel panel--hot center" role="status">Deleted {state.deleted}. Its characters are still with their players.</p>}
        {failed && <p className="form-errors" role="alert">Couldn't load your table. Try refreshing.</p>}
        {!hub && !failed && <p className="muted italic center">Gathering your party…</p>}

        {hub && (
          <>
            <ModeSwitch mode={mode} onChange={chooseMode} counts={{ player: hub.characters.length, gm: hub.campaigns.running.length }} />

            <div className="split hub__split" role="tabpanel" id="hub-panel-player" aria-labelledby="hub-tab-player" hidden={mode !== 'player'}>
              <section className="split__col" aria-label="Characters">
                <Ornament label="YOUR CHARACTERS" />
                {hub.characters.length ? (
                  <ul className="hub__list">
                    {hub.characters.map((c) => (
                      <li key={c.id}>
                        <Link to={`/play/${c.id}/sheet`} className="hub-card hub-card--link">
                          <Portrait url={c.portraitUrl} name={c.name} size="sm" />
                          <div className="hub-card__body">
                            <span className="hub-card__name">{c.name}</span>
                            <span className="hub-card__sub">
                              {c.data.ancestry.name} {c.data.className} · Level {c.level}
                            </span>
                            <span className="hub-card__tag">
                              {c.campaignName ?? 'No campaign'}
                              {isOutdated(c.data) && <span className="hub-card__alert"> · Rules updated</span>}
                            </span>
                          </div>
                          <div className="hub-card__stats">
                            <span><small>HP</small>{c.summary.maxHp}</span>
                            <span><small>AC</small>{c.summary.ac}</span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="panel panel--dashed muted italic center">No characters yet. Characters you create will gather here.</p>
                )}
                <Link to="/create" className="btn btn--blood">New character</Link>
              </section>

              <section className="split__col" aria-label="Campaigns you play in">
                <Ornament label="CAMPAIGNS YOU PLAY IN" />
                {playerCampaigns.length ? (
                  <ul className="hub__list">
                    {playerCampaigns.map((c) => <CampaignCard key={c.id} campaign={c} members={membersOf(c)} />)}
                  </ul>
                ) : (
                  <p className="panel panel--dashed muted italic center">None of your characters are in a campaign yet. Ask your GM for an invite code.</p>
                )}
                <JoinCampaign characters={hub.characters} onJoined={load} />
              </section>
            </div>

            <section className="hub__panel" role="tabpanel" id="hub-panel-gm" aria-labelledby="hub-tab-gm" hidden={mode !== 'gm'}>
              <Ornament label="CAMPAIGNS YOU RUN" />
              {hub.campaigns.running.length ? (
                <ul className="hub__list">
                  {hub.campaigns.running.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                </ul>
              ) : (
                <p className="panel panel--dashed muted italic center">No campaigns yet. Start one and invite your players.</p>
              )}
              <Link to="/campaigns/new" className="btn btn--blood hub__action">New campaign</Link>
              {isDemo && (
                <p className="rule-note center">Demo campaigns and codes only exist in this tab. Create an account to invite real players.</p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
