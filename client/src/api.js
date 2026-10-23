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

  listCharacters: () => request('/characters'),
  getCharacter: (id) => request(`/characters/${id}`),
  createCharacter: (data) => post('/characters', data),
  listCampaigns: () => request('/campaigns'),
  saveCharacter:(id, data) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
