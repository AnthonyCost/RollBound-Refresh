// Rules every storage driver shares: what counts as a cover image and how keys look.
import { randomUUID } from 'node:crypto';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const UPLOAD_TTL_SECONDS = 10 * 60;

// covers/<uploader's user id>-<uuid>.<ext>. The user id lets the API check that a
// campaign only uses covers its own GM uploaded.
export const COVER_KEY = /^covers\/(\d+)-[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const newCoverKey = (userId, contentType) => `covers/${userId}-${randomUUID()}.${IMAGE_TYPES[contentType]}`;

/** Checks a file's first bytes, since a Content-Type header is only a claim. */
export function looksLikeImage(bytes, contentType) {
  const hex = Buffer.from(bytes).subarray(0, 12).toString('hex');
  if (contentType === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (contentType === 'image/png') return hex.startsWith('89504e470d0a1a0a');
  if (contentType === 'image/webp') return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
  return false;
}

export const contentTypeForKey = (key) =>
  Object.entries(IMAGE_TYPES).find(([, ext]) => key.endsWith(`.${ext}`))?.[0] ?? null;
