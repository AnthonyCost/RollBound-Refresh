// Object storage for user uploads (campaign covers). Uploads follow the S3
// presigned-URL flow: the API hands out a short-lived signed URL, the browser
// PUTs the file straight to it, and records keep only the object key. This file
// is the local-disk stand-in; an S3 version implements the same exports
// (createUpload, objectExists, deleteObject, publicUrl; the bucket handles the PUT).
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'uploads'));
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

const UPLOAD_TTL_MS = 10 * 60 * 1000;
// Without UPLOAD_SECRET, signed URLs only survive until the server restarts.
const SECRET = process.env.UPLOAD_SECRET ?? randomBytes(32).toString('hex');

export const COVER_KEY = /^covers\/(\d+)-[0-9a-f-]{36}\.(jpg|png|webp)$/;

const sign = (key, contentType, expires) =>
  createHmac('sha256', SECRET).update(`${key}\n${contentType}\n${expires}`).digest('base64url');

/** A presigned upload for one image. */
export function createUpload({ userId, contentType }) {
  const key = `covers/${userId}-${randomUUID()}.${IMAGE_TYPES[contentType]}`;
  const expires = Date.now() + UPLOAD_TTL_MS;
  const query = new URLSearchParams({ expires: String(expires), sig: sign(key, contentType, expires) });
  return {
    key,
    uploadUrl: `/api/uploads/${key}?${query}`,
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    expiresAt: new Date(expires).toISOString(),
  };
}

export function verifyUpload(key, contentType, { expires, sig }) {
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(key, contentType, expires));
  const given = Buffer.from(String(sig));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Checks the file's first bytes, since a Content-Type header is only a claim. */
export function looksLikeImage(buffer, contentType) {
  const hex = buffer.subarray(0, 12).toString('hex');
  if (contentType === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (contentType === 'image/png') return hex.startsWith('89504e470d0a1a0a');
  if (contentType === 'image/webp') return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
  return false;
}

const pathFor = (key) => join(UPLOAD_DIR, key);

export async function saveObject(key, buffer) {
  await mkdir(dirname(pathFor(key)), { recursive: true });
  await writeFile(pathFor(key), buffer);
}

export async function objectExists(key) {
  return stat(pathFor(key)).then((s) => s.isFile(), () => false);
}

export async function deleteObject(key) {
  await rm(pathFor(key), { force: true });
}

export const objectPath = pathFor;

export const publicUrl = (key) => (key ? `/api/uploads/${key}` : null);
