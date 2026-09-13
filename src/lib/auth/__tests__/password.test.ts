import { scryptSync, randomBytes } from 'node:crypto';
import { hashPassword, verifyPassword, needsRehash } from '../password';

/** Real legacy fixture in the exact old "salt:hash" shape. */
function legacyFixture(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
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
    parts[6] = `00${parts[6].slice(2)}`;
    await expect(verifyPassword('original', parts.join('$'))).resolves.toBe(false);
  });

  it('verifyPassword returns false on tampered legacy salt of valid shape', async () => {
    const stored = legacyFixture('original');
    const [salt, hash] = stored.split(':');
    await expect(verifyPassword('original', `00${salt.slice(2)}:${hash}`)).resolves.toBe(false);
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
});
