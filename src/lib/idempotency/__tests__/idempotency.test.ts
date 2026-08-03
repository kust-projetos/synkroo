/**
 * Unit tests for idempotency helper (ADR-BASE-13)
 *
 * Tests the public API contract, not DB integration.
 * DB-dependent functions tested in integration suite.
 */

// Mock before imports
jest.mock('@/lib/db/client', () => ({
  getDb: () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: { warn: jest.fn(), error: jest.fn() },
}));

import { isIdempotencyKeyProcessed } from '@/lib/idempotency/index';

describe('Idempotency Helper (ADR-BASE-13)', () => {
  it('isIdempotencyKeyProcessed returns false for unknown key', async () => {
    const result = await isIdempotencyKeyProcessed('key-unknown');
    expect(result).toBe(false);
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
    expect(mod.withIdempotency).toBeDefined();
    expect(mod.withIdempotency.length).toBe(3); // key, jobType, handler
  });
});
