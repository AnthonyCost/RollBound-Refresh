import { ownsUpload, storage } from './storage/index.js';

/**
 * Validates an image key sent by the client for an attach/replace/remove.
 * Returns { error } or { key } where key is null (remove) or a verified upload.
 */
export async function checkImageKey(key, kind, userId) {
  if (key === null) return { key: null };
  if (!ownsUpload(key, kind, userId) || !(await storage.verifyImage(key))) {
    return { error: 'That image upload was not found. Try uploading it again.' };
  }
  return { key };
}

/** After saving a new image key in the database: protect the new one and delete the old one. */
export async function swapImages(oldKey, newKey) {
  if (newKey && newKey !== oldKey) await storage.markInUse(newKey);
  if (oldKey && oldKey !== newKey) await storage.deleteObject(oldKey);
}
