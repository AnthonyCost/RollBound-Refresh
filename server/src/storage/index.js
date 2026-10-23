// Picks the storage driver from STORAGE_DRIVER: "local" (default) saves under
// server/uploads/; "s3" uses AWS S3. Both expose the same functions:
//   createUpload({ userId, contentType, size }) -> { key, uploadUrl, method, headers, expiresAt }
//   verifyImage(key)   -> true if the object exists and is a real image
//   markInUse(key)     -> protect an upload from automatic cleanup once it's used
//   deleteObject(key)
//   publicUrl(key)     -> URL browsers load the image from
export * from './shared.js';

const DRIVER = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
if (!['local', 's3'].includes(DRIVER)) throw new Error(`Unknown STORAGE_DRIVER "${DRIVER}". Use "local" or "s3".`);

export const storage = DRIVER === 's3' ? await import('./s3.js') : await import('./local.js');
