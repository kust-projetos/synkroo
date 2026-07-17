/**
 * Tests: Financeiro crypto helpers (AES-256-GCM).
 */

import { encrypt, decrypt } from '../crypto';

// ENCRYPTION_KEY must be set in jest.setup.ts

describe('encrypt / decrypt', () => {
  test('round-trips a plaintext string', () => {
    const original = 'asaas_api_key_test_12345';
    const encrypted = encrypt(original);
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.data).toBeTruthy();
    expect(encrypted.tag).toBeTruthy();
    expect(encrypted.data).not.toBe(original);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  test('produces different ciphertext each time (IV-based)', () => {
    const plaintext = 'same-value';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
  });

  test('throws on tampered payload', () => {
    const original = 'my-secret-key';
    const encrypted = encrypt(original);
    // Tamper with the ciphertext
    const tampered = { ...encrypted, data: 'deadbeef' };
    expect(() => decrypt(tampered)).toThrow();
  });

  test('throws without ENCRYPTION_KEY', () => {
    const key = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow(/ENCRYPTION_KEY/);
    process.env.ENCRYPTION_KEY = key;
  });
});
