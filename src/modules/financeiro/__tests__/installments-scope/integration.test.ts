/**
 * Integration test: installments tenant scope — verifies PATCH/DELETE routes
 * reject cross-tenant/budget mutations via HTTP 404, DB unchanged.
 *
 * Auth mocked to simulate authenticated CLINIC_A session; routes use real DB.
 * Each test creates its own installment data with try/finally.
 *
 * Run via: npm run test:integration:run -- src/modules/financeiro/__tests__/installments-scope/integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { PATCH, DELETE } from '@/app/api/budgets/[id]/installments/route';
import { validateApiAuth } from '@/lib/auth/session';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const BUDGET_A = '00000000-0000-0000-0000-00000000c001';
const BUDGET_B = '00000000-0000-0000-0000-00000000c002';
const INSTALLMENT_A = '00000000-0000-0000-0000-00000000d001';
const INSTALLMENT_B = '00000000-0000-0000-0000-00000000d002';

function authAs(clinicId: string) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  });
}

const routeParamsB = { params: Promise.resolve({ id: BUDGET_B }) };

/** Snapshot an installment row for before/after comparison. */
async function snapshotInstallment(db: any, instId: string) {
  const { rows } = await db.execute(
    sql`SELECT id, budget_id as "budgetId", amount, due_date as "dueDate", status
        FROM budget_installments WHERE id = ${instId}`,
  );
  return rows[0] || null;
}

describeOrSkip('Installments tenant scope — route + DB real', () => {
  beforeAll(async () => {
    const db = getDb();

    // Create clinics (shared, cheap)
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_A}, 'Inst Scope Clinic A', 'inst-scope-a', '11999990001', 'a@inst-test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_B}, 'Inst Scope Clinic B', 'inst-scope-b', '11999990002', 'b@inst-test.com')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Budget A (clinic A) with installment A
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status)
          VALUES (${BUDGET_A}, ${CLINIC_A}, 'Budget A', '500.00', '500.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
          VALUES (${INSTALLMENT_A}, ${BUDGET_A}, '250.00', '2026-08-15', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );

    // Budget B (clinic B) with installment B
    await db.execute(
      sql`INSERT INTO budgets (id, clinic_id, title, total_value, final_value, status)
          VALUES (${BUDGET_B}, ${CLINIC_B}, 'Budget B', '300.00', '300.00', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO budget_installments (id, budget_id, amount, due_date, status)
          VALUES (${INSTALLMENT_B}, ${BUDGET_B}, '150.00', '2026-09-01', 'pending')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM budget_installments WHERE budget_id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM budgets WHERE id IN (${BUDGET_A}, ${BUDGET_B})`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  beforeEach(() => {
    (validateApiAuth as jest.Mock).mockReset();
  });

  // ── PATCH route ──────────────────────────────────────

  it('PATCH route returns 404 for foreign budget (wrong tenant)', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();
      expect(before.budgetId).toBe(BUDGET_B);

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId, {
        method: 'PATCH',
        body: JSON.stringify({ amount: 999 }),
      });
      const res = await PATCH(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);
      expect(countAfter).toBe(countBefore);
    } finally {
      // afterAll cleans up
    }
  });

  it('PATCH route ignores forged clinicId in body, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId, {
        method: 'PATCH',
        body: JSON.stringify({ amount: 999, clinicId: CLINIC_B }),
      });
      const res = await PATCH(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  it('PATCH route ignores forged clinicId in header, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId, {
        method: 'PATCH',
        headers: { 'x-clinic-id': CLINIC_B },
        body: JSON.stringify({ amount: 999 }),
      });
      const res = await PATCH(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  it('PATCH route ignores forged clinicId in query, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId + '&clinicId=' + CLINIC_B, {
        method: 'PATCH',
        body: JSON.stringify({ amount: 999 }),
      });
      const res = await PATCH(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  // ── DELETE route ─────────────────────────────────────

  it('DELETE route returns 404 for foreign budget (wrong tenant)', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();
      expect(before.budgetId).toBe(BUDGET_B);

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId, { method: 'DELETE' });
      const res = await DELETE(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);
      expect(countAfter).toBe(countBefore);
    } finally {
      // afterAll cleans up
    }
  });

  it('DELETE route ignores forged clinicId in query, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId + '&clinicId=' + CLINIC_B, { method: 'DELETE' });
      const res = await DELETE(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);
      expect(countAfter).toBe(countBefore);
    } finally {
      // afterAll cleans up
    }
  });

  it('DELETE route ignores forged clinicId in header, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();
    const instId = INSTALLMENT_B;

    try {
      const before = await snapshotInstallment(db, instId);
      expect(before).toBeDefined();

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);

      const req = new Request('http://localhost/api/budgets/' + BUDGET_B + '/installments?installment_id=' + instId, {
        method: 'DELETE',
        headers: { 'x-clinic-id': CLINIC_B },
      });
      const res = await DELETE(req as any, routeParamsB as any);
      expect(res.status).toBe(404);

      const after = await snapshotInstallment(db, instId);
      expect(after).toEqual(before);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(sql`budget_installments`)
        .where(sql`id = ${instId}`);
      expect(countAfter).toBe(countBefore);
    } finally {
      // afterAll cleans up
    }
  });
});
