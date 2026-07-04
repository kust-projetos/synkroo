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

export async function listActivitiesByLead(leadId: string) {
  const db = getDb();
  return db
    .select()
    .from(leadActivities)
    .where(eq(leadActivities.leadId, leadId))
    .orderBy(leadActivities.createdAt);
}
