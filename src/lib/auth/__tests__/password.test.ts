import { hashPassword, verifyPassword } from '../password';

describe('password hash/verify', () => {
  it('hashPassword returns salt:hash hex format', () => {
    const stored = hashPassword('s3cr3t!');
    expect(stored).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    const [salt, hash] = stored.split(':');
    // 16 bytes => 32 hex chars, 64 bytes => 128 hex chars
    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(128);
  });

  it('hashPassword produces different salts each call', () => {
    const a = hashPassword('same');
    const b = hashPassword('same');
    expect(a).not.toBe(b);
    expect(a.split(':')[0]).not.toBe(b.split(':')[0]);
  });

  it('verifyPassword returns true for correct password', () => {
    const password = 'correct-horse';
    const stored = hashPassword(password);
    expect(verifyPassword(password, stored)).toBe(true);
  });

  it('verifyPassword returns false for wrong password (timingSafeEqual false path)', () => {
    const stored = hashPassword('right');
    expect(verifyPassword('wrong', stored)).toBe(false);
  });

  it('verifyPassword returns false when separator missing (sepIdx==-1)', () => {
    expect(verifyPassword('anything', 'no-separator-here')).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });

  it('verifyPassword handles salt mismatch gracefully', () => {
    const stored = hashPassword('original');
    const [salt, hash] = stored.split(':');
    // different salt but same hash length => should be false, not throw
    const tamperedStored = `00${salt.slice(2)}:${hash}`;
    expect(verifyPassword('original', tamperedStored)).toBe(false);
  });

  it('verifyPassword returns false when stored hash length mismatches (timingSafeEqual guard)', () => {
    const stored = hashPassword('secret');
    // truncate key to different length -> should not throw
    const truncated = stored.slice(0, -10);
    expect(verifyPassword('secret', truncated)).toBe(false);
  });
});
