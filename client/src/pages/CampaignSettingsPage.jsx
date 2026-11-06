import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import CampaignForm from '../components/CampaignForm.jsx';
import SettingsMenu from '../components/SettingsMenu.jsx';
import Icon from '../components/Icon.jsx';
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
  const [section, setSection] = useState('details');
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

  const sections = [
    { id: 'details', label: 'Details', hint: 'Title and party level', icon: 'map' },
    { id: 'books', label: 'Books', hint: 'What players can build from', icon: 'book' },
    { id: 'story', label: 'Backstory', hint: 'What the heroes know', icon: 'lore' },
    { id: 'cover', label: 'Cover', hint: campaign.coverUrl ? 'Change or remove it' : 'Add one', icon: 'overview' },
    { id: 'delete', label: 'Delete campaign', hint: 'For everyone', icon: 'conditionDying', danger: true },
  ];

  return (
    <div className="settings">
      <h1 className="visually-hidden">{campaign.name}: settings</h1>
      <SettingsMenu
        label={`${campaign.name} settings`}
        sections={sections}
        active={section}
        onSelect={(id) => {
          setSection(id);
          setConfirming(false);
        }}
        head={
          <>
            <span className="shop__sigil"><Icon name="crown" size={26} /></span>
            <div>
              <p className="co__class-name">{campaign.name}</p>
              <p className="co__class-count">Party level {campaign.partyLevel} · you’re the GM</p>
            </div>
          </>
        }
      >
        <div hidden={section === 'delete'}>
          <CampaignForm initial={campaign} submitLabel="Save changes" onSubmit={save} panel={section === 'delete' ? null : section} />
        </div>
        {section === 'delete' && (
          <div className="settings-menu__danger">
            <p className="settings-menu__lede">
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
              <div className="co__actions">
                <button type="button" className="btn settings__delete" onClick={() => setConfirming(true)}>Delete {campaign.name}</button>
              </div>
            )}
          </div>
        )}
      </SettingsMenu>
    </div>
  );
}
