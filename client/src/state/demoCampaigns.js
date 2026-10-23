// Demo-mode campaigns live only in this browser tab, like the rest of the demo.
// They mirror the server's behavior closely enough to try the whole flow:
// create, edit, invite codes, and joining with your demo characters.
import { mira } from '@rollbound/rules';
import { getDemoCharacter, listDemoCharacters } from './demoCharacters.js';

const KEY = 'rollbound:demo-campaigns';
const MIRA_ID = 'demo';
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function inviteCode() {
  const bytes = crypto.getRandomValues(new Uint32Array(8));
  const raw = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

const normalize = (code) => {
  const raw = String(code ?? '').toUpperCase().replace(/[\s-]/g, '');
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : null;
};

function seed() {
  const wolves = {
    id: 'demo-wolves',
    name: 'Wolves at the Ford',
    backstory: 'A pack of wolves has been harrying travelers at the river crossing outside town. The ferryman swears they hunt like soldiers.',
    coverUrl: null,
    partyLevel: 1,
    inviteCode: inviteCode(),
    createdAt: new Date().toISOString(),
  };
  return { campaigns: [wolves], memberships: { [MIRA_ID]: wolves.id } };
}

function read() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY));
    if (stored?.campaigns) return stored;
  } catch {
    // Unreadable storage: fall through to a fresh demo.
  }
  const fresh = seed();
  write(fresh);
  return fresh;
}

function write(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    throw Object.assign(new Error("Your browser's storage for this tab is full. Try a smaller cover image."), { demoStorage: true });
  }
}

export function clearDemoCampaigns() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

function demoCharacters() {
  return [{ id: MIRA_ID, data: mira }, ...listDemoCharacters()];
}

const characterData = (id) => (id === MIRA_ID ? mira : getDemoCharacter(id)?.data);

/** Campaign name for each demo character, for the hub. */
export function demoMemberships() {
  const { campaigns, memberships } = read();
  return Object.fromEntries(Object.entries(memberships).map(([charId, campId]) => [charId, campaigns.find((c) => c.id === campId) ?? null]));
}

const notFound = () => Object.assign(new Error('Campaign not found.'), { status: 404 });

function withCounts(c, memberships) {
  return { ...c, isGm: true, gmName: 'You', characterCount: Object.values(memberships).filter((id) => id === c.id).length };
}

/** Shrinks a cover to fit comfortably in session storage, as a JPEG data URL. */
async function coverDataUrl(file, maxWidth = 1280) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b0908';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', 0.8);
}

export const demoCampaignService = {
  async list() {
    const { campaigns, memberships } = read();
    return { running: campaigns.map((c) => withCounts(c, memberships)), playing: [] };
  },

  async get(id) {
    const { campaigns, memberships } = read();
    const c = campaigns.find((x) => x.id === id);
    if (!c) throw notFound();
    const characters = Object.entries(memberships)
      .filter(([, campId]) => campId === id)
      .map(([charId]) => ({ charId, data: characterData(charId) }))
      .filter((x) => x.data)
      .map(({ charId, data }) => ({
        id: charId,
        name: data.name,
        level: data.level,
        className: data.className,
        ancestry: data.ancestry.name,
        player: 'You',
        mine: true,
      }));
    return { ...withCounts(c, memberships), characters };
  },

  async create({ name, backstory, partyLevel, cover }) {
    const state = read();
    const campaign = {
      id: `demo-c${Date.now()}`,
      name: name.trim(),
      backstory: backstory.trim(),
      partyLevel,
      coverUrl: cover.file ? await coverDataUrl(cover.file) : null,
      inviteCode: inviteCode(),
      createdAt: new Date().toISOString(),
    };
    write({ ...state, campaigns: [...state.campaigns, campaign] });
    return withCounts(campaign, state.memberships);
  },

  async update(id, { name, backstory, partyLevel, cover }) {
    const state = read();
    const existing = state.campaigns.find((c) => c.id === id);
    if (!existing) throw notFound();
    const coverUrl = cover.file ? await coverDataUrl(cover.file) : cover.remove ? null : existing.coverUrl;
    const updated = { ...existing, name: name.trim(), backstory: backstory.trim(), partyLevel, coverUrl };
    write({ ...state, campaigns: state.campaigns.map((c) => (c.id === id ? updated : c)) });
    return withCounts(updated, state.memberships);
  },

  async regenerate(id) {
    const state = read();
    const code = inviteCode();
    write({ ...state, campaigns: state.campaigns.map((c) => (c.id === id ? { ...c, inviteCode: code } : c)) });
    return { inviteCode: code };
  },

  async preview(code) {
    const c = read().campaigns.find((x) => x.inviteCode === normalize(code));
    if (!c) throw Object.assign(new Error('No campaign in this demo uses that invite code.'), { status: 404 });
    const { inviteCode: _hidden, ...rest } = c;
    return { ...rest, gmName: 'You' };
  },

  async join(code, characterId) {
    const state = read();
    const c = state.campaigns.find((x) => x.inviteCode === normalize(code));
    if (!c) throw Object.assign(new Error('No campaign in this demo uses that invite code.'), { status: 404 });
    if (!demoCharacters().some((ch) => ch.id === characterId)) throw new Error('Character not found.');
    write({ ...state, memberships: { ...state.memberships, [characterId]: c.id } });
    return { campaignId: c.id };
  },

  async leave(campaignId, characterId) {
    const state = read();
    const { [characterId]: _gone, ...rest } = state.memberships;
    write({ ...state, memberships: rest });
  },
};
