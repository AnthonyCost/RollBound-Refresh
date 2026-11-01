// The campaign this person last opened on this device, for Home's Continue card.
const keyFor = (userId) => `rollbound.lastCampaign.${userId}`;

export function rememberCampaign(userId, campaignId) {
  try {
    localStorage.setItem(keyFor(userId), String(campaignId));
  } catch {
    // Without storage, Home falls back to the newest campaign.
  }
}

export function lastCampaign(userId) {
  try {
    return Number(localStorage.getItem(keyFor(userId))) || null;
  } catch {
    return null;
  }
}
