import { Link, useNavigate } from 'react-router-dom';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import CampaignForm from '../components/CampaignForm.jsx';

export default function CampaignCreatePage() {
  const campaigns = useCampaignService();
  const navigate = useNavigate();

  const create = async (input) => {
    const campaign = await campaigns.create(input);
    navigate(`/campaigns/${campaign.id}`, { replace: true, state: { created: true } });
  };

  return (
    <PageShell
      crumbs={[{ label: 'Campaigns', to: '/home?mode=gm' }, { label: 'New campaign' }]}
      actions={<Link to="/home" className="btn btn--small">Cancel</Link>}
    >
      <header className="builder__header">
        <span className="eyebrow">Game master</span>
        <h1 className="title">New campaign</h1>
        <p className="rule-note">
          Name your campaign and set the scene. You'll get an invite code to share, and players use it to bring their characters in.
        </p>
      </header>
      <CampaignForm submitLabel="Create campaign" onSubmit={create} />
    </PageShell>
  );
}
