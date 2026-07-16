/**
 * Integration test: tasks tenant scope — verifies PUT/DELETE routes reject
 * cross-tenant mutations via HTTP 404, DB unchanged.
 *
 * Auth is mocked to simulate authenticated clinic A session; route handlers
 * use real Drizzle DB.
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
const TASK_ID = '00000000-0000-0000-0000-00000000c001';
const TASK_B_ID = '00000000-0000-0000-0000-00000000c002';

function authAs(clinicId: string) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  });
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
    await db.execute(
      sql`INSERT INTO tasks (id, clinic_id, title, status, priority)
          VALUES (${TASK_ID}, ${CLINIC_A}, 'Clinic A Task', 'pending', 'medium')
          ON CONFLICT (id) DO NOTHING`,
    );
    await db.execute(
      sql`INSERT INTO tasks (id, clinic_id, title, status, priority)
          VALUES (${TASK_B_ID}, ${CLINIC_B}, 'Clinic B Task', 'pending', 'medium')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM tasks WHERE id IN (${TASK_ID}, ${TASK_B_ID})`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  beforeEach(() => {
    (validateApiAuth as jest.Mock).mockReset();
  });

  // ── PUT route ────────────────────────────────────────

  it('PUT route returns 404 when task belongs to other clinic', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    // TASK_B_ID belongs to CLINIC_B — CLINIC_A session should not mutate it
    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);

    const [{ title: titleBefore }] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1) as any;

    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: TASK_B_ID, title: 'Hacked via PUT' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);

    // Row count unchanged
    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);
    expect(after).toBe(before);

    // Task data unchanged
    const [row] = await db
      .select({ title: tasks.title, clinicId: tasks.clinicId })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1);
    expect(row.title).toBe(titleBefore);
    expect(row.clinicId).toBe(CLINIC_B);
  });

  it('PUT route ignores forged clinicId in body, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    // Snapshot clinic B task before
    const [{ title: titleBefore, clinicId: clinicBefore }] = await db
      .select({ title: tasks.title, clinicId: tasks.clinicId })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1) as any;

    // PUT with forged clinicId in body — route must ignore it
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: TASK_B_ID, title: 'Hacked', clinicId: CLINIC_B }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);

    // Clinic B task unchanged
    const [row] = await db
      .select({ title: tasks.title, clinicId: tasks.clinicId })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1);
    expect(row.title).toBe(titleBefore);
    expect(row.clinicId).toBe(clinicBefore);
  });

  it('PUT route ignores forged clinicId in x-clinic-id header, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    const [{ title: titleBefore }] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1) as any;

    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      headers: { 'x-clinic-id': CLINIC_B },
      body: JSON.stringify({ id: TASK_B_ID, title: 'Hacked via header' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);

    const [row] = await db
      .select({ title: tasks.title })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1);
    expect(row.title).toBe(titleBefore);
  });

  // ── DELETE route ─────────────────────────────────────

  it('DELETE route returns 404 when task belongs to other clinic', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    // TASK_B_ID belongs to CLINIC_B — CLINIC_A session should not delete it
    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);

    const req = new Request('http://localhost/api/tasks?id=' + TASK_B_ID, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);

    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);
    expect(after).toBe(before);

    const [row] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`)
      .limit(1);
    expect(row).toBeDefined();
  });

  it('DELETE route ignores forged clinicId in query, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);

    const req = new Request('http://localhost/api/tasks?id=' + TASK_B_ID + '&clinicId=' + CLINIC_B, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);

    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);
    expect(after).toBe(before);
  });

  it('DELETE route ignores forged clinicId in header, returns 404', async () => {
    authAs(CLINIC_A);
    const db = getDb();

    const [{ count: before }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);

    const req = new Request('http://localhost/api/tasks?id=' + TASK_B_ID, {
      method: 'DELETE',
      headers: { 'x-clinic-id': CLINIC_B },
    });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);

    const [{ count: after }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(sql`id = ${TASK_B_ID}`);
    expect(after).toBe(before);
  });
});
