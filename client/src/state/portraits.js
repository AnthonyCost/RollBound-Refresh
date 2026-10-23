import { api } from '../api.js';
import { imageToDataUrl } from '../imageData.js';

// Demo characters (Mira included) keep portraits in this tab only.
const KEY = 'rollbound:demo-portraits';

function readDemo() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export const demoPortraitUrl = (characterId) => readDemo()[characterId] ?? null;

export function clearDemoPortraits() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Sets (file) or removes (null) a character's portrait and returns the new URL.
 * Signed-in users upload to storage; demo users keep a shrunken copy in the tab.
 */
export async function savePortrait(characterId, file, { isDemo }) {
  if (!isDemo) {
    const key = file ? await api.uploadImage(file, 'portrait') : null;
    return (await api.setPortrait(characterId, key)).portraitUrl;
  }
  const portraits = readDemo();
  if (file) portraits[characterId] = await imageToDataUrl(file, 600);
  else delete portraits[characterId];
  try {
    sessionStorage.setItem(KEY, JSON.stringify(portraits));
  } catch {
    throw new Error("Your browser's storage for this tab is full. Try a smaller image.");
  }
  return portraits[characterId] ?? null;
}
