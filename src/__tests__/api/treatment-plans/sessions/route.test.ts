jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));
const mdb = {
  select: jest.fn(function (this: any) { return this; }),
  from: jest.fn(function (this: any) { return this; }),
  where: jest.fn(function (this: any) { return this; }),
  then: jest.fn(),
} as any;
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mdb) }));
jest.mock('@/services/treatment-plans/treatment-plan.service', () => ({
  updateSessionProgress: jest.fn(),
  getTreatmentPlanProgress: jest.fn(),
}));
jest.mock('@/lib/errors', () => {
  const c = class extends Error {
    status: number;
    constructor(m: string, s = 400) {
      super(m);
      this.status = s;
    }
  };
  return {
    handleApiError: jest.fn((e: any) => ({
      status: e?.status || 500,
      json: async () => ({ error: e?.message || 'err' }),
    }) as any),
    ValidationError: c,
    NotFoundError: c,
    DatabaseError: c,
  };
});

import { POST, GET } from '@/app/api/treatment-plans/[id]/sessions/route';
import { validateApiAuth } from '@/lib/auth/session';
import { updateSessionProgress, getTreatmentPlanProgress } from '@/services/treatment-plans/treatment-plan.service';

function auth(p: any = { id: 'u1', clinic_id: 'c1', role: 'owner' }) {
  (validateApiAuth as jest.Mock).mockResolvedValue({ success: true, profile: p });
}
function authFail() {
  (validateApiAuth as jest.Mock).mockResolvedValue({ success: false, error: { message: 'Unauthorized', status: 401 } });
}
function ok(d: any[]) {
  mdb.then = jest.fn((fn: any) => Promise.resolve(typeof fn === 'function' ? fn(d) : d));
}

const rParams = { params: Promise.resolve({ id: 'plan1' }) };

describe('POST /api/treatment-plans/[id]/sessions — tenancy & cross-plan boundaries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when request is unauthenticated', async () => {
    authFail();
    const r = await POST(new Request('http://localhost/api/treatment-plans/plan1/sessions', { method: 'POST', body: '{}' }) as any, rParams);
    expect(r.status).toBe(401);
  });

  it('returns 404 if treatment plan does not exist', async () => {
    auth();
    ok([]);
    const r = await POST(new Request('http://localhost/api/treatment-plans/plan1/sessions', {
      method: 'POST',
      body: JSON.stringify({ treatment_plan_item_id: 'i1' }),
    }) as any, rParams);
    expect(r.status).toBe(404);
    const data = await r.json();
    expect(data.error).toBe('Treatment plan not found');
  });

  it('returns 403 if treatment plan belongs to another clinic (cross-clinic access)', async () => {
    auth({ id: 'u1', clinic_id: 'c1', role: 'owner' });
    ok([{ id: 'plan1', clinicId: 'c2' }]);
    const r = await POST(new Request('http://localhost/api/treatment-plans/plan1/sessions', {
      method: 'POST',
      body: JSON.stringify({ treatment_plan_item_id: 'i1' }),
    }) as any, rParams);
    expect(r.status).toBe(403);
    const data = await r.json();
    expect(data.error).toBe('Forbidden');
  });

  it('returns 400 if treatment_plan_item_id is missing in payload', async () => {
    auth({ id: 'u1', clinic_id: 'c1', role: 'owner' });
    ok([{ id: 'plan1', clinicId: 'c1' }]);
    const r = await POST(new Request('http://localhost/api/treatment-plans/plan1/sessions', {
      method: 'POST',
      body: JSON.stringify({}),
    }) as any, rParams);
    expect(r.status).toBe(400);
    const data = await r.json();
    expect(data.error).toBe('treatment_plan_item_id is required');
  });

  it('returns 500 when treatment item belongs to another plan (cross-plan item binding mismatch)', async () => {
    auth({ id: 'u1', clinic_id: 'c1', role: 'owner' });
    ok([{ id: 'plan1', clinicId: 'c1' }]);
    (updateSessionProgress as jest.Mock).mockResolvedValue(null);

    const r = await POST(new Request('http://localhost/api/treatment-plans/plan1/sessions', {
      method: 'POST',
      body: JSON.stringify({ treatment_plan_item_id: 'foreign-item-from-other-plan' }),
    }) as any, rParams);

    expect(r.status).toBe(500);
    const data = await r.json();
    expect(data.error).toBe('Failed to update session');
    expect(updateSessionProgress).toHaveBeenCalledWith('foreign-item-from-other-plan', 'plan1', 'c1');
  });

  it('passes the authenticated route plan id to session progress for nominal update', async () => {
    auth({ id: 'u1', clinic_id: 'c1', role: 'owner' });
    ok([{ id: 'plan1', clinicId: 'c1' }]);
    (updateSessionProgress as jest.Mock).mockResolvedValue({ id: 'i1', treatment_plan_id: 'plan1', status: 'completed' });

    const r = await POST(new Request('http://localhost/api/treatment-plans/plan1/sessions', {
      method: 'POST',
      body: JSON.stringify({ treatment_plan_item_id: 'i1' }),
    }) as any, rParams);

    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data).toEqual({ treatment_plan_item: { id: 'i1', treatment_plan_id: 'plan1', status: 'completed' } });
    expect(updateSessionProgress).toHaveBeenCalledWith('i1', 'plan1', 'c1');
  });
});

describe('GET /api/treatment-plans/[id]/sessions — tenancy & progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when request is unauthenticated', async () => {
    authFail();
    const r = await GET(new Request('http://localhost/api/treatment-plans/plan1/sessions') as any, rParams);
    expect(r.status).toBe(401);
  });

  it('returns 404 when plan is not found', async () => {
    auth();
    ok([]);
    const r = await GET(new Request('http://localhost/api/treatment-plans/plan1/sessions') as any, rParams);
    expect(r.status).toBe(404);
  });

  it('returns 403 when plan belongs to another clinic', async () => {
    auth({ id: 'u1', clinic_id: 'c1', role: 'owner' });
    ok([{ id: 'plan1', clinicId: 'other-clinic' }]);
    const r = await GET(new Request('http://localhost/api/treatment-plans/plan1/sessions') as any, rParams);
    expect(r.status).toBe(403);
  });

  it('returns 200 with plan progress for authenticated clinic owner', async () => {
    auth({ id: 'u1', clinic_id: 'c1', role: 'owner' });
    ok([{ id: 'plan1', clinicId: 'c1' }]);
    (getTreatmentPlanProgress as jest.Mock).mockResolvedValue({ totalSessions: 4, completedSessions: 2, percent: 50 });

    const r = await GET(new Request('http://localhost/api/treatment-plans/plan1/sessions') as any, rParams);
    expect(r.status).toBe(200);
    const data = await r.json();
    expect(data).toEqual({ progress: { totalSessions: 4, completedSessions: 2, percent: 50 } });
    expect(getTreatmentPlanProgress).toHaveBeenCalledWith('plan1', 'c1');
  });
});
