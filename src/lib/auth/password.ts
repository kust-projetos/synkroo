import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const HASH_PREFIX = 'scrypt';
const HASH_VERSION = 'v1';
const LEGACY_SEPARATOR = ':';

interface VersionedHash {
  n: number;
  r: number;
  p: number;
  saltHex: string;
  hashHex: string;
}

/** Promise wrapper around callback-style scrypt. */
function scryptAsync(
  password: string,
  salt: string | Buffer,
  keylen: number,
  options?: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options ?? {}, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}

/** Non-empty hex check used to reject malformed stored hashes. */
function isHex(value: string): boolean {
  return value.length > 0 && /^[0-9a-fA-F]+$/.test(value);
}

/** Parse "scrypt$v1$N$r$p$salt-hex$hash-hex"; null when not versioned. */
function parseVersioned(stored: string): VersionedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 7) return null;
  const [prefix, version, nRaw, rRaw, pRaw, saltHex, hashHex] = parts;
  if (prefix !== HASH_PREFIX || version !== HASH_VERSION) return null;
  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
  if (n <= 0 || r <= 0 || p <= 0) return null;
  if (!isHex(saltHex) || !isHex(hashHex)) return null;
  return { n, r, p, saltHex, hashHex };
}

/** Legacy shape check: 16-byte salt and 64-byte hash, both hex. */
function isLegacyFormat(stored: string): boolean {
  const sepIdx = stored.indexOf(LEGACY_SEPARATOR);
  if (sepIdx === -1) return false;
  const salt = stored.slice(0, sepIdx);
  const key = stored.slice(sepIdx + 1);
  return (
    salt.length === SALT_LENGTH * 2 && key.length === KEY_LENGTH * 2 && isHex(salt) && isHex(key)
  );
}

/** Constant-time comparison of two hex strings; false on length mismatch. */
function safeEqualHex(aHex: string, bHex: string): boolean {
  const aBuf = Buffer.from(aHex);
  const bBuf = Buffer.from(bHex);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Hash a plaintext password with async scrypt and a random salt.
 * Returns a versioned string "scrypt$v1$N$r$p$salt-hex$hash-hex".
 */
export async function hashPassword(password: string): Promise<string> {
  const saltHex = randomBytes(SALT_LENGTH).toString('hex');
  const derived = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `${HASH_PREFIX}$${HASH_VERSION}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${saltHex}$${derived.toString('hex')}`;
}

/**
 * Verify a plaintext password against a legacy "salt:hash" or versioned
 * "scrypt$v1$..." stored string. Cost params always come from the stored
 * hash itself. Unknown or malformed formats return false without throwing.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const versioned = parseVersioned(stored);
    if (versioned) {
      const derived = await scryptAsync(password, Buffer.from(versioned.saltHex, 'hex'), KEY_LENGTH, {
        N: versioned.n,
        r: versioned.r,
        p: versioned.p,
      });
      return safeEqualHex(derived.toString('hex'), versioned.hashHex);
    }
    if (isLegacyFormat(stored)) {
      const sepIdx = stored.indexOf(LEGACY_SEPARATOR);
      const salt = stored.slice(0, sepIdx);
      const key = stored.slice(sepIdx + 1);
      const derived = await scryptAsync(password, salt, KEY_LENGTH);
      return safeEqualHex(derived.toString('hex'), key);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * True when the stored hash is not in the current versioned format
 * (legacy "salt:hash" or unknown), signalling a transparent re-hash.
 */
export function needsRehash(stored: string): boolean {
  return parseVersioned(stored) === null;
}
