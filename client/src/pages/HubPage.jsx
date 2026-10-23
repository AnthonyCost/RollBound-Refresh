import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { armorClass, maxHp, mira } from '@rollbound/rules';
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

const summary = (data) => ({ maxHp: maxHp(data), ac: armorClass(data).total });

/** Demo characters (Mira plus any built this session) shaped like the API's character list. */
function demoCharacterCards() {
  const memberships = demoMemberships();
  return [{ id: DEMO_CHARACTER_ID, data: mira }, ...listDemoCharacters()].map(({ id, data }) => ({
    id,
    name: data.name,
    level: data.level,
    campaignId: memberships[id]?.id ?? null,
    campaignName: memberships[id]?.name ?? null,
    portraitUrl: demoPortraitUrl(id),
    data,
    summary: summary(data),
  }));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function CampaignCard({ campaign }) {
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

export default function HubPage() {
  const { user, isDemo, logout } = useAuth();
  const service = useCampaignService();
  const [hub, setHub] = useState(null);
  const [failed, setFailed] = useState(false);

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

        {failed && <p className="form-errors" role="alert">Couldn't load your table. Try refreshing.</p>}
        {!hub && !failed && <p className="muted italic center">Gathering your party…</p>}

        {hub && (
          <div className="split hub__split">
            <section className="split__col" aria-label="Characters">
              <Ornament label="CHARACTERS" />
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
                          <span className="hub-card__tag">{c.campaignName ?? 'No campaign'}</span>
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

            <section className="split__col" aria-label="Campaigns">
              <Ornament label="CAMPAIGNS YOU RUN" />
              {hub.campaigns.running.length ? (
                <ul className="hub__list">
                  {hub.campaigns.running.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                </ul>
              ) : (
                <p className="panel panel--dashed muted italic center">No campaigns yet. Start one and invite your players.</p>
              )}
              <Link to="/campaigns/new" className="btn">New campaign</Link>

              {hub.campaigns.playing.length > 0 && (
                <>
                  <Ornament label="CAMPAIGNS YOU PLAY IN" />
                  <ul className="hub__list">
                    {hub.campaigns.playing.map((c) => <CampaignCard key={c.id} campaign={c} />)}
                  </ul>
                </>
              )}

              <JoinCampaign characters={hub.characters} onJoined={load} />
              {isDemo && (
                <p className="rule-note center">Demo campaigns and codes only exist in this tab. Create an account to invite real players.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
