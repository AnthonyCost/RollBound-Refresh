export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

/** Fired when the server answers 401 Not signed in. */
export const SIGNED_OUT_EVENT = 'rollbound:signed-out';

async function request(path, options = {}) {
  // Browsers refuse keepalive requests with bodies over 64 KB, so big ones go without it.
  const keepalive = options.keepalive && (options.body?.length ?? 0) < 60_000;
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    keepalive,
  });
  // The server forgot this session (a demo ended, or the sign-in expired): tell
  // AuthContext, which signs out if it thought we were signed in.
  if (res.status === 401) window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const errors = body.errors ?? (body.error ? [body.error] : []);
    throw new ApiError(`${options.method ?? 'GET'} ${path} failed: ${res.status}`, res.status, errors);
  }
  return res.status === 204 ? null : res.json();
}

const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) });

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => post('/auth/login', { email, password }),
  startDemo: () => post('/auth/demo', {}),
  register: (displayName, email, password) => post('/auth/register', { displayName, email, password }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateProfile: (data) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  listCharacters: () => request('/characters'),
  getCharacter: (id) => request(`/characters/${id}`),
  deleteCharacter: (id) => request(`/characters/${id}`, { method: 'DELETE' }),
  createCharacter: (data) => post('/characters', data),
  // keepalive lets the save finish even if the tab is closing.
  setHp: (id, currentHp) => request(`/characters/${id}/hp`, { method: 'PUT', body: JSON.stringify({ currentHp }), keepalive: true }),
  setInventory: (id, inventory) => request(`/characters/${id}/inventory`, { method: 'PUT', body: JSON.stringify(inventory), keepalive: true }),
  setPrepared: (id, prepared) => request(`/characters/${id}/prepared`, { method: 'PUT', body: JSON.stringify(prepared), keepalive: true }),
  setBackstory: (id, backstory) => request(`/characters/${id}/backstory`, { method: 'PUT', body: JSON.stringify({ backstory }), keepalive: true }),
  resetShareLink: (id) => post(`/characters/${id}/share-link`, {}),
  getSharedSheet: (shareId) => request(`/sheets/${encodeURIComponent(shareId)}`),
  setPortrait: (id, portraitKey) => request(`/characters/${id}/portrait`, { method: 'PUT', body: JSON.stringify({ portraitKey }) }),
  listCampaigns: () => request('/campaigns'),
  getCampaign: (id) => request(`/campaigns/${id}`),
  createCampaign: (data) => post('/campaigns', data),
  updateCampaign: (id, data) => request(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  previewInvite: (code) => request(`/campaigns/invites/${encodeURIComponent(code)}`),
  joinCampaign: (code, characterId) => post('/campaigns/join', { code, characterId }),
  leaveCampaign: (campaignId, characterId) => post(`/campaigns/${campaignId}/leave`, { characterId }),
  inbox: () => request('/inbox'),
  markRead: (ids) => post('/inbox/read', { ids }),
  answerJoinRequest: (id, accept) => post(`/join-requests/${id}/${accept ? 'accept' : 'reject'}`, {}),
  latestLog: () => request('/campaigns/latest-log'),
  listLogs: (campaignId) => request(`/campaigns/${campaignId}/logs`),
  getLog: (campaignId, logId) => request(`/campaigns/${campaignId}/logs/${logId}`),
  createLog: (campaignId, log) => post(`/campaigns/${campaignId}/logs`, log),
  updateLog: (campaignId, logId, log) => request(`/campaigns/${campaignId}/logs/${logId}`, { method: 'PUT', body: JSON.stringify(log) }),
  deleteLog: (campaignId, logId) => request(`/campaigns/${campaignId}/logs/${logId}`, { method: 'DELETE' }),
  listEncounters: (campaignId) => request(`/campaigns/${campaignId}/encounters`),
  getEncounter: (campaignId, id) => request(`/campaigns/${campaignId}/encounters/${id}`),
  createEncounter: (campaignId, e) => post(`/campaigns/${campaignId}/encounters`, e),
  updateEncounter: (campaignId, id, e) => request(`/campaigns/${campaignId}/encounters/${id}`, { method: 'PUT', body: JSON.stringify(e) }),
  deleteEncounter: (campaignId, id) => request(`/campaigns/${campaignId}/encounters/${id}`, { method: 'DELETE' }),
  saveEncounterState: (campaignId, id, state) => request(`/campaigns/${campaignId}/encounters/${id}/state`, { method: 'PUT', body: JSON.stringify(state) }),
  endEncounter: (campaignId, id) => request(`/campaigns/${campaignId}/encounters/${id}/state`, { method: 'DELETE' }),
  deleteCampaign: (campaignId) => request(`/campaigns/${campaignId}`, { method: 'DELETE' }),
  removeFromCampaign: (campaignId, characterId) => post(`/campaigns/${campaignId}/remove`, { characterId }),
  getCampaignCharacter: (campaignId, characterId) => request(`/campaigns/${campaignId}/characters/${characterId}`),
  // Revalidates each time, so an unchanged encounter comes back as a 304 from the browser cache.
  getRunningEncounter: (campaignId) => request(`/campaigns/${campaignId}/encounter`, { cache: 'no-cache' }),

  /**
   * Uploads an image the way S3 presigned uploads work: get a signed URL from the
   * API, send the file straight to it, and keep only the returned key.
   * kind is "cover", "avatar", or "portrait".
   */
  async uploadImage(file, kind) {
    const target = await post('/uploads', { kind, contentType: file.type, size: file.size });
    const res = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(`Upload failed: ${res.status}`, res.status, body.errors ?? ['The image upload failed.']);
    }
    return target.key;
  },
  saveCharacter: (id, data) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
