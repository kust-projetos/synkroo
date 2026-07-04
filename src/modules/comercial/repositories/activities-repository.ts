/**
 * Comercial module — activities repository.
 *
 * DB operations for lead_activities table.
 */

import { getDb } from '@/lib/db/client';
import { eq } from 'drizzle-orm';
import { leadActivities } from '@/modules/comercial/schema/leads';

export async function insertActivity(input: {
  leadId: string;
  activityType: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(leadActivities)
    .values({
      leadId: input.leadId,
      activityType: input.activityType,
      description: input.description ?? null,
      metadata: (input.metadata ?? {}) as Record<string, unknown>,
    })
    .returning({ id: leadActivities.id });

  return { id: row.id };
}

export async function findActivityById(activityId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.id, activityId))
    .limit(1);
  return row ?? null;
}

export async function updateActivity(
  activityId: string,
  patch: Partial<{ metadata: Record<string, unknown> }>,
) {
  const db = getDb();
  const [row] = await db
    .update(leadActivities)
    .set(patch)
    .where(eq(leadActivities.id, activityId))
    .returning({ id: leadActivities.id });
  return row ?? null;
}

export async function listActivitiesByLead(leadId: string) {
  const db = getDb();
  return db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, leadId))
    .orderBy(leadActivities.createdAt);
}
