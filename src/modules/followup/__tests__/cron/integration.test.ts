/**
 * Integration test: cron/followups endpoint.
 *
 * Tests POST /api/cron/followups:
 * 1. Invalid/missing CRON_SECRET → 401
 * 2. Module disabled (gate via real DB instanceModules) → 200 skipped
 * 3. Valid CRON_SECRET + enabled → 200 success
 *
 * Module gate: driven by real instanceModules table.
 * Manifest cache bypassed so DB state changes are visible within the suite.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/followup/__tests__/cron/integration.test.ts
 */

/** @jest-environment node */

const MOCK_CRON_SECRET = ['cron', 'fixture', String(2026)].join('-');

// ── Mocks (must be before imports) ────────────────────────────────────────────

// Rate limit always allowed
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10, resetTime: Date.now() + 60000 })),
  rateLimitPresets: { cron: { windowMs: 60000, maxRequests: 30 } },
}));

// Manifest — use real drizzleManifestRepo but without makeManifest cache.
// Each isEnabled() call queries DB fresh, so toggling instanceModules.enabled
// has immediate effect within the test suite.
jest.mock('@/core/modules/manifest', () => {
  const actual = jest.requireActual('@/core/modules/manifest');

  const uncached: {
    isEnabled(moduleId: string): Promise<boolean>;
    enabledModules(): Promise<Set<string>>;
  } = {
    async isEnabled(moduleId: string) {
      const ids = await actual.drizzleManifestRepo.getEnabledModuleIds();
      return ids.includes(moduleId);
    },
    async enabledModules() {
      return new Set(await actual.drizzleManifestRepo.getEnabledModuleIds());
    },
  };

  return {
    __esModule: true,
    ...actual,
    moduleManifest: uncached,
  };
});

// Service mocks — action wrappers import these exact service boundaries.
jest.mock('@/modules/followup/services/followup-service', () => ({
  executarAll: jest.fn().mockResolvedValue({ processed: 1 }),
  runInactivityForCron: jest.fn().mockResolvedValue(undefined),
  runCampaignsForCron: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/modules/followup/services/inactive-service', () => ({
  runInactivityDetection: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/modules/followup/services/campaign-service', () => ({
  executarCampanhas: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/modules/comercial/services/hot-lead-notification-service', () => ({
  processarNotificacoesLeadsQuentesHandler: jest.fn().mockResolvedValue(undefined),
}))

// ── Imports ───────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '@/app/api/cron/followups/route';
import { getDb, closeDb } from '@/lib/db/client';
import { instanceModules } from '@/lib/db/schema/modules';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCronReq(secret?: string, tasks?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['Authorization'] = `Bearer ${secret}`;
  const url = tasks ? `http://localhost/api/cron/followups?tasks=${tasks}` : 'http://localhost/api/cron/followups';
  return new Request(url, { method: 'POST', headers }) as unknown as NextRequest;
}

/** UPSERT instanceModules state for the followup module. */
async function setModuleEnabled(enabled: boolean) {
  const db = getDb();
  await db
    .insert(instanceModules)
    .values({ moduleId: 'followup', enabled })
    .onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled } });
}

/** Restore neutral state: module enabled=false (not deleted). */
async function restoreModuleNeutral() {
  await setModuleEnabled(false);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describeOrSkip('POST /api/cron/followups (gate via DB real)', () => {

  beforeAll(async () => {
    // Ensure row exists (enabled=true) so valid tests see followup as contracted.
    await setModuleEnabled(true);
    process.env.CRON_SECRET = MOCK_CRON_SECRET;
  });

  afterAll(async () => {
    await restoreModuleNeutral();
    delete process.env.CRON_SECRET;
    await closeDb();
  });

  beforeEach(async () => {
    // Restore enabled=true before each test (tests that need disabled toggle locally).
    await setModuleEnabled(true);
    process.env.CRON_SECRET = MOCK_CRON_SECRET;
  });

  // ── Auth ────────────────────────────────────────────────────────────────

  it('returns 401 when CRON_SECRET is missing', async () => {
    delete process.env.CRON_SECRET;
    const req = makeCronReq('some-secret');
    const res = await POST(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when Authorization header is missing', async () => {
    const req = makeCronReq(); // no secret header
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET does not match', async () => {
    const req = makeCronReq('wrong-secret');
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  // ── Module gate (DB-driven) ─────────────────────────────────────────────

  it('returns 200 with skipped message when followup is not contracted (DB disabled)', async () => {
    await setModuleEnabled(false); // gate via real DB row

    const req = makeCronReq(MOCK_CRON_SECRET);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.skipped).toContain('followup module disabled');
  });

  // ── Valid request (DB enabled) ──────────────────────────────────────────

  it('returns 200 success with valid CRON_SECRET and module contracted', async () => {
    const req = makeCronReq(MOCK_CRON_SECRET, 'followups');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.results).toBeDefined();
    expect(body.timestamp).toBeDefined();
  });

  it('processes specific tasks via tasks query param', async () => {
    const req = makeCronReq(MOCK_CRON_SECRET, 'followups');
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.results.followups)).toBe(true);
    expect(body.results.followups[0]).toMatchObject({ task: 'followups', ok: true });
    // inactivity and campaigns should NOT be processed
    expect(body.results.inactivity).toBeUndefined();
    expect(body.results.campaigns).toBeUndefined();
  });
});
