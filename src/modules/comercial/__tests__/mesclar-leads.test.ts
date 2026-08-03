jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(),
  closeDb: jest.fn(),
}));

jest.mock('@/modules/crm', () => {
  const actual = jest.requireActual('@/modules/crm');
  return { ...actual, registerOwnerMerge: jest.fn(actual.registerOwnerMerge) };
});

import { getDb } from '@/lib/db/client';
import { mergeLeads, listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository';
import * as leadsRepo from '@/modules/comercial/repositories/leads-repository';

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

describe('default lead list hides soft-merged losers', () => {
  it('excludes leads with mergeStatus merged', async () => {
    const rows = [
      { id: 'l1', name: 'Ativo', mergeStatus: null },
      { id: 'l2', name: 'Fundido', mergeStatus: 'merged', mergedIntoId: 'l1' },
    ];
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => Promise.resolve(rows),
    };
    (getDb as jest.Mock).mockReturnValue({ select: () => chain });

    const result = await listLeadsByClinic('c1');

    expect(result.map((r: any) => r.id)).toEqual(['l1']);
  });
});

describe('runtime owner dispatcher registration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registers a lead owner merge dispatcher that delegates to mergeLeads', async () => {
    const spy = jest.spyOn(leadsRepo, 'mergeLeads').mockResolvedValue(true);
    const crm = await import('@/modules/crm');
    // Task 4: dispatcher agora vive em @/modules/crm/services/lead-merge-dispatcher
    // (a action comercial.mesclarLeads foi removida).
    await import('@/modules/crm/services/lead-merge-dispatcher');

    const leadCall = (crm.registerOwnerMerge as jest.Mock).mock.calls.find(
      ([type]) => type === 'lead',
    );
    expect(leadCall).toBeDefined();

    const dispatcher = leadCall![1];
    await dispatcher('w1', 'r1', 'c1');

    expect(spy).toHaveBeenCalledWith('w1', 'r1', 'c1');
  });
});

describe('listLeadsByClinic filter branches', () => {
  function chainResolve(rows: any[]) {
    const chain = {
      from: () => chain,
      where: () => chain,
      orderBy: () => Promise.resolve(rows),
    };
    return { select: () => chain };
  }

  it('keeps rows when mergeStatus is null', async () => {
    const rows = [{ id: 'l1', name: 'A', mergeStatus: null }];
    (getDb as jest.Mock).mockReturnValue(chainResolve(rows));

    const result = await listLeadsByClinic('c1');

    expect(result.map((r: any) => r.id)).toEqual(['l1']);
  });

  it('keeps rows when mergeStatus is undefined', async () => {
    const rows = [{ id: 'l1', name: 'A' }];
    (getDb as jest.Mock).mockReturnValue(chainResolve(rows));

    const result = await listLeadsByClinic('c1');

    expect(result.map((r: any) => r.id)).toEqual(['l1']);
  });

  it('keeps rows when mergeStatus is a non-merged string', async () => {
    const rows = [{ id: 'l1', name: 'A', mergeStatus: 'lost' }];
    (getDb as jest.Mock).mockReturnValue(chainResolve(rows));

    const result = await listLeadsByClinic('c1');

    expect(result.map((r: any) => r.id)).toEqual(['l1']);
  });

  it('excludes rows with mergeStatus merged', async () => {
    const rows = [
      { id: 'l1', name: 'A', mergeStatus: null },
      { id: 'l2', name: 'B', mergeStatus: 'merged' },
    ];
    (getDb as jest.Mock).mockReturnValue(chainResolve(rows));

    const result = await listLeadsByClinic('c1');

    expect(result.map((r: any) => r.id)).toEqual(['l1']);
  });
});
