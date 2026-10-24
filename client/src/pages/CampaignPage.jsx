import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import CampaignCover from '../components/CampaignCover.jsx';
import InviteCode from '../components/InviteCode.jsx';
import Ornament from '../components/Ornament.jsx';
import Portrait from '../components/Portrait.jsx';
import Avatar from '../components/Avatar.jsx';
import { useAuth } from '../state/AuthContext.jsx';
import { demoPortraitUrl } from '../state/portraits.js';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';
import { booksLabel } from '../state/rulesData.js';

export default function CampaignPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const [campaign, setCampaign] = useState(null);
  const [errors, setErrors] = useState([]);
  const [missing, setMissing] = useState(false);
  const service = useCampaignService();
  const { isDemo } = useAuth();

  const load = useCallback(() => {
    service
      .get(id)
      .then(setCampaign)
      .catch((err) => (err.status === 404 ? setMissing(true) : setErrors(errorsFrom(err))));
  }, [service, id]);

  useEffect(load, [load]);

  const regenerate = async () => {
    try {
      const { inviteCode } = await service.regenerate(id);
      setCampaign((c) => ({ ...c, inviteCode }));
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

  const back = <Link to="/home" className="topbar__signout">Hub</Link>;
  if (missing) {
    return (
      <PageShell actions={back}>
        <p className="muted italic center">This campaign doesn't exist, or you're not part of it. <Link to="/home">Back to the hub</Link></p>
      </PageShell>
    );
  }
  if (!campaign) {
    return (
      <PageShell actions={back}>
        <FormErrors errors={errors} />
        {!errors.length && <p className="muted italic center">Unrolling the map…</p>}
      </PageShell>
    );
  }

  const others = campaign.characters.filter((c) => !c.mine);
  const actions = (
    <>
      {campaign.isGm && <Link to={`/campaigns/${id}/edit`} className="topbar__signout">Edit</Link>}
      {back}
    </>
  );
  return (
    <PageShell actions={actions}>
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
          {campaign.isGm && <InviteCode code={campaign.inviteCode} onRegenerate={regenerate} />}
          {campaign.isGm && (
            <Link to={`/create?invite=${encodeURIComponent(campaign.inviteCode)}`} className="btn">
              Build a character for this campaign
            </Link>
          )}

          <Ornament label="THE PARTY" />
          {campaign.characters.length ? (
            <ul className="hub__list">
              {campaign.characters.map((c) => (
                <li key={c.id} className="hub-card">
                  <Portrait url={isDemo ? demoPortraitUrl(c.id) : c.portraitUrl} name={c.name} size="sm" />
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
                  {c.mine && (
                    <div className="hub-card__actions">
                      {c.outsideBooks?.length > 0 && <Link to={`/characters/${c.id}/edit`} className="chip chip--link">Edit</Link>}
                      <Link to={`/play/${c.id}/sheet`} className="chip chip--link">Play</Link>
                      <button type="button" className="chip" onClick={() => leave(c.id)}>Leave</button>
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
    </PageShell>
  );
}
