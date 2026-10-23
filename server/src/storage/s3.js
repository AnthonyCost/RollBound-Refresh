// AWS S3 storage. Browsers upload images straight to the bucket with presigned
// PUT URLs; the API never handles the file bytes. Turn it on with
// STORAGE_DRIVER=s3. Setup steps: docs/aws-s3-setup.md.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UPLOAD_TTL_SECONDS, contentTypeForKey, looksLikeImage, newUploadKey } from './shared.js';

export const name = 's3';

const BUCKET = process.env.S3_BUCKET;
const REGION = process.env.AWS_REGION;
// Where browsers load images from: a CloudFront distribution (recommended) or the bucket's own URL.
const PUBLIC_URL = process.env.S3_PUBLIC_URL?.replace(/\/+$/, '');

const missing = [['S3_BUCKET', BUCKET], ['AWS_REGION', REGION], ['S3_PUBLIC_URL', PUBLIC_URL]].filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  throw new Error(`STORAGE_DRIVER=s3 needs ${missing.join(', ')} in server/.env. See docs/aws-s3-setup.md.`);
}

// Credentials come from the standard AWS chain: AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY
// in .env for development, or an IAM role when deployed. Never hard-code them.
// S3_ENDPOINT points at an S3-compatible service (MinIO, LocalStack) for local testing.
const client = new S3Client({
  region: REGION,
  ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }),
});

// New uploads are tagged pending. A lifecycle rule (infra/aws/s3-lifecycle.json)
// deletes pending objects after a day, so images that were uploaded but never
// saved (to a campaign, account, or character) don't pile up. Saving retags them attached.
const PENDING_TAG = 'state=pending';

export async function createUpload({ kind, userId, contentType, size }) {
  const key = newUploadKey(kind, userId, contentType);
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    // Signing the length means S3 rejects any file other than the one the API approved.
    ContentLength: size,
    Tagging: PENDING_TAG,
    CacheControl: 'public, max-age=31536000, immutable',
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_TTL_SECONDS,
    // The browser must send these exact headers, so they're part of the signature.
    signableHeaders: new Set(['content-type', 'content-length', 'x-amz-tagging']),
    unhoistableHeaders: new Set(['x-amz-tagging']),
  });
  return {
    key,
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': contentType, 'x-amz-tagging': PENDING_TAG },
    expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
  };
}

/**
 * True when the object exists and really is an image. The browser uploaded it
 * without passing through the API, so read its first bytes to make sure.
 */
export async function verifyImage(key) {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: 'bytes=0-11' }));
    const bytes = await res.Body.transformToByteArray();
    const expected = contentTypeForKey(key);
    return res.ContentType === expected && looksLikeImage(bytes, expected);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return false;
    throw err;
  }
}

export async function markInUse(key) {
  await client.send(
    new PutObjectTaggingCommand({ Bucket: BUCKET, Key: key, Tagging: { TagSet: [{ Key: 'state', Value: 'attached' }] } }),
  );
}

export async function deleteObject(key) {
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

export const publicUrl = (key) => (key ? `${PUBLIC_URL}/${key}` : null);
