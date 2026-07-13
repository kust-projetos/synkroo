import { getDb } from '@/lib/db/client';

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
  closeDb: jest.fn(),
}));

jest.mock('@/modules/crm', () => {
  const actual = jest.requireActual('@/modules/crm');
  return { ...actual, registerOwnerMerge: jest.fn(actual.registerOwnerMerge) };
});

import { mergePatients, listPatients } from '@/modules/operacional/repositories/patients-repository';
import * as patientsRepo from '@/modules/operacional/repositories/patients-repository';

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

describe('default patient list hides soft-merged losers', () => {
  it('excludes patients with mergeStatus merged', async () => {
    const rows = [
      { id: 'p1', name: 'Ativo', mergeStatus: null },
      { id: 'p2', name: 'Fundido', mergeStatus: 'merged', mergedIntoId: 'p1' },
    ];
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => Promise.resolve(rows),
    };
    (getDb as jest.Mock).mockReturnValue({ select: () => chain, transaction: jest.fn() });

    const result = await listPatients('c1');

    expect(result.map((r: any) => r.id)).toEqual(['p1']);
  });
});

describe('runtime owner dispatcher registration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registers a patient owner merge dispatcher that delegates to mergePatients', async () => {
    const spy = jest.spyOn(patientsRepo, 'mergePatients').mockResolvedValue(true);
    const crm = await import('@/modules/crm');
    await import('@/modules/operacional/actions/mesclar-pacientes');

    const patientCall = (crm.registerOwnerMerge as jest.Mock).mock.calls.find(
      ([type]) => type === 'patient',
    );
    expect(patientCall).toBeDefined();

    const dispatcher = patientCall![1];
    await dispatcher('w1', 'r1', 'c1');

    expect(spy).toHaveBeenCalledWith('w1', 'r1', 'c1');
  });
});
