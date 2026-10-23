import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../state/AuthContext.jsx';
import { useCampaignService } from '../state/campaignService.js';
import PageShell from '../components/PageShell.jsx';
import CampaignForm from '../components/CampaignForm.jsx';

export default function CampaignCreatePage() {
  const { isDemo } = useAuth();
  const campaigns = useCampaignService();
  const navigate = useNavigate();

  const create = async (input) => {
    const campaign = await campaigns.create(input);
    navigate(`/campaigns/${campaign.id}`, { replace: true, state: { created: true } });
  };

  return (
    <PageShell actions={<Link to="/home" className="topbar__signout">Cancel</Link>}>
      <header className="builder__header">
        <span className="eyebrow">Game master</span>
        <h1 className="title">New campaign</h1>
        <p className="rule-note">
          Name your campaign and set the scene. You'll get an invite code to share, and players use it to bring their characters in.
          {isDemo && ' In the demo, the campaign and its code last until you close this tab.'}
        </p>
      </header>
      <CampaignForm submitLabel="Create campaign" onSubmit={create} />
    </PageShell>
  );
}
