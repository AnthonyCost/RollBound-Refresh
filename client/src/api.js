async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`${options.method ?? 'GET'} ${path} failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

export const api = {
  listCharacters: () => request('/characters'),
  getCharacter: (id) => request(`/characters/${id}`),
  saveCharacter: (id, data) => request(`/characters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};
