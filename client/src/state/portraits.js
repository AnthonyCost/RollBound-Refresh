import { api } from '../api.js';

/** Sets (file) or removes (null) a character's portrait and returns the new URL. */
export async function savePortrait(characterId, file) {
  const key = file ? await api.uploadImage(file, 'portrait') : null;
  return (await api.setPortrait(characterId, key)).portraitUrl;
}
