import express, { Router } from 'express';
import { requireUser } from '../auth.js';
import { COVER_KEY, IMAGE_TYPES, MAX_IMAGE_BYTES, looksLikeImage, storage } from '../storage/index.js';

export const uploads = Router();

// Step 1: ask for a presigned upload URL. With S3 it points at the bucket.
uploads.post('/', requireUser, async (req, res) => {
  const { contentType, size } = req.body ?? {};
  if (!IMAGE_TYPES[contentType]) return res.status(400).json({ errors: ['Covers must be JPEG, PNG, or WebP images.'] });
  if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
    return res.status(400).json({ errors: ['Covers must be 5 MB or smaller.'] });
  }
  res.status(201).json(await storage.createUpload({ userId: req.user.id, contentType, size }));
});

// Step 2 (local driver only): the browser PUTs the file here, and covers are
// served from here. With S3, the bucket and CloudFront do both.
if (storage.name === 'local') {
  uploads.put(
    '/covers/:file',
    express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_IMAGE_BYTES }),
    async (req, res) => {
      const key = `covers/${req.params.file}`;
      const contentType = req.get('Content-Type');
      if (!COVER_KEY.test(key) || !storage.verifyUpload(key, contentType, req.query)) {
        return res.status(403).json({ errors: ['This upload link is invalid or has expired.'] });
      }
      if (!Buffer.isBuffer(req.body) || !looksLikeImage(req.body, contentType)) {
        return res.status(400).json({ errors: ["That file isn't a valid image."] });
      }
      await storage.saveObject(key, req.body);
      res.status(204).end();
    },
  );

  uploads.get('/covers/:file', (req, res) => {
    const key = `covers/${req.params.file}`;
    if (!COVER_KEY.test(key)) return res.status(404).end();
    res.sendFile(storage.objectPath(key), { maxAge: '7d', immutable: true, headers: { 'X-Content-Type-Options': 'nosniff' } }, (err) => {
      if (err && !res.headersSent) res.status(404).end();
    });
  });
}
