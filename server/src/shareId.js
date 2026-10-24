import { randomBytes } from 'node:crypto';

/**
 * A character's share link id: 16 URL-safe characters (96 random bits), so a
 * sheet can only be found by someone who was given its link.
 */
export const generateShareId = () => randomBytes(12).toString('base64url');

export const isShareId = (s) => /^[A-Za-z0-9_-]{16}$/.test(s);
