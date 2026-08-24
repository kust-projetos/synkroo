import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SEPARATOR = ':';

/**
 * Hash a plaintext password using scrypt with a random salt.
 * Returns a portable string in format "salt:hash" (hex encoded).
 */
export function hashPassword(password: string): string {
  const salt = Buffer.from(randomBytes(SALT_LENGTH)).toString('hex');
  const hash = Buffer.from(scryptSync(password, salt, KEY_LENGTH)).toString('hex');
  return `${salt}${SEPARATOR}${hash}`;
}

/**
 * Verify a plaintext password against a stored "salt:hash" string.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const sepIdx = stored.indexOf(SEPARATOR);
  if (sepIdx === -1) return false;

  const salt = stored.slice(0, sepIdx);
  const key = stored.slice(sepIdx + 1);
  const hash = Buffer.from(scryptSync(password, salt, KEY_LENGTH)).toString('hex');

  // Constant-time comparison prevents timing attacks
  return timingSafeEqual(Buffer.from(hash), Buffer.from(key));
}
