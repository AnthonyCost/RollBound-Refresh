import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import CampaignForm from '../components/CampaignForm.jsx';
import FormErrors, { errorsFrom } from '../components/FormErrors.jsx';

/**
 * A campaign's Settings tab, for its GM: edit its name, cover, books and backstory, or
 * delete it (it asks once more; the characters stay with their players).
 */
export default function CampaignSettingsPage() {
  const { campaign, reload } = useOutletContext();
  const campaigns = useCampaignService();
  const navigate = useNavigate();
  const [errors, setErrors] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!campaign.isGm) return <p className="rule-note center">Only the GM can change this campaign’s settings.</p>;

  const save = async (input) => {
    await campaigns.update(campaign.id, input);
    reload();
    navigate(`/campaigns/${campaign.id}`, { replace: true });
  };
  const remove = async () => {
    setDeleting(true);
    setErrors([]);
    try {
      await campaigns.remove(campaign.id);
      navigate('/campaigns', { replace: true, state: { deleted: campaign.name } });
    } catch (err) {
      setErrors(errorsFrom(err));
      setDeleting(false);
    }
  };

  return (
    <div className="settings">
      <header className="settings__head">
        <h1 className="title">Settings</h1>
        <p className="rule-note">Change {campaign.name}’s details, or delete it.</p>
      </header>
      <CampaignForm initial={campaign} submitLabel="Save changes" onSubmit={save} />
      <section className="panel danger narrow" aria-labelledby="delete-title">
        <h2 id="delete-title" className="panel__title">Delete campaign</h2>
        <p className="rule-note">
          Deleting {campaign.name} can't be undone. Its {campaign.characterCount === 1 ? 'character stays' : 'characters stay'} with
          {campaign.characterCount === 1 ? ' its player' : ' their players'}, in no campaign.
        </p>
        <FormErrors errors={errors} />
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
    </div>
  );
}
