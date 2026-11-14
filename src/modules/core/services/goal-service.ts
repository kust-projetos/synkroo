/**
 * Goal Service — Control Plane (vNext E5-A).
 *
 * Tenant-scoped CRUD for the `goals` table. Feature flag OFF by default:
 * no LLM invocation, no workflow execution. Writers are server-side only and
 * derive tenant from the authenticated context.
 */

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { goals } from '@/modules/core/schema/goals';
import { dbLogger } from '@/lib/logger';

export interface GoalRow {
  id: string;
  clinicId: string;
  title: string;
  description: string | null;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export type GoalStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

const VALID_STATUSES: ReadonlySet<string> = new Set(['open', 'in_progress', 'done', 'cancelled']);

export async function createGoal(input: {
  clinicId: string;
  title: string;
  description?: string | null;
  status?: GoalStatus;
  metadata?: Record<string, unknown>;
}): Promise<GoalRow> {
  const db = getDb();
  const status = input.status && VALID_STATUSES.has(input.status) ? input.status : 'open';
  const [row] = await db
    .insert(goals)
    .values({
      clinicId: input.clinicId,
      title: input.title,
      description: input.description ?? null,
      status,
      metadata: input.metadata ?? {},
    })
    .returning();
  return row as unknown as GoalRow;
}

export async function getGoalById(id: string, clinicId: string): Promise<GoalRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.clinicId, clinicId)))
    .limit(1);
  return (row as GoalRow) ?? null;
}

export async function listGoalsByClinic(clinicId: string): Promise<GoalRow[]> {
  const db = getDb();
  const rows = await db.select().from(goals).where(eq(goals.clinicId, clinicId));
  return rows as unknown as GoalRow[];
}

export async function updateGoal(
  id: string,
  clinicId: string,
  patch: { title?: string; description?: string | null; status?: GoalStatus; metadata?: Record<string, unknown> },
): Promise<GoalRow | null> {
  const db = getDb();
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status !== undefined && VALID_STATUSES.has(patch.status)) set.status = patch.status;
  if (patch.metadata !== undefined) set.metadata = patch.metadata;
  const [row] = await db
    .update(goals)
    .set(set as any)
    .where(and(eq(goals.id, id), eq(goals.clinicId, clinicId)))
    .returning();
  return (row as GoalRow) ?? null;
}

export async function deleteGoal(id: string, clinicId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.clinicId, clinicId)))
    .returning({ id: goals.id });
  return result.length > 0;
}
