export class ApiError extends Error {
  constructor(message, status, errors = []) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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
  register: (displayName, email, password) => post('/auth/register', { displayName, email, password }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateProfile: (data) => request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),

  listCharacters: () => request('/characters'),
  getCharacter: (id) => request(`/characters/${id}`),
  createCharacter: (data) => post('/characters', data),
  // keepalive lets the save finish even if the tab is closing.
  setHp: (id, currentHp) => request(`/characters/${id}/hp`, { method: 'PUT', body: JSON.stringify({ currentHp }), keepalive: true }),
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
  regenerateInvite: (campaignId) => post(`/campaigns/${campaignId}/invite-code`, {}),

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
