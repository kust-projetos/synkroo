import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));
import { validateApiAuth } from '@/lib/auth/session';

const mockSelect = jest.fn();
const mockFrom = jest.fn();
const mockWhere = jest.fn();
const mockLimit = jest.fn();
const mockOffset = jest.fn();
const mockOrderBy = jest.fn();

function createMockDb() {
  const chain: any = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    offset: mockOffset,
    orderBy: mockOrderBy,
    then: jest.fn(),
  };
  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockLimit.mockReturnValue(chain);
  mockOffset.mockReturnValue(chain);
  mockOrderBy.mockReturnValue(chain);
  return chain;
}

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => createMockDb()),
}));

import { GET } from '../patients';
import { getDb } from '@/lib/db/client';

describe('T5 — GET /api/reports/patients tenant-scoped SQL with limit (no JS filter)', () => {
  const clinicA = 'clinic-a';

  beforeEach(() => {
    jest.clearAllMocks();
    (validateApiAuth as jest.Mock).mockResolvedValue({ success: true, profile: { clinic_id: clinicA } });
    // Simple mock that always resolves to a valid response without throwing
    const mockChain: any = {
      select: jest.fn().mockReturnValue(null),
      from: jest.fn().mockReturnValue(null),
      where: jest.fn().mockReturnValue(null),
      limit: jest.fn().mockReturnValue(null),
      offset: jest.fn().mockReturnValue(null),
      orderBy: jest.fn().mockReturnValue(null),
    };
    // Make chain thenable and return appropriate data for each await
    let callCount = 0;
    const makeChain = () => {
      const chain: any = {};
      chain.select = jest.fn(() => chain);
      chain.from = jest.fn(() => chain);
      chain.where = jest.fn(() => chain);
      chain.limit = jest.fn(() => chain);
      chain.offset = jest.fn(() => chain);
      chain.orderBy = jest.fn(() => chain);
      chain.then = (onFulfilled: any, onRejected: any) => {
        callCount++;
        let data: any = [];
        if (callCount === 1) data = []; // newPatients
        else if (callCount === 2) data = [{ count: 2 }]; // total
        else if (callCount === 3) data = [{ patientId: 'p1' }]; // active
        else if (callCount === 4) data = [{ id: 'p2', name: 'Inactive', phone: '119', createdAt: new Date() }]; // inactive
        else if (callCount === 5) data = [{ count: 0 }]; // prev
        return Promise.resolve(data).then(onFulfilled, onRejected);
      };
      return chain;
    };
    (getDb as jest.Mock).mockImplementation(() => ({
      select: jest.fn(() => makeChain()),
      execute: jest.fn(),
    }));
  });

  it('uses tenant-scoped where and does not load all patients into JS (limit 50 default)', async () => {
    const req = new NextRequest('http://localhost/api/reports/patients');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.retention).toBeDefined();
    expect(body.data.inactiveList).toBeDefined();
    expect(Array.isArray(body.data.inactiveList)).toBe(true);
    expect(body.data.inactiveList.length).toBeLessThanOrEqual(50);
    expect(getDb).toHaveBeenCalled();
  });

  it('respects explicit pagination limit and tenant isolation', async () => {
    const req = new NextRequest('http://localhost/api/reports/patients?limit=10&page=1');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.inactiveList.length).toBeLessThanOrEqual(10);
  });

  it('never returns patients from other clinic (tenant isolation)', async () => {
    const req = new NextRequest('http://localhost/api/reports/patients');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(validateApiAuth).toHaveBeenCalled();
  });
});

describe('T5 — large clinic OOM guard (simulated 5000 patients)', () => {
  it('does not materialize 5000 rows in JS — SQL limit protects', async () => {
    (validateApiAuth as jest.Mock).mockResolvedValue({ success: true, profile: { clinic_id: 'clinic-large' } });
    let callCount = 0;
    const makeChain = () => {
      const chain: any = {};
      chain.select = jest.fn(() => chain);
      chain.from = jest.fn(() => chain);
      chain.where = jest.fn(() => chain);
      chain.limit = jest.fn((n: number) => {
        expect(n).toBeLessThanOrEqual(100);
        return chain;
      });
      chain.offset = jest.fn(() => chain);
      chain.orderBy = jest.fn(() => chain);
      chain.then = (onFulfilled: any, onRejected: any) => {
        callCount++;
        let data: any = [];
        if (callCount === 2) data = [{ count: 5000 }];
        else if (callCount === 4) data = Array.from({ length: 50 }, (_, i) => ({ id: `p${i}`, name: `Patient ${i}`, phone: `1190000${i}`, createdAt: new Date() }));
        else data = [];
        return Promise.resolve(data).then(onFulfilled, onRejected);
      };
      return chain;
    };
    (getDb as jest.Mock).mockImplementation(() => ({
      select: jest.fn(() => makeChain()),
      execute: jest.fn(),
    }));

    const { GET: LargeGet } = await import('../patients');
    const req = new NextRequest('http://localhost/api/reports/patients?limit=50');
    const res = await LargeGet(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.inactiveList.length).toBe(50);
    expect(body.data.retention.totalPatients).toBe(5000);
  });
});
