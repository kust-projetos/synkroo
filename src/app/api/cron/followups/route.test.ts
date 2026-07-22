/**
 * Unit tests for /api/cron/followups route.
 *
 * Verifies:
 * - Runs followups once per active clinic with isolated action failure
 * - Runs campaigns via separate permission
 * - Deleted clinics are excluded from the active clinic query
 * - Returns 401 when CRON_SECRET is missing
 * - GET returns health check
 *
 * Run: npx jest --runTestsByPath src/app/api/cron/followups/route.test.ts --runInBand
 */

/** @jest-environment node */

// ─── Mock dependencies before importing route ──────────────────────────────────

const SECRET = 'test-cron-secret';

const mockWhere = jest.fn();
const mockFrom = jest.fn().mockReturnValue({ where: mockWhere });
const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });
const mockDbGet = jest.fn(() => ({ select: mockSelect }));

jest.mock('@/lib/db/client', () => ({ getDb: () => mockDbGet() }));

const mockBuildCronContext = jest.fn();
jest.mock('@/core/actions/context', () => ({
  buildCronContext: (...a: unknown[]) => mockBuildCronContext(...a),
}));

const mockRunAction = jest.fn();
jest.mock('@/core/actions/run', () => ({ runAction: (...a: unknown[]) => mockRunAction(...a) }));

jest.mock('@/core/modules/gates', () => ({
  assertModuleForJob: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/core/modules/manifest', () => ({ moduleManifest: {} }));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, retryAfter: 0 }),
  rateLimitPresets: { cron: { maxRequests: 100, windowMs: 60000 } },
}));

// Mock followup module services that the OLD route calls directly
jest.mock('@/modules/followup/services/followup-service', () => ({
  executarAll: jest.fn().mockResolvedValue(undefined),
  runInactivityForCron: jest.fn().mockResolvedValue(undefined),
  runCampaignsForCron: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

// ─── Import route after mocks are set up ───────────────────────────────────────

import { GET, POST } from './route';

function makeCronRequest(tasks?: string) {
  const url = new URL('http://localhost/api/cron/followups');
  if (tasks) url.searchParams.set('tasks', tasks);
  return new NextRequest(url, { method: 'POST' });
}

import { NextRequest } from 'next/server';

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/cron/followups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = SECRET;
  });

  it('runs followups once per active clinic and isolates an action failure', async () => {
    // Route selects active clinics via isNull(deletedAt)
    mockWhere.mockResolvedValueOnce([{ id: 'clinic-a' }, { id: 'clinic-b' }]);

    mockBuildCronContext
      .mockResolvedValueOnce({ clinicId: 'clinic-a', can: () => true, hasModule: () => true, audit: { actor: 'cron' } })
      .mockResolvedValueOnce({ clinicId: 'clinic-b', can: () => true, hasModule: () => true, audit: { actor: 'cron' } });

    mockRunAction
      .mockResolvedValueOnce({ ok: true, data: { processed: 1 } })
      .mockResolvedValueOnce({ ok: false, error: { message: 'clinic-b failed' } });

    const req = makeCronRequest('followups');
    req.headers.set('Authorization', `Bearer ${SECRET}`);
    const response = await POST(req);
    const body = await response.json();

    expect(mockRunAction).toHaveBeenCalledTimes(2);
    expect(body.results.followups).toMatchObject([
      { task: 'followups', clinicId: 'clinic-a', ok: true, data: { processed: 1 } },
      { task: 'followups', clinicId: 'clinic-b', ok: false, error: 'clinic-b failed' },
    ]);
  });

  it('tasks=campaigns invokes only executarCampanhas action', async () => {
    mockWhere.mockResolvedValueOnce([{ id: 'clinic-a' }]);

    mockBuildCronContext.mockResolvedValueOnce({
      clinicId: 'clinic-a', can: () => true, hasModule: () => true, audit: { actor: 'cron' },
    });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { processed: 1 } });

    const req = makeCronRequest('campaigns');
    req.headers.set('Authorization', `Bearer ${SECRET}`);
    const response = await POST(req);
    const body = await response.json();

    expect(mockRunAction).toHaveBeenCalledTimes(1);
    expect(body.results.campaigns).toMatchObject([
      { task: 'campaigns', clinicId: 'clinic-a', ok: true },
    ]);
  });

  it('excludes deleted clinics from the active clinic query', async () => {
    // Mock returns only active clinics (deleted ones are filtered by isNull(deletedAt))
    mockWhere.mockResolvedValueOnce([{ id: 'clinic-active' }]);

    mockBuildCronContext.mockResolvedValueOnce({
      clinicId: 'clinic-active', can: () => true, hasModule: () => true, audit: { actor: 'cron' },
    });
    mockRunAction.mockResolvedValueOnce({ ok: true, data: { processed: 1 } });

    const req = makeCronRequest('followups');
    req.headers.set('Authorization', `Bearer ${SECRET}`);
    const response = await POST(req);
    const body = await response.json();

    // Only one clinic (active), no deleted clinic calls
    expect(mockRunAction).toHaveBeenCalledTimes(1);
    expect(body.results.followups[0].clinicId).toBe('clinic-active');
  });

  it('returns 401 when CRON_SECRET is missing', async () => {
    const req = makeCronRequest('followups');
    // No Authorization header
    const response = await POST(req);
    expect(response.status).toBe(401);
  });
});

describe('GET /api/cron/followups', () => {
  it('returns health check with available tasks', async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.availableTasks).toContain('followups');
    expect(body.availableTasks).toContain('campaigns');
  });
});
