import { scryptSync, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, needsRehash } from '../password';

/** Real legacy fixture in the exact old "salt:hash" shape. */
function legacyFixture(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Tamper the first nibble of a hex string, deterministically.
 *
 * Overwriting a fixed prefix (e.g. "00") is a no-op whenever the random salt or
 * hash already starts with it (~1/256), which made the tamper tests flaky.
 * Mapping "0"→"1" and anything else→"0" always yields a different, still valid,
 * same-length hex string.
 */
function tamperFirstHexChar(hex: string): string {
  return `${hex[0] === '0' ? '1' : '0'}${hex.slice(1)}`;
}

describe('password hash/verify', () => {
  it('hashPassword returns versioned scrypt$v1 format with embedded params', async () => {
    const stored = await hashPassword('s3cr3t!');
    expect(stored).toMatch(/^scrypt\$v1\$16384\$8\$1\$[0-9a-f]+\$[0-9a-f]+$/);
    const [, , n, r, p, salt, hash] = stored.split('$');
    expect([n, r, p]).toEqual(['16384', '8', '1']);
    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(128);
    expect(stored).toHaveLength(181);
  });

  it('hashPassword produces different salts each call', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(a.split('$')[5]).not.toBe(b.split('$')[5]);
  });

  it('verifyPassword roundtrips the v1 format', async () => {
    const password = 'correct-horse';
    const stored = await hashPassword(password);
    await expect(verifyPassword(password, stored)).resolves.toBe(true);
  });

  it('verifyPassword accepts a real legacy salt:hash fixture', async () => {
    const stored = legacyFixture('legacy-secret');
    await expect(verifyPassword('legacy-secret', stored)).resolves.toBe(true);
  });

  it('verifyPassword returns false for wrong password in both formats', async () => {
    await expect(verifyPassword('wrong', await hashPassword('right'))).resolves.toBe(false);
    await expect(verifyPassword('wrong', legacyFixture('right'))).resolves.toBe(false);
  });

  it('verifyPassword returns false without throwing on malformed input', async () => {
    const malformed = [
      '',
      'no-separator-here',
      'nothex:nothex',
      '00:zz',
      'scrypt$v1$bad',
      'scrypt$v1$16384$8$1$only-salt',
      'scrypt$v1$16384$8$1$zzzz$abcd',
      'scrypt$v1$notanumber$8$1$abcdef$abcdef',
      'scrypt$v2$16384$8$1$abcdef$abcdef',
      'bcrypt$v1$16384$8$1$abcdef$abcdef',
    ];
    for (const stored of malformed) {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false);
    }
  });

  it('verifyPassword returns false on tampered v1 hash of valid shape', async () => {
    const stored = await hashPassword('original');
    const parts = stored.split('$');
    const originalHash = parts[6];
    const tamperedHash = tamperFirstHexChar(originalHash);
    parts[6] = tamperedHash;
    expect(tamperedHash).not.toBe(originalHash);
    await expect(verifyPassword('original', parts.join('$'))).resolves.toBe(false);
  });

  it('verifyPassword returns false on tampered legacy salt of valid shape', async () => {
    const stored = legacyFixture('original');
    const [salt, hash] = stored.split(':');
    const tamperedSalt = tamperFirstHexChar(salt);
    expect(tamperedSalt).not.toBe(salt);
    await expect(verifyPassword('original', `${tamperedSalt}:${hash}`)).resolves.toBe(false);
  });

  it('needsRehash flags legacy but not v1', async () => {
    expect(needsRehash(legacyFixture('x'))).toBe(true);
    expect(needsRehash(await hashPassword('x'))).toBe(false);
  });

  it('verifyPassword respects cost params embedded in the hash', async () => {
    const password = 'params-matter';
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, Buffer.from(salt, 'hex'), 64, {
      N: 1024,
      r: 8,
      p: 1,
    }).toString('hex');
    const stored = `scrypt$v1$1024$8$1$${salt}$${derived}`;
    await expect(verifyPassword(password, stored)).resolves.toBe(true);
    const tamperedParams = `scrypt$v1$16384$8$1$${salt}$${derived}`;
    await expect(verifyPassword(password, tamperedParams)).resolves.toBe(false);
  });

  it('verifyPassword rejects v1 params outside the cost policy without deriving', async () => {
    const salt = randomBytes(16).toString('hex');
    const hash = randomBytes(64).toString('hex');
    const outsidePolicy = [
      `scrypt$v1$10000$8$1$${salt}$${hash}`,
      `scrypt$v1$1073741824$8$1$${salt}$${hash}`,
      `scrypt$v1$512$8$1$${salt}$${hash}`,
      `scrypt$v1$16384$65$1$${salt}$${hash}`,
      `scrypt$v1$16384$8$9$${salt}$${hash}`,
      `scrypt$v1$16384$8$0$${salt}$${hash}`,
      `scrypt$v1$016384$8$1$${salt}$${hash}`,
      `scrypt$v1$+16384$8$1$${salt}$${hash}`,
    ];
    for (const stored of outsidePolicy) {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false);
    }
  });

  it('verifyPassword accepts a hash at the upper policy edge (N=2^16, r=8, p=1)', async () => {
    const password = 'upper-edge';
    const salt = randomBytes(16).toString('hex');
    const derived = scryptSync(password, Buffer.from(salt, 'hex'), 64, {
      N: 65536,
      r: 8,
      p: 1,
      maxmem: 128 * 65536 * 8 * 2,
    }).toString('hex');
    const stored = `scrypt$v1$65536$8$1$${salt}$${derived}`;
    await expect(verifyPassword(password, stored)).resolves.toBe(true);
    await expect(verifyPassword('wrong', stored)).resolves.toBe(false);
  });

  it('verifyPassword rejects v1 hashes breaching the 128*N*r memory bound', async () => {
    const salt = randomBytes(16).toString('hex');
    const hash = randomBytes(64).toString('hex');
    await expect(
      verifyPassword('anything', `scrypt$v1$1048576$8$1$${salt}$${hash}`),
    ).resolves.toBe(false);
  });

  it('verifyPassword rejects non-canonical v1 salt/hash encoding', async () => {
    const salt = randomBytes(16).toString('hex');
    const hash = randomBytes(64).toString('hex');
    const nonCanonical = [
      `scrypt$v1$16384$8$1$${salt.slice(1)}$${hash}`,
      `scrypt$v1$16384$8$1$${salt}$${hash.slice(2)}`,
      `scrypt$v1$16384$8$1$${salt}00$${hash}`,
      `scrypt$v1$16384$8$1$${salt}$${hash}00`,
      `scrypt$v1$16384$8$1$${salt.toUpperCase()}$${hash}`,
      `scrypt$v1$16384$8$1$${salt}$${hash.toUpperCase()}`,
    ];
    for (const stored of nonCanonical) {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false);
    }
  });
});
