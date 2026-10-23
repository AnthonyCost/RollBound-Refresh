import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';
import { demoCampaignService } from './demoCampaigns.js';

/**
 * Campaign operations against the API. `cover` is { file } for a new image,
 * { remove: true } to drop the current one, or {} to leave it alone.
 */
const serverCampaignService = {
  list: () => api.listCampaigns(),
  get: (id) => api.getCampaign(id),

  async create({ name, backstory, partyLevel, cover }) {
    const coverKey = cover.file ? await api.uploadImage(cover.file, 'cover') : null;
    return api.createCampaign({ name, backstory, partyLevel, coverKey });
  },

  async update(id, { name, backstory, partyLevel, cover }) {
    const body = { name, backstory, partyLevel };
    if (cover.file) body.coverKey = await api.uploadImage(cover.file, 'cover');
    else if (cover.remove) body.coverKey = null;
    return api.updateCampaign(id, body);
  },

  regenerate: (id) => api.regenerateInvite(id),
  preview: (code) => api.previewInvite(code),
  join: (code, characterId) => api.joinCampaign(code, characterId),
  leave: (campaignId, characterId) => api.leaveCampaign(campaignId, characterId),
};

/** The right campaign backend for this session: the API, or the demo's in-tab store. */
export function useCampaignService() {
  const { isDemo } = useAuth();
  return isDemo ? demoCampaignService : serverCampaignService;
}
