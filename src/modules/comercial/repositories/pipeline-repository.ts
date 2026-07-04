/**
 * Comercial module — pipeline repository.
 *
 * DB operations for pipeline_stages and lead stage management.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { pipelineStages } from '@/modules/comercial/schema/pipeline';
import { leads } from '@/modules/comercial/schema/leads';

export async function listPipeline(clinicId: string) {
  const db = getDb();
  return db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.clinicId, clinicId))
    .orderBy(pipelineStages.position);
}

export async function findStageById(clinicId: string, stageId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(pipelineStages)
    .where(
      and(eq(pipelineStages.id, stageId), eq(pipelineStages.clinicId, clinicId)),
    )
    .limit(1);
  return row ?? null;
}

export async function moveLeadStage(input: {
  leadId: string;
  clinicId: string;
  stageId: string;
}) {
  const db = getDb();
  const [row] = await db
    .update(leads)
    .set({ stageId: input.stageId, updatedAt: new Date() })
    .where(
      and(eq(leads.id, input.leadId), eq(leads.clinicId, input.clinicId)),
    )
    .returning({ id: leads.id, stageId: leads.stageId });

  return row ?? null;
}

export async function getLeadsByStage(
  clinicId: string,
  stageId: string,
) {
  const db = getDb();
  return db
    .select()
    .from(leads)
    .where(
      and(eq(leads.clinicId, clinicId), eq(leads.stageId, stageId)),
    )
    .orderBy(leads.updatedAt);
}
