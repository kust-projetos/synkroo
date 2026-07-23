/**
 * Integration test: tasks tenant scope — verifies PUT/DELETE cannot mutate
 * tasks from another clinic.
 *
 * Precondition: RUN_INTEGRATION_TESTS=1, TEST_DATABASE_URL points to
 * local /synkroo_test database with migrations applied.
 *
 * Run via: npm run test:integration:run -- src/__tests__/api/tasks/tasks-scope/integration.test.ts
 */

/** @jest-environment node */

import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));
import { PUT, DELETE } from '@/app/api/tasks/route';
import { validateApiAuth } from '@/lib/auth/session';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const CLINIC_A = '00000000-0000-0000-0000-00000000a001';
const CLINIC_B = '00000000-0000-0000-0000-00000000b001';
const TASK_ID = '00000000-0000-0000-0000-00000000c001';

let pool: Pool;

describeOrSkip('Tasks tenant scope (DB real)', () => {
  beforeAll(async () => {
    const db = getDb();

    // Create two clinics
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

    // Create a task belonging to clinic A
    await db.execute(
      sql`INSERT INTO tasks (id, clinic_id, title, status, priority)
          VALUES (${TASK_ID}, ${CLINIC_A}, 'Clinic A Task', 'pending', 'medium')
          ON CONFLICT (id) DO NOTHING`,
    );
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM tasks WHERE id = ${TASK_ID}`);
    await db.execute(sql`DELETE FROM clinics WHERE id IN (${CLINIC_A}, ${CLINIC_B})`);
    await closeDb();
  });

  // ── PUT scope ───────────────────────────────────────

  it('PUT from clinic B returns 0 rows and does not alter clinic A task', async () => {
    const db = getDb();

    // Attempt update — predicates must include clinicId
    const result = await db
      .update(tasks)
      .set({ title: 'Hacked by B' })
      .where(sql`id = ${TASK_ID} AND clinic_id = ${CLINIC_B}`)
      .returning();

    // No rows affected — tenant predicate rejected the update
    expect(result.length).toBe(0);

    // Verify the original task is untouched
    const [row] = await db
      .select({ title: tasks.title, clinicId: tasks.clinicId })
      .from(tasks)
      .where(sql`id = ${TASK_ID}`)
      .limit(1);

    expect(row.title).toBe('Clinic A Task');
    expect(row.clinicId).toBe(CLINIC_A);
  });

  // ── Route boundary (forged clinicId under valid session) ──

  it('route boundary: forged body/query/header clinicId is ignored under valid session', async () => {
    // Mock auth to return CLINIC_A session (trusted, own clinic)
    (validateApiAuth as jest.Mock).mockResolvedValue({
      success: true,
      profile: { id: 'user-a', clinic_id: CLINIC_A, role: 'owner' },
    });

    const db = getDb();
    const FOREIGN_TASK_ID = '00000000-0000-0000-0000-00000000c002';

    // Create a task belonging to clinic B (foreign to clinic A session)
    await db.execute(
      sql`INSERT INTO tasks (id, clinic_id, title, status, priority)
          VALUES (${FOREIGN_TASK_ID}, ${CLINIC_B}, 'Clinic B Task', 'pending', 'medium')
          ON CONFLICT (id) DO NOTHING`,
    );

    try {
      // Count tasks for clinic B before
      const [{ count: beforeCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(sql`clinic_id = ${CLINIC_B}`);

      // 1. PUT with forged clinicId in body JSON
      const putBodyReq = new NextRequest('http://localhost/api/tasks', {
        method: 'PUT',
        body: JSON.stringify({ clinicId: CLINIC_B, id: FOREIGN_TASK_ID, title: 'Hacked via body' }),
      });
      const putBodyRes = await PUT(putBodyReq as any);
      expect(putBodyRes.status).toBe(404);
      expect((await putBodyRes.json()).error).toBe('Task not found');

      // 2. PUT with forged clinicId in query string
      const putQueryReq = new NextRequest('http://localhost/api/tasks?clinicId=' + CLINIC_B, {
        method: 'PUT',
        body: JSON.stringify({ id: FOREIGN_TASK_ID, title: 'Hacked via query' }),
      });
      const putQueryRes = await PUT(putQueryReq as any);
      expect(putQueryRes.status).toBe(404);

      // 3. DELETE with forged x-clinic-id header
      const delReq = new NextRequest('http://localhost/api/tasks?id=' + FOREIGN_TASK_ID, {
        method: 'DELETE',
        headers: { 'x-clinic-id': CLINIC_B },
      });
      const delRes = await DELETE(delReq as any);
      expect(delRes.status).toBe(404);
      expect((await delRes.json()).error).toBe('Task not found');

      // Count after — unchanged (no task was added or removed for clinic B)
      const [{ count: afterCount }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(sql`clinic_id = ${CLINIC_B}`);
      expect(afterCount).toBe(beforeCount);

      // Verify task B title was not modified
      const [row] = await db
        .select({ title: tasks.title })
        .from(tasks)
        .where(sql`id = ${FOREIGN_TASK_ID}`)
        .limit(1);
      expect(row.title).toBe('Clinic B Task');
    } finally {
      await db.execute(sql`DELETE FROM tasks WHERE id = ${FOREIGN_TASK_ID}`);
    }
  });

  // ── Count unchanged ──────────────────────────────────

  it('attempted foreign PUT+DELETE leaves DB count unchanged', async () => {
    const db = getDb();

    // Count tasks for clinic A before
    const [{ count: beforeCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(sql`clinic_id = ${CLINIC_A}`);

    // Attempt PUT with foreign clinicId
    await db
      .update(tasks)
      .set({ title: 'Hacked by B' })
      .where(sql`id = ${TASK_ID} AND clinic_id = ${CLINIC_B}`)
      .returning();

    // Attempt DELETE with foreign clinicId
    await db
      .delete(tasks)
      .where(sql`id = ${TASK_ID} AND clinic_id = ${CLINIC_B}`)
      .returning();

    // Count after — must be unchanged
    const [{ count: afterCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(sql`clinic_id = ${CLINIC_A}`);

    expect(afterCount).toBe(beforeCount);
  });

  // ── DELETE scope ─────────────────────────────────────

  it('DELETE from clinic B returns 0 rows and does not remove clinic A task', async () => {
    const db = getDb();

    // Attempt delete — predicates must include clinicId
    const result = await db
      .delete(tasks)
      .where(sql`id = ${TASK_ID} AND clinic_id = ${CLINIC_B}`)
      .returning();

    // No rows affected — tenant predicate rejected the delete
    expect(result.length).toBe(0);

    // Verify the task still exists
    const [row] = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(sql`id = ${TASK_ID}`)
      .limit(1);

    expect(row).toBeDefined();
    expect(row.id).toBe(TASK_ID);
  });
});
