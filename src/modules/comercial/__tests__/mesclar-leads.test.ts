jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
  closeDb: jest.fn(),
}));

import { getDb } from '@/lib/db/client';
import { mergeLeads } from '@/modules/comercial/repositories/leads-repository';

function makeResolvedSelect(val: any[]) {
  return jest.fn(() => ({
    from: jest.fn(() => ({
      where: jest.fn(() => ({
        limit: jest.fn(() => Promise.resolve(val)),
      })),
    })),
  }));
}

describe('Comercial — lead merge (transaction)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wraps all repoint operations in a Drizzle transaction', async () => {
    const mockTx = { update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })) })) };
    const db = {
      select: makeResolvedSelect([{ id: 'w1' }, { id: 'l1' }]),
      transaction: jest.fn(async (cb: any) => cb(mockTx)),
    };
    (getDb as jest.Mock).mockReturnValue(db);

    const result = await mergeLeads('w1', 'l1', 'c1');
    expect(result).toBe(true);
    expect(db.transaction).toHaveBeenCalled();
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('marks loser as lost merged_duplicate', async () => {
    const mockTx = { update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })) })) };
    const db = {
      select: makeResolvedSelect([{ id: 'w1' }, { id: 'l1' }]),
      transaction: jest.fn(async (cb: any) => cb(mockTx)),
    };
    (getDb as jest.Mock).mockReturnValue(db);

    await mergeLeads('w1', 'l1', 'c1');
    expect(db.transaction).toHaveBeenCalled();
  });

  it('returns false when winner not found', async () => {
    const db = {
      select: makeResolvedSelect([]),
      transaction: jest.fn(),
    };
    (getDb as jest.Mock).mockReturnValue(db);

    const result = await mergeLeads('w1', 'l1', 'c1');
    expect(result).toBe(false);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('returns false when loser is converted', async () => {
    const db = {
      select: jest.fn()
        .mockReturnValueOnce({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([{ id: 'w1' }])) })) })) })
        .mockReturnValueOnce({ from: jest.fn(() => ({ where: jest.fn(() => ({ limit: jest.fn(() => Promise.resolve([{ id: 'l1', convertedAt: new Date() }])) })) })) }),
      transaction: jest.fn(),
    };
    (getDb as jest.Mock).mockReturnValue(db);

    const result = await mergeLeads('w1', 'l1', 'c1');
    expect(result).toBe(false);
  });

  it('rolls back on mid-transaction failure', async () => {
    const db = {
      select: makeResolvedSelect([{ id: 'w1' }, { id: 'l1' }]),
      transaction: jest.fn(async (cb: any) => {
        const failingTx = {
          update: jest.fn(() => ({
            set: jest.fn(() => ({
              where: jest.fn(() => Promise.reject(new Error('fail'))),
            })),
          })),
        };
        await expect(cb(failingTx)).rejects.toThrow('fail');
        throw new Error('rollback');
      }),
    };
    (getDb as jest.Mock).mockReturnValue(db);

    await expect(mergeLeads('w1', 'l1', 'c1')).rejects.toThrow();
  });
});
