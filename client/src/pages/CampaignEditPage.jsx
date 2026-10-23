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

  const cancel = <Link to={`/campaigns/${id}`} className="topbar__signout">Cancel</Link>;
  return (
    <PageShell actions={cancel}>
      <header className="builder__header">
        <span className="eyebrow">Game master</span>
        <h1 className="title">Edit campaign</h1>
      </header>
      <FormErrors errors={errors} />
      {campaign && !campaign.isGm && <p className="rule-note center">Only the GM can edit this campaign.</p>}
      {!campaign && !errors.length && <p className="muted italic center">Unrolling the map…</p>}
      {campaign?.isGm && <CampaignForm initial={campaign} submitLabel="Save changes" onSubmit={save} />}
    </PageShell>
  );
}
