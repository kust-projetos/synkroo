/**
 * Unit tests for idempotency helper (ADR-BASE-13)
 *
 * Tests the public API contract, not DB integration.
 * DB-dependent functions tested in integration suite.
 */

// Mock before imports
const mockReturning = jest.fn().mockResolvedValue([]);
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([]),
  insert: jest.fn().mockReturnThis(),
  values: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  onConflictDoNothing: jest.fn().mockReturnThis(),
  returning: mockReturning,
};
jest.mock('@/lib/db/client', () => ({ getDb: () => mockDb }));

jest.mock('@/lib/logger', () => ({
  dbLogger: { warn: jest.fn(), error: jest.fn() },
}));

import { isIdempotencyKeyProcessed, tryClaimIdempotencyKey } from '@/lib/idempotency/index';

describe('Idempotency Helper (ADR-BASE-13)', () => {
  it('isIdempotencyKeyProcessed returns false for unknown key', async () => {
    const result = await isIdempotencyKeyProcessed('key-unknown');
    expect(result).toBe(false);
  });

  it('allows only the insert winner to claim a key', async () => {
    mockReturning.mockResolvedValueOnce([{ key: 'same' }]).mockResolvedValueOnce([]);

    await expect(tryClaimIdempotencyKey('same', 'charge')).resolves.toBe(true);
    await expect(tryClaimIdempotencyKey('same', 'charge')).resolves.toBe(false);
  });

  it('reclaims an expired claim with a conditional update', async () => {
    mockReturning.mockResolvedValueOnce([]).mockResolvedValueOnce([{ key: 'expired' }]);

    await expect(tryClaimIdempotencyKey('expired', 'charge', 60)).resolves.toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('does not reclaim a live claim when the insert conflicts', async () => {
    mockReturning.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(tryClaimIdempotencyKey('live', 'charge', 60)).resolves.toBe(false);
  });

  it('exports expected public functions', () => {
    const mod = require('@/lib/idempotency/index');
    expect(typeof mod.isIdempotencyKeyProcessed).toBe('function');
    expect(typeof mod.tryClaimIdempotencyKey).toBe('function');
    expect(typeof mod.markIdempotencyKeyCompleted).toBe('function');
    expect(typeof mod.markIdempotencyKeyFailed).toBe('function');
    expect(typeof mod.withIdempotency).toBe('function');
  });

  it('withIdempotency type signature is correct', () => {
    const mod = require('@/lib/idempotency/index');
    // Validates function exists and accepts correct arity
    // (4th optional `fingerprint` param is backward-compatible: length >= 3)
    expect(mod.withIdempotency).toBeDefined();
    expect(mod.withIdempotency.length).toBeGreaterThanOrEqual(3); // key, jobType, handler (+ fingerprint?)
  });
});
