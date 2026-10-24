import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import CampaignForm from '../components/CampaignForm.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

export default function CampaignEditPage() {
  const { id } = useParams();
  const campaigns = useCampaignService();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    campaigns
      .get(id)
      .then(setCampaign)
      .catch((err) => setErrors(errorsFrom(err)));
  }, [campaigns, id]);

  const save = async (input) => {
    await campaigns.update(id, input);
    navigate(`/campaigns/${id}`, { replace: true });
  };

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const remove = async () => {
    setDeleting(true);
    setErrors([]);
    try {
      await campaigns.remove(id);
      navigate('/campaigns', { replace: true, state: { deleted: campaign.name } });
    } catch (err) {
      setErrors(errorsFrom(err));
      setDeleting(false);
    }
  };

  const cancel = <Link to={`/campaigns/${id}`} className="btn btn--small">Cancel</Link>;
  const crumbs = [{ label: 'Campaigns', to: '/campaigns' }, { label: campaign?.name ?? 'Campaign', to: `/campaigns/${id}` }, { label: 'Edit' }];
  return (
    <PageShell crumbs={crumbs} actions={cancel}>
      <header className="builder__header">
        <span className="eyebrow">Game master</span>
        <h1 className="title">Edit campaign</h1>
      </header>
      <FormErrors errors={errors} />
      {campaign && !campaign.isGm && <p className="rule-note center">Only the GM can edit this campaign.</p>}
      {!campaign && !errors.length && <p className="muted italic center">Unrolling the map…</p>}
      {campaign?.isGm && <CampaignForm initial={campaign} submitLabel="Save changes" onSubmit={save} />}
      {campaign?.isGm && (
        <section className="panel danger narrow" aria-labelledby="delete-title">
          <h2 id="delete-title" className="panel__title">Delete campaign</h2>
          <p className="rule-note">
            Deleting {campaign.name} can't be undone. Its {campaign.characterCount === 1 ? 'character stays' : 'characters stay'} with
            {campaign.characterCount === 1 ? ' its player' : ' their players'}, in no campaign.
          </p>
          {confirming ? (
            <div className="confirm confirm--inline" role="alertdialog" aria-label="Delete campaign">
              <p>Delete {campaign.name} for everyone?</p>
              <div className="btn-row">
                <button type="button" className="btn btn--grow" onClick={() => setConfirming(false)}>Keep it</button>
                <button type="button" className="btn btn--blood btn--grow" disabled={deleting} onClick={remove}>
                  {deleting ? 'Deleting…' : 'Delete forever'}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirming(true)}>Delete campaign</button>
          )}
        </section>
      )}
    </PageShell>
  );
}
