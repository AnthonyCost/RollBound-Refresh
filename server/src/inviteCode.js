import { randomInt } from 'node:crypto';

// No 0/O or 1/I/L, so a code read aloud or copied by hand can't be misread.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

/** A random code like "7KQM-X4HP" (31^8 ≈ 850 billion possibilities). */
export function generateInviteCode() {
  let code = '';
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** Accepts any case, with or without the dash or spaces. Returns null if it can't be a code. */
export function normalizeInviteCode(input) {
  const raw = String(input ?? '').toUpperCase().replace(/[\s-]/g, '');
  if (raw.length !== LENGTH || [...raw].some((c) => !ALPHABET.includes(c))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
