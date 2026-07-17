/**
 * Comercial module — tasks repository.
 *
 * DB operations for the tasks table.
 */

import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { tasks } from '@/modules/comercial/schema/tasks';

export async function createTask(input: {
  clinicId: string;
  leadId?: string | null;
  title: string;
  description?: string | null;
  dueDate?: Date | null;
  priority?: string;
  assignedTo?: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(tasks)
    .values({
      clinicId: input.clinicId,
      leadId: input.leadId ?? null,
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority ?? 'medium',
      assignedTo: input.assignedTo ?? null,
    })
    .returning({ id: tasks.id });

  return { id: row.id };
}

export async function listTasks(clinicId: string, opts?: {
  leadId?: string;
  status?: string;
}) {
  const db = getDb();
  const conditions = [eq(tasks.clinicId, clinicId)];
  if (opts?.leadId) conditions.push(eq(tasks.leadId, opts.leadId));
  if (opts?.status) conditions.push(eq(tasks.status, opts.status));
  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(tasks.createdAt);
}

export async function findTaskById(clinicId: string, taskId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}

export async function updateTask(
  clinicId: string,
  taskId: string,
  patch: Partial<{
    title: string;
    description: string | null;
    dueDate: Date | null;
    status: string;
    priority: string;
    assignedTo: string | null;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(tasks)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.clinicId, clinicId)))
    .returning({ id: tasks.id });
  return row ?? null;
}

export async function closeTask(clinicId: string, taskId: string) {
  return updateTask(clinicId, taskId, { status: 'done' });
}
