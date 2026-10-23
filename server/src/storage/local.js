// Local-disk storage: the stand-in for S3 during development. It mimics S3's
// presigned PUT flow with HMAC-signed URLs that the API itself accepts
// (see routes/uploads.js), and saves files under server/uploads/.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, open, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOAD_TTL_SECONDS, contentTypeForKey, looksLikeImage, newCoverKey } from './shared.js';

export const name = 'local';

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads'));

// Without UPLOAD_SECRET, signed URLs only survive until the server restarts.
const SECRET = process.env.UPLOAD_SECRET ?? randomBytes(32).toString('hex');

const sign = (key, contentType, expires) =>
  createHmac('sha256', SECRET).update(`${key}\n${contentType}\n${expires}`).digest('base64url');

export const objectPath = (key) => join(UPLOAD_DIR, key);

export async function createUpload({ userId, contentType }) {
  const key = newCoverKey(userId, contentType);
  const expires = Date.now() + UPLOAD_TTL_SECONDS * 1000;
  const query = new URLSearchParams({ expires: String(expires), sig: sign(key, contentType, expires) });
  return {
    key,
    uploadUrl: `/api/uploads/${key}?${query}`,
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    expiresAt: new Date(expires).toISOString(),
  };
}

/** Checks a signed local upload URL (the part S3 does itself in production). */
export function verifyUpload(key, contentType, { expires, sig }) {
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(key, contentType, expires));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function saveObject(key, buffer) {
  await mkdir(dirname(objectPath(key)), { recursive: true });
  await writeFile(objectPath(key), buffer);
}

/** True when the object exists and its first bytes match its image type. */
export async function verifyImage(key) {
  const file = await open(objectPath(key)).catch(() => null);
  if (!file) return false;
  try {
    const { buffer, bytesRead } = await file.read(Buffer.alloc(12), 0, 12, 0);
    return looksLikeImage(buffer.subarray(0, bytesRead), contentTypeForKey(key));
  } finally {
    await file.close();
  }
}

// Local files are never cleaned up automatically, so there's nothing to mark.
export async function markInUse() {}

export async function deleteObject(key) {
  await rm(objectPath(key), { force: true });
}

export const publicUrl = (key) => (key ? `/api/uploads/${key}` : null);
