import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import { CharacterCard } from './CharactersPage.jsx';
import { CampaignCard } from './CampaignsPage.jsx';

/** A home section: its title links to the full page, with the section's main action beside it. */
function Section({ id, title, to, count, action, children }) {
  return (
    <section className="home-section" aria-labelledby={id}>
      <div className="home-section__head">
        <h2 id={id}>
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

/** Home: your characters, the campaigns you host, and the campaigns you play in, all on one page. */
export default function HomePage() {
  const { user } = useAuth();
  const service = useCampaignService();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([api.listCharacters(), service.list()]).then(
      ([characters, campaigns]) => setData({ characters, ...campaigns }),
      () => setFailed(true),
    );
  }, [service]);
  useEffect(load, [load]);

  // Playing: campaigns one of your characters is in, including ones you also host.
  const playing = data ? [...data.playing, ...data.running.filter((c) => c.party.some((m) => m.mine))].sort((a, b) => a.name.localeCompare(b.name)) : [];
  const dropCharacter = (id) => setData((d) => ({ ...d, characters: d.characters.filter((c) => c.id !== id) }));
  const dropCampaign = (id) => setData((d) => ({ ...d, running: d.running.filter((c) => c.id !== id) }));

  return (
    <PageShell>
      <header className="home-greeting">
        <span className="eyebrow">Welcome back</span>
        <h1 className="title">{user.displayName}</h1>
      </header>
      {failed && <p className="form-errors" role="alert">Couldn't load your table. Try refreshing.</p>}
      {!data && !failed && <p className="muted italic center">Gathering your party…</p>}

      {data && (
        <>
          <Section id="home-characters" title="My Characters" to="/characters" count={data.characters.length} action={<Link to="/create" className="btn btn--blood btn--small">Create a Character</Link>}>
            {data.characters.length ? (
              <ul className="char-grid">
                {data.characters.map((c) => <CharacterCard key={c.id} character={c} onDelete={dropCharacter} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">No characters yet. Create one and they'll gather here.</p>
            )}
          </Section>

          <Section id="home-hosting" title="Campaigns I'm Hosting" to="/campaigns" count={data.running.length} action={<Link to="/campaigns/new" className="btn btn--blood btn--small">Create a Campaign</Link>}>
            {data.running.length ? (
              <ul className="camp-grid">
                {data.running.map((c) => <CampaignCard key={c.id} campaign={c} hosting onDeleted={dropCampaign} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">You aren't hosting a campaign yet. Create one from an Adventure Path or your own world.</p>
            )}
          </Section>

          <Section id="home-playing" title="Campaigns I'm Playing" to="/campaigns" count={playing.length}>
            {playing.length ? (
              <ul className="camp-grid">
                {playing.map((c) => <CampaignCard key={c.id} campaign={c} hosting={false} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">
                None of your characters are in a campaign yet. <Link to="/campaigns">Join one with an invite code</Link>.
              </p>
            )}
          </Section>
        </>
      )}
    </PageShell>
  );
}
