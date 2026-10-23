// Rules every storage driver shares: which images are allowed and how keys look.
import { randomUUID } from 'node:crypto';

export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const UPLOAD_TTL_SECONDS = 10 * 60;

const MB = 1024 * 1024;

/** Each kind of upload gets its own folder (S3 prefix) and size limit. */
export const UPLOAD_KINDS = {
  cover: { prefix: 'covers', maxBytes: 5 * MB, label: 'Covers' },
  avatar: { prefix: 'avatars', maxBytes: 2 * MB, label: 'Profile images' },
  portrait: { prefix: 'portraits', maxBytes: 5 * MB, label: 'Portraits' },
};

export const MAX_IMAGE_BYTES = Math.max(...Object.values(UPLOAD_KINDS).map((k) => k.maxBytes));
export const UPLOAD_PREFIXES = Object.values(UPLOAD_KINDS).map((k) => k.prefix);

// <prefix>/<uploader's user id>-<uuid>.<ext>. The user id lets the API check
// that people only attach images they uploaded themselves.
const KEY = /^(covers|avatars|portraits)\/(\d+)-[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const isUploadKey = (key) => typeof key === 'string' && KEY.test(key);

export const newUploadKey = (kind, userId, contentType) =>
  `${UPLOAD_KINDS[kind].prefix}/${userId}-${randomUUID()}.${IMAGE_TYPES[contentType]}`;

/** True when `key` is an upload of this kind made by this user. */
export function ownsUpload(key, kind, userId) {
  const m = typeof key === 'string' && KEY.exec(key);
  return Boolean(m && m[1] === UPLOAD_KINDS[kind].prefix && Number(m[2]) === userId);
}

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
