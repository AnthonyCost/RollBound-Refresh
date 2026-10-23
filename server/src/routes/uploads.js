import express, { Router } from 'express';
import { requireUser } from '../auth.js';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, UPLOAD_KINDS, UPLOAD_PREFIXES, isUploadKey, looksLikeImage, storage } from '../storage/index.js';

export const uploads = Router();

const formatMb = (bytes) => `${bytes / (1024 * 1024)} MB`;

// Step 1: ask for a presigned upload URL. With S3 it points at the bucket.
// kind is "cover" (campaign), "avatar" (account), or "portrait" (character).
uploads.post('/', requireUser, async (req, res) => {
  const { kind = 'cover', contentType, size } = req.body ?? {};
  const rules = UPLOAD_KINDS[kind];
  if (!rules) return res.status(400).json({ errors: ['Unknown kind of upload.'] });
  if (!IMAGE_TYPES[contentType]) return res.status(400).json({ errors: [`${rules.label} must be JPEG, PNG, or WebP images.`] });
  if (!Number.isInteger(size) || size <= 0 || size > rules.maxBytes) {
    return res.status(400).json({ errors: [`${rules.label} must be ${formatMb(rules.maxBytes)} or smaller.`] });
  }
  res.status(201).json(await storage.createUpload({ kind, userId: req.user.id, contentType, size }));
});

// Step 2 (local driver only): the browser PUTs the file here, and images are
// served from here. With S3, the bucket and CloudFront do both.
if (storage.name === 'local') {
  const keyFrom = (req) => (UPLOAD_PREFIXES.includes(req.params.prefix) ? `${req.params.prefix}/${req.params.file}` : null);

  uploads.put(
    '/:prefix/:file',
    express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      const key = keyFrom(req);
      const contentType = req.get('Content-Type');
      if (!isUploadKey(key) || !storage.verifyUpload(key, contentType, req.query)) {
        return res.status(403).json({ errors: ['This upload link is invalid or has expired.'] });
      }
      if (!Buffer.isBuffer(req.body) || !looksLikeImage(req.body, contentType)) {
        return res.status(400).json({ errors: ["That file isn't a valid image."] });
      }
      await storage.saveObject(key, req.body);
      res.status(204).end();
    },
  );

  uploads.get('/:prefix/:file', (req, res) => {
    const key = keyFrom(req);
    if (!isUploadKey(key)) return res.status(404).end();
    res.sendFile(storage.objectPath(key), { maxAge: '7d', immutable: true, headers: { 'X-Content-Type-Options': 'nosniff' } }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });
}
