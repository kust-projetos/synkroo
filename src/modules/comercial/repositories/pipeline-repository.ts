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

export async function createStage(input: {
  clinicId: string;
  name: string;
  position: number;
  color?: string;
  winProbability?: number;
}) {
  const db = getDb();
  const [row] = await db
    .insert(pipelineStages)
    .values({
      clinicId: input.clinicId,
      name: input.name,
      position: input.position,
      color: input.color ?? '#6b7280',
      winProbability: input.winProbability ?? 0,
    })
    .returning({ id: pipelineStages.id });
  return { id: row.id };
}

export async function updateStage(
  clinicId: string,
  stageId: string,
  patch: Partial<{
    name: string;
    position: number;
    color: string;
    winProbability: number;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(pipelineStages)
    .set({ ...patch, updatedAt: new Date() })
    .where(
      and(eq(pipelineStages.id, stageId), eq(pipelineStages.clinicId, clinicId)),
    )
    .returning({ id: pipelineStages.id });
  return row ?? null;
}

export async function deleteStage(clinicId: string, stageId: string) {
  const db = getDb();
  // First unlink leads from this stage
  await db
    .update(leads)
    .set({ stageId: null, updatedAt: new Date() })
    .where(and(eq(leads.stageId, stageId), eq(leads.clinicId, clinicId)));

  const [row] = await db
    .delete(pipelineStages)
    .where(
      and(eq(pipelineStages.id, stageId), eq(pipelineStages.clinicId, clinicId)),
    )
    .returning({ id: pipelineStages.id });
  return row ?? null;
}

export async function reorderStages(
  clinicId: string,
  stages: { id: string; position: number }[],
) {
  const db = getDb();
  const results: { id: string }[] = [];
  for (const s of stages) {
    const [row] = await db
    .update(pipelineStages)
    .set({ position: s.position, updatedAt: new Date() })
      .where(
        and(eq(pipelineStages.id, s.id), eq(pipelineStages.clinicId, clinicId)),
      )
      .returning({ id: pipelineStages.id });
    if (row) results.push(row);
  }
  return results;
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
