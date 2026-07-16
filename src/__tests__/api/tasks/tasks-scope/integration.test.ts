/**
 * Integration test: tasks tenant scope — verifies PUT/DELETE routes reject
 * cross-tenant mutations via HTTP 404, DB unchanged.
 *
 * Auth is mocked to simulate authenticated CLINIC_A session; route handlers
 * use real Drizzle DB. Each test creates its own task with try/finally.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tasks/tasks-scope/integration.test.ts
 */

/** @jest-environment node */

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { PUT, DELETE } from '@/app/api/tasks/route';
import { validateApiAuth } from '@/lib/auth/session';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const TASK_A_ID = '00000000-0000-0000-0000-00000000c001';
const TASK_B_ID = '00000000-0000-0000-0000-00000000c002';

function authAs(clinicId: string) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  });
}

/** Snapshot a task row for before/after comparison. */
async function snapshotTask(db: any, taskId: string) {
  const { rows } = await db.execute(
    sql`SELECT id, title, clinic_id as "clinicId", status FROM tasks WHERE id = ${taskId}`,
  );
  return rows[0] || null;
}

describeOrSkip('Tasks tenant scope — route + DB real', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_A}, 'Task Scope Clinic A', 'task-scope-a', '11999990001', 'a@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO clinics (id, name, slug, phone, email)
          VALUES (${CLINIC_B}, 'Task Scope Clinic B', 'task-scope-b', '11999990002', 'b@test.com')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM tasks WHERE id IN (${TASK_A_ID}, ${TASK_B_ID})`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  beforeEach(() => {
    (validateApiAuth as jest.Mock).mockReset();
  });

  /** Shared: ensure TASK_B_ID exists (belongs to CLINIC_B). Cleanup in afterAll. */
  async function ensureTaskB() {
    const db = getDb();
    await db.execute(
      sql`INSERT INTO tasks (id, clinic_id, title, status, priority)
          VALUES (${TASK_B_ID}, ${CLINIC_B}, 'Clinic B Task', 'pending', 'medium')
          ON CONFLICT (id) DO NOTHING`,
    );
  }

  // ── PUT route ────────────────────────────────────────

  it('PUT route returns 404 when task belongs to other clinic', async () => {
    await ensureTaskB();
    authAs(CLINIC_A);
    const db = getDb();
    const taskId = TASK_B_ID;

    try {
      const before = await snapshotTask(db, taskId);
      expect(before).toBeDefined();
      expect(before.clinicId).toBe(CLINIC_B);

      const req = new Request('http://localhost/api/tasks', {
        method: 'PUT',
        body: JSON.stringify({ id: taskId, title: 'Hacked via PUT' }),
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);

      const after = await snapshotTask(db, taskId);
      expect(after).toEqual(before);
    } finally {
      // Keep task for subsequent tests; afterAll cleans up
    }
  });

  it('PUT route ignores forged clinicId in body, returns 404', async () => {
    await ensureTaskB();
    authAs(CLINIC_A);
    const db = getDb();
    const taskId = TASK_B_ID;

    try {
      const before = await snapshotTask(db, taskId);
      expect(before).toBeDefined();
      expect(before.clinicId).toBe(CLINIC_B);

      const req = new Request('http://localhost/api/tasks', {
        method: 'PUT',
        body: JSON.stringify({ id: taskId, title: 'Hacked', clinicId: CLINIC_B }),
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);

      const after = await snapshotTask(db, taskId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  it('PUT route ignores forged clinicId in x-clinic-id header, returns 404', async () => {
    await ensureTaskB();
    authAs(CLINIC_A);
    const db = getDb();
    const taskId = TASK_B_ID;

    try {
      const before = await snapshotTask(db, taskId);
      expect(before).toBeDefined();

      const req = new Request('http://localhost/api/tasks', {
        method: 'PUT',
        headers: { 'x-clinic-id': CLINIC_B },
        body: JSON.stringify({ id: taskId, title: 'Hacked via header' }),
      });
      const res = await PUT(req as any);
      expect(res.status).toBe(404);

      const after = await snapshotTask(db, taskId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  // ── DELETE route ─────────────────────────────────────

  it('DELETE route returns 404 when task belongs to other clinic', async () => {
    await ensureTaskB();
    authAs(CLINIC_A);
    const db = getDb();
    const taskId = TASK_B_ID;

    try {
      const before = await snapshotTask(db, taskId);
      expect(before).toBeDefined();
      expect(before.clinicId).toBe(CLINIC_B);

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(sql`id = ${taskId}`);

      const req = new Request('http://localhost/api/tasks?id=' + taskId, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(404);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(sql`id = ${taskId}`);
      expect(countAfter).toBe(countBefore);

      const after = await snapshotTask(db, taskId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  it('DELETE route ignores forged clinicId in query, returns 404', async () => {
    await ensureTaskB();
    authAs(CLINIC_A);
    const db = getDb();
    const taskId = TASK_B_ID;

    try {
      const before = await snapshotTask(db, taskId);
      expect(before).toBeDefined();

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(sql`id = ${taskId}`);

      const req = new Request('http://localhost/api/tasks?id=' + taskId + '&clinicId=' + CLINIC_B, { method: 'DELETE' });
      const res = await DELETE(req as any);
      expect(res.status).toBe(404);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(sql`id = ${taskId}`);
      expect(countAfter).toBe(countBefore);

      const after = await snapshotTask(db, taskId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });

  it('DELETE route ignores forged clinicId in header, returns 404', async () => {
    await ensureTaskB();
    authAs(CLINIC_A);
    const db = getDb();
    const taskId = TASK_B_ID;

    try {
      const before = await snapshotTask(db, taskId);
      expect(before).toBeDefined();

      const [{ count: countBefore }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(sql`id = ${taskId}`);

      const req = new Request('http://localhost/api/tasks?id=' + taskId, {
        method: 'DELETE',
        headers: { 'x-clinic-id': CLINIC_B },
      });
      const res = await DELETE(req as any);
      expect(res.status).toBe(404);

      const [{ count: countAfter }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(sql`id = ${taskId}`);
      expect(countAfter).toBe(countBefore);

      const after = await snapshotTask(db, taskId);
      expect(after).toEqual(before);
    } finally {
      // afterAll cleans up
    }
  });
});
