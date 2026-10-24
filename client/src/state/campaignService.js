import { api } from '../api.js';

/**
 * Campaign operations against the API. `cover` is { file } for a new image,
 * { remove: true } to drop the current one, or {} to leave it alone. `books` is
 * null for every book, or a list of book titles (see campaignBooks in the rules).
 */
const serverCampaignService = {
  list: () => api.listCampaigns(),
  get: (id) => api.getCampaign(id),

  async create({ name, backstory, partyLevel, cover, books = null }) {
    const coverKey = cover.file ? await api.uploadImage(cover.file, 'cover') : null;
    return api.createCampaign({ name, backstory, partyLevel, coverKey, books });
  },

  async update(id, { name, backstory, partyLevel, cover, books = null }) {
    const body = { name, backstory, partyLevel, books };
    if (cover.file) body.coverKey = await api.uploadImage(cover.file, 'cover');
    else if (cover.remove) body.coverKey = null;
    return api.updateCampaign(id, body);
  },

  remove: (id) => api.deleteCampaign(id),
  removeCharacter: (campaignId, characterId) => api.removeFromCampaign(campaignId, characterId),
  character: (campaignId, characterId) => api.getCampaignCharacter(campaignId, characterId),
  preview: (code) => api.previewInvite(code),
  join: (code, characterId) => api.joinCampaign(code, characterId),
  leave: (campaignId, characterId) => api.leaveCampaign(campaignId, characterId),
};

/** Campaign operations. (A hook so callers don't change if this ever needs session state.) */
export function useCampaignService() {
  return serverCampaignService;
}
