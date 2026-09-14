/**
 * Unit tests — claimIdempotencyKey / IdempotencyInfraError (review A2A3).
 *
 * Camada DB (`getDb`) mockada com filas de linhas; prova os 4 outcomes,
 * o reclaim de `completed` expirado via `completedTtlMs` e a distinção
 * infra vs. conflito. As funções legadas seguem cobertas em idempotency.test.ts.
 */

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }));

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { getDb } from '@/lib/db/client';
import { claimIdempotencyKey, IdempotencyInfraError } from '@/lib/idempotency/index';

const mockGetDb = getDb as jest.Mock;

const selectQueue: unknown[][] = [];
let insertRows: unknown[] = [];
let updateRows: unknown[] = [];

const mockDb = {
  select: jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve(selectQueue.shift() ?? [])),
      })),
    })),
  })),
  insert: jest.fn(() => ({
    values: jest.fn(() => ({
      onConflictDoNothing: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve(insertRows)),
      })),
    })),
  })),
  update: jest.fn(() => ({
    set: jest.fn(() => ({
      where: jest.fn(() => ({
        returning: jest.fn(() => Promise.resolve(updateRows)),
      })),
    })),
  })),
};

const past = new Date(Date.now() - 60_000);
const future = new Date(Date.now() + 60_000);

describe('claimIdempotencyKey (review)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    selectQueue.length = 0;
    insertRows = [];
    updateRows = [];
    mockGetDb.mockReturnValue(mockDb);
  });

  it('sem linha + insert vencedor → claimed', async () => {
    selectQueue.push([]);
    insertRows = [{ key: 'k' }];

    await expect(claimIdempotencyKey('k', 'job')).resolves.toBe('claimed');
  });

  it('completed sem TTL → completed (sem reclaim)', async () => {
    selectQueue.push([{ status: 'completed', expiresAt: past }]);

    await expect(claimIdempotencyKey('k', 'job')).resolves.toBe('completed');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('completed expirado COM completedTtlMs → reclaim vencedor → claimed', async () => {
    selectQueue.push([{ status: 'completed', expiresAt: past }]);
    updateRows = [{ key: 'k' }];

    await expect(
      claimIdempotencyKey('k', 'job', { completedTtlMs: 600_000 }),
    ).resolves.toBe('claimed');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('completed NÃO expirado COM completedTtlMs → completed', async () => {
    selectQueue.push([{ status: 'completed', expiresAt: future }]);

    await expect(
      claimIdempotencyKey('k', 'job', { completedTtlMs: 600_000 }),
    ).resolves.toBe('completed');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('in_progress vivo → in_progress', async () => {
    selectQueue.push([{ status: 'in_progress', expiresAt: future }]);

    await expect(claimIdempotencyKey('k', 'job')).resolves.toBe('in_progress');
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('failed vivo → retry_after', async () => {
    selectQueue.push([{ status: 'failed', expiresAt: future }]);

    await expect(claimIdempotencyKey('k', 'job')).resolves.toBe('retry_after');
  });

  it('failed expirado → reclaim vencedor → claimed', async () => {
    selectQueue.push([{ status: 'failed', expiresAt: past }]);
    updateRows = [{ key: 'k' }];

    await expect(claimIdempotencyKey('k', 'job')).resolves.toBe('claimed');
  });

  it('derrota no reclaim de completed (0 linhas) + linha em in_progress → in_progress', async () => {
    selectQueue.push(
      [{ status: 'completed', expiresAt: past }],
      [{ status: 'in_progress', expiresAt: future }],
    );
    updateRows = [];

    await expect(
      claimIdempotencyKey('k', 'job', { completedTtlMs: 600_000 }),
    ).resolves.toBe('in_progress');
  });

  it('derrota no reclaim + releitura confirmed completed vivo → completed', async () => {
    selectQueue.push(
      [{ status: 'completed', expiresAt: past }],
      [{ status: 'completed', expiresAt: future }],
    );
    updateRows = [];

    await expect(
      claimIdempotencyKey('k', 'job', { completedTtlMs: 600_000 }),
    ).resolves.toBe('completed');
  });

  it('corrida no insert (conflito) → relê e classifica completed', async () => {
    selectQueue.push([], [{ status: 'completed', expiresAt: future }]);
    insertRows = [];

    await expect(claimIdempotencyKey('k', 'job')).resolves.toBe('completed');
  });

  it('DB indisponível → IdempotencyInfraError (nunca falso-conflito)', async () => {
    mockGetDb.mockImplementationOnce(() => {
      throw new Error('connection refused');
    });

    await expect(claimIdempotencyKey('k', 'job')).rejects.toBeInstanceOf(IdempotencyInfraError);
  });
});
