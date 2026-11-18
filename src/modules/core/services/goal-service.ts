/**
 * Goal Service — Control Plane (vNext E5-A).
 *
 * Tenant-scoped CRUD for the `goals` table. Sem chamadores nesta tranche;
 * nenhum writer invoca LLM nem executa workflow automaticamente. Writers são server-side only and
 * derive tenant from the authenticated context.
 */

import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { goals } from '@/modules/core/schema/goals';
import { dbLogger } from '@/lib/logger';

type GoalSelect = typeof goals.$inferSelect;
export interface GoalRow extends GoalSelect {}

export type GoalStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

const VALID_STATUSES: ReadonlySet<string> = new Set(['open', 'in_progress', 'done', 'cancelled']);

export function parseGoalStatus(value: unknown): GoalStatus {
  if (!isGoalStatus(value)) {
    throw new Error(`Invalid goal status: ${String(value)}`);
  }
  return value;
}

function isGoalStatus(value: unknown): value is GoalStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value);
}

function validateTitle(title: string): void {
  if (!title.trim()) {
    throw new Error('Goal title must not be empty');
  }
}

export async function createGoal(input: {
  clinicId: string;
  title: string;
  description?: string | null;
  status?: GoalStatus;
  metadata?: Record<string, unknown>;
}): Promise<GoalRow> {
  validateTitle(input.title);
  const db = getDb();
  const status = input.status === undefined ? 'open' : parseGoalStatus(input.status);
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
  return row;
}

export async function getGoalById(id: string, clinicId: string): Promise<GoalRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, id), eq(goals.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}

export async function listGoalsByClinic(clinicId: string): Promise<GoalRow[]> {
  const db = getDb();
  const rows = await db.select().from(goals).where(eq(goals.clinicId, clinicId));
  return rows;
}

export async function updateGoal(
  id: string,
  clinicId: string,
  patch: { title?: string; description?: string | null; status?: GoalStatus; metadata?: Record<string, unknown> },
): Promise<GoalRow | null> {
  if (patch.title !== undefined) validateTitle(patch.title);
  const db = getDb();
  const set: Partial<typeof goals.$inferInsert> = { updatedAt: new Date() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.status !== undefined) set.status = parseGoalStatus(patch.status);
  if (patch.metadata !== undefined) set.metadata = patch.metadata;
  const [row] = await db
    .update(goals)
    .set(set)
    .where(and(eq(goals.id, id), eq(goals.clinicId, clinicId)))
    .returning();
  return row ?? null;
}

export async function deleteGoal(id: string, clinicId: string): Promise<boolean> {
  const db = getDb();
  const result = await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.clinicId, clinicId)))
    .returning({ id: goals.id });
  return result.length > 0;
}
