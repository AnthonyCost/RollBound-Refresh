import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { armorClass, maxHp, mira } from '@rollbound/rules';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { DEMO_CHARACTER_ID } from '../state/TableContext.jsx';
import Ornament from '../components/Ornament.jsx';
import { listDemoCharacters } from '../state/demoCharacters.js';

const DEMO_HUB = {
  characters: [
    {
      id: DEMO_CHARACTER_ID,
      name: mira.name,
      level: mira.level,
      campaignName: 'Wolves at the Ford',
      data: mira,
      summary: { maxHp: maxHp(mira), ac: armorClass(mira).total },
    },
  ],
  campaigns: [{ id: 'demo', name: 'Wolves at the Ford', partyLevel: 1, characterCount: 1 }],
};

function demoHub() {
  const built = listDemoCharacters().map(({ id, data }) => ({
    id,
    name: data.name,
    level: data.level,
    campaignName: null,
    data,
    summary: { maxHp: maxHp(data), ac: armorClass(data).total },
  }));
  return { ...DEMO_HUB, characters: [...DEMO_HUB.characters, ...built] };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function HubPage() {
  const { user, isDemo, logout } = useAuth();
  const [hub, setHub] = useState(isDemo ? demoHub : null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    Promise.all([api.listCharacters(), api.listCampaigns()])
      .then(([characters, campaigns]) => !cancelled && setHub({ characters, campaigns }))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/home" className="wordmark">ROLLBOUND</Link>
        <button type="button" className="topbar__signout" onClick={logout}>
          {isDemo ? 'Exit demo' : 'Sign out'}
        </button>
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
            {hub.campaigns.length ? (
              <ul className="hub__list">
                {hub.campaigns.map((c) => (
                  <li key={c.id} className="hub-card">
                    <div className="hub-card__body">
                      <span className="hub-card__name">{c.name}</span>
                      <span className="hub-card__sub">
                        Party level {c.partyLevel} · {plural(c.characterCount, 'character')}
                      </span>
                    </div>
                    <span className="combatant__tag">GM</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">No campaigns yet. Campaigns you run as GM will appear here.</p>
            )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
