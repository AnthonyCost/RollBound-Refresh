// Picks the storage driver from STORAGE_DRIVER: "local" (default) saves under
// server/uploads/; "s3" uses AWS S3. Both expose the same functions:
//   createUpload({ kind, userId, contentType, size }) -> { key, uploadUrl, method, headers, expiresAt }
//   verifyImage(key)   -> true if the object exists and is a real image
//   markInUse(key)     -> protect an upload from automatic cleanup once it's used
//   deleteObject(key)
//   publicUrl(key)     -> URL browsers load the image from
export * from './shared.js';

const DRIVER = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
if (!['local', 's3'].includes(DRIVER)) throw new Error(`Unknown STORAGE_DRIVER "${DRIVER}". Use "local" or "s3".`);

const driver = DRIVER === 's3' ? await import('./s3.js') : await import('./local.js');

// Stock images ship with the client (client/public/stock/) and are shared, like the demo
// characters' portraits. Their keys start stock/, and they're never in storage to delete.
const isStock = (key) => key?.startsWith('stock/');

export const storage = {
  ...driver,
  publicUrl: (key) => (isStock(key) ? `/${key}` : driver.publicUrl(key)),
  deleteObject: async (key) => {
    if (!isStock(key)) await driver.deleteObject(key);
  },
};
