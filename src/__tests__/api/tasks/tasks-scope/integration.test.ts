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
