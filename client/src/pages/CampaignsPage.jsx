import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../state/AuthContext.jsx';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import Portrait from '../components/Portrait.jsx';
import Avatar from '../components/Avatar.jsx';
import JoinCampaign from '../components/JoinCampaign.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { adventurePath } from '@rollbound/rules';
import { campaignCover } from '../state/campaignCovers.js';

const PORTRAITS_SHOWN = 6;
const started = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** One campaign as a card: the party's portraits, its name, players, your role, and actions. */
export function CampaignCard({ campaign: c, hosting, onDeleted }) {
  const service = useCampaignService();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  const mine = c.party.filter((m) => m.mine);
  const path = adventurePath(c.adventurePath);
  const remove = async () => {
    setBusy(true);
    try {
      await service.remove(c.id);
      onDeleted(c.id);
    } catch (err) {
      setErrors(errorsFrom(err));
      setBusy(false);
    }
  };

  return (
    <li className="camp-card">
      <Link to={`/campaigns/${c.id}`} className="camp-card__open">
        <span className="camp-card__cover">
          <img src={campaignCover(c)} alt="" />
        </span>
        <span className="camp-card__party" aria-label={c.party.length ? `Party: ${c.party.map((m) => m.name).join(', ')}` : 'No one has joined yet'}>
          {c.party.slice(0, PORTRAITS_SHOWN).map((m) => (
            <span key={m.id} title={m.name}>
              <Portrait url={m.portraitUrl} name={m.name} size="sm" />
            </span>
          ))}
          {c.party.length > PORTRAITS_SHOWN && <span className="camp-card__more">+{c.party.length - PORTRAITS_SHOWN}</span>}
        </span>
        <span className="camp-card__name">{c.name}</span>
        <span className="camp-card__meta">
          {path ? path.name : 'Homebrew'} · Started {started(c.createdAt)}
        </span>
        <span className="camp-card__players">
          <strong>{c.party.length}</strong>
          <small>{c.party.length === 1 ? 'Player' : 'Players'}</small>
        </span>
        <span className="camp-card__role">
          {hosting ? (
            'Role: Game Master'
          ) : (
            <>
              <Avatar url={c.gmAvatarUrl} name={c.gmName} size={18} /> Run by {c.gmName}
            </>
          )}
        </span>
        {mine.length > 0 && <span className="camp-card__mine">Playing {mine.map((m) => m.name).join(', ')}</span>}
      </Link>
      {confirming ? (
        <div className="char-card__confirm" role="alertdialog" aria-label={`Delete ${c.name}`}>
          <p>Delete {c.name} for everyone? Its characters stay with their players.</p>
          <div className="btn-row">
            <button type="button" className="btn btn--small btn--grow" onClick={() => setConfirming(false)}>Keep</button>
            <button type="button" className="btn btn--small btn--blood btn--grow" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
          <FormErrors errors={errors} />
        </div>
      ) : (
        <div className="char-card__actions">
          <Link to={`/campaigns/${c.id}`}>View</Link>
          {hosting && <Link to={`/campaigns/${c.id}/edit`}>Edit</Link>}
          {hosting && <Link to={`/campaigns/${c.id}/encounters`}>Encounters</Link>}
          {hosting && <button type="button" className="char-card__delete" onClick={() => setConfirming(true)}>Delete</button>}
          {!hosting && <Link to={`/campaigns/${c.id}/logs`}>Session Logs</Link>}
        </div>
      )}
    </li>
  );
}

/** Your campaigns: the ones you host, and the ones your characters play in. */
export default function CampaignsPage() {
  const { isDemo } = useAuth();
  const service = useCampaignService();
  const { state } = useLocation();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    Promise.all([service.list(), api.listCharacters()]).then(
      ([campaigns, characters]) => setData({ ...campaigns, characters }),
      () => setFailed(true),
    );
  }, [service]);
  useEffect(load, [load]);

  // Playing: campaigns one of your characters is in, including ones you also host.
  const playing = data ? [...data.playing, ...data.running.filter((c) => c.party.some((m) => m.mine))].sort((a, b) => a.name.localeCompare(b.name)) : [];
  const dropHosted = (id) => setData((d) => ({ ...d, running: d.running.filter((c) => c.id !== id) }));

  return (
    <PageShell crumbs={[{ label: 'Campaigns' }]}>
      <header className="list-head">
        <h1 className="title">My Campaigns</h1>
        <Link to="/campaigns/new" className="btn btn--blood">Create a Campaign</Link>
      </header>
      {state?.deleted && <p className="panel panel--hot center" role="status">Deleted {state.deleted}. Its characters are still with their players.</p>}
      {failed && <p className="form-errors" role="alert">Couldn't load your campaigns. Try refreshing.</p>}
      {!data && !failed && <p className="muted italic center">Unrolling the maps…</p>}

      {data && (
        <>
          <section className="camp-section" aria-labelledby="hosting-title">
            <div className="camp-section__head">
              <h2 id="hosting-title">Campaigns I'm Hosting</h2>
              <p className="rule-note">You're the Game Master. Share each one's invite code from its page to gather players.</p>
            </div>
            {data.running.length ? (
              <ul className="camp-grid">
                {data.running.map((c) => <CampaignCard key={c.id} campaign={c} hosting onDeleted={dropHosted} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">You aren't hosting a campaign yet. Create one from an Adventure Path or your own world.</p>
            )}
            {isDemo && <p className="rule-note">Demo campaigns are only for this demo. Create an account to invite real players.</p>}
          </section>

          <section className="camp-section" aria-labelledby="playing-title">
            <div className="camp-section__head">
              <h2 id="playing-title">Campaigns I'm Playing</h2>
              <p className="rule-note">Campaigns your characters are in. Enter a GM's invite code below to ask to join another.</p>
            </div>
            {playing.length ? (
              <ul className="camp-grid">
                {playing.map((c) => <CampaignCard key={c.id} campaign={c} hosting={false} />)}
              </ul>
            ) : (
              <p className="panel panel--dashed muted italic center">None of your characters are in a campaign yet.</p>
            )}
            <div className="camp-join">
              <JoinCampaign characters={data.characters} onJoined={load} />
            </div>
          </section>
        </>
      )}
    </PageShell>
  );
}
