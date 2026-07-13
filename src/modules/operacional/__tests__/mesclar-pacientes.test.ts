import { getDb } from '@/lib/db/client';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
  closeDb: jest.fn(),
}));

import { mergePatients } from '@/modules/operacional/repositories/patients-repository';

describe('Operacional — patient merge (transaction)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('wraps all repoint operations in a Drizzle transaction', async () => {
    const mockTransaction = jest.fn();
    const mockTx = { update: jest.fn(() => ({ set: jest.fn(() => ({ where: jest.fn(() => Promise.resolve()) })) })) };

    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([{ id: 'w1' }, { id: 'l1' }])),
          })),
        })),
      })),
      transaction: mockTransaction,
    };
    (getDb as jest.Mock).mockReturnValue(mockDb);

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      await cb(mockTx);
    });

    const result = await mergePatients('w1', 'l1', 'c1');

    expect(result).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockTx.update).toHaveBeenCalled();
  });

  it('returns false when winner not found (no transaction started)', async () => {
    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([])),
          })),
        })),
      })),
      transaction: jest.fn(),
    };
    (getDb as jest.Mock).mockReturnValue(mockDb);

    const result = await mergePatients('w1', 'l1', 'c1');
    expect(result).toBe(false);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });

  it('rolls back all writes when transaction callback throws', async () => {
    const mockTransaction = jest.fn();

    const mockDb = {
      select: jest.fn(() => ({
        from: jest.fn(() => ({
          where: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve([{ id: 'w1' }, { id: 'l1' }])),
          })),
        })),
      })),
      transaction: mockTransaction,
    };
    (getDb as jest.Mock).mockReturnValue(mockDb);

    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<any>) => {
      const fakeTx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => Promise.reject(new Error('simulated mid-transaction failure'))),
          })),
        })),
      };
      await expect(cb(fakeTx)).rejects.toThrow('simulated mid-transaction failure');
      throw new Error('simulated mid-transaction failure');
    });

    await expect(mergePatients('w1', 'l1', 'c1')).rejects.toThrow();
    expect(mockTransaction).toHaveBeenCalled();
  });
});
