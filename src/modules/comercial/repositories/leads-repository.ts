/**
 * Comercial module — leads repository.
 *
 * DB operations for the leads table.
 * Handles phone-normalized upsert, lookup, and update.
 */

import { eq, and, sql, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { leads } from '@/modules/comercial/schema/leads';
import { pipelineStages } from '@/modules/comercial/schema/pipeline';

export function normalizePhone(v: string): string {
  return v.replace(/\D/g, '');
}

export async function upsertLeadByPhoneNormalized(input: {
  clinicId: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  source: string;
}) {
  const db = getDb();
  // INSERT with ON CONFLICT using the partial unique index
  const [row] = await db
    .insert(leads)
    .values({
      clinicId: input.clinicId,
      name: input.name,
      phone: input.phone,
      phoneNormalized: input.phoneNormalized,
      source: input.source,
    })
    .onConflictDoUpdate({
      target: [leads.clinicId, leads.phoneNormalized],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      targetWhere: sql`${leads.phoneNormalized} IS NOT NULL AND ${leads.phoneNormalized} <> ''` as any,
      set: {
        name: input.name,
        phone: input.phone,
        source: input.source,
        updatedAt: new Date(),
      },
    })
    .returning({ id: leads.id });

  return { id: row.id };
}

export async function findLeadByIdForClinic(leadId: string, clinicId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.clinicId, clinicId)))
    .limit(1);
  return row ?? null;
}

export async function updateLead(
  leadId: string,
  clinicId: string,
  patch: Partial<{
    name: string;
    phone: string;
    phoneNormalized: string;
    email: string | null;
    source: string;
    status: string;
    score: number;
    temperature: string;
    assignedTo: string | null;
    stageId: string | null;
    patientId: string | null;
    lastContactAt: Date | null;
    nextFollowupAt: Date | null;
    notes: string | null;
    lostReason: string | null;
    lostAt: Date | null;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(leads)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.clinicId, clinicId)))
    .returning({ id: leads.id });

  return row ?? null;
}

export async function findLeadByPhone(phone: string, clinicId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.clinicId, clinicId),
        sql`${leads.phoneNormalized} = ${phone} OR ${leads.phone} = ${phone}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listLeadsByClinic(clinicId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(leads)
    .where(eq(leads.clinicId, clinicId))
    .orderBy(leads.createdAt);
  // Hide soft-merged losers from the default lead list.
  return (rows as Array<{ mergeStatus?: string | null }>).filter(
    (r) => r.mergeStatus == null || r.mergeStatus !== 'merged',
  ) as any;
}

// ─── Owner-bridge helpers (Task 2 — CRM Integration Closure) ────────────────

/**
 * Tag normalization para atualizarTagsLead. Mesmas regras do operacional:
 *  - trim em cada item
 *  - descarta vazio após trim
 *  - dedup case-insensitive preservando primeira ocorrência
 * Ex.: [' VIP ','vip','','Lead'] → ['VIP','Lead']
 */
export function normalizeLeadTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/**
 * Atualiza SOMENTE as tags do lead, com predicate ownerId+clinicId.
 * Retorna null se o lead não pertence à clínica (cross-tenant → not_found).
 */
export async function updateLeadTags(
  leadId: string,
  clinicId: string,
  tags: string[],
) {
  const db = getDb();
  const [row] = await db
    .update(leads)
    .set({ tags, updatedAt: new Date() })
    .where(and(eq(leads.id, leadId), eq(leads.clinicId, clinicId)))
    .returning({ id: leads.id });
  return row ?? null;
}

// ─── Kanban / Stage-joined queries ──────────────────────────────────────────────

export async function listAllLeadsWithStage(clinicId: string, stageId?: string) {
  const db = getDb();
  const conditions = [eq(leads.clinicId, clinicId)];
  if (stageId) conditions.push(eq(leads.stageId, stageId));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await db
    .select()
    .from(leads)
    .leftJoin(pipelineStages, eq(leads.stageId, pipelineStages.id))
    .where(and(...conditions))
    .orderBy(desc(leads.score)) as any[];

  return rows.map((r: { leads: Record<string, unknown>; pipeline_stages: Record<string, unknown> | null }) => ({
    id: r.leads.id,
    name: r.leads.name,
    phone: r.leads.phone,
    email: r.leads.email,
    source: r.leads.source,
    temperature: r.leads.temperature,
    score: r.leads.score,
    stage_id: r.leads.stageId,
    interest: r.leads.interest,
    last_contact_at: r.leads.lastContactAt ? new Date(r.leads.lastContactAt as string).toISOString() : null,
    created_at: r.leads.createdAt ? new Date(r.leads.createdAt as string).toISOString() : null,
    updated_at: r.leads.updatedAt ? new Date(r.leads.updatedAt as string).toISOString() : null,
    pipeline_stages: r.pipeline_stages
      ? { id: r.pipeline_stages.id, name: r.pipeline_stages.name, color: r.pipeline_stages.color, sort_order: r.pipeline_stages.position }
      : null,
  }));
}

// ─── Merge helpers ──────────────────────────────────────────────────────────

import { leadActivities, tasks } from '@/modules/comercial/schema';
import { budgets, gatewayRoutingRules } from '@/lib/db/schema';

export async function mergeLeads(
  winnerId: string,
  loserId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();

  const winner = await findLeadByIdForClinic(winnerId, clinicId);
  const loser = await findLeadByIdForClinic(loserId, clinicId);
  if (!winner || !loser) return false;
  if (loser.convertedAt) return false;

  await db.transaction(async (tx) => {
    // Move activities to winner
    await tx.update(leadActivities)
      .set({ leadId: winnerId } as any)
      .where(eq(leadActivities.leadId, loserId));

    // Move tasks to winner
    await tx.update(tasks)
      .set({ leadId: winnerId } as any)
      .where(eq(tasks.leadId, loserId));

    // Repoint external FKs
    await tx.update(budgets)
      .set({ leadId: winnerId } as any)
      .where(and(eq(budgets.leadId, loserId), eq(budgets.clinicId, clinicId)));
    await tx.update(budgets)
      .set({ convertedFromLeadId: winnerId } as any)
      .where(and(eq(budgets.convertedFromLeadId, loserId), eq(budgets.clinicId, clinicId)));
    await tx.update(gatewayRoutingRules)
      .set({ leadId: winnerId } as any)
      .where(and(eq(gatewayRoutingRules.leadId, loserId), eq(gatewayRoutingRules.clinicId, clinicId)));

    // Soft-merge loser
    await tx.update(leads)
      .set({
        mergeStatus: 'merged',
        mergedIntoId: winnerId,
        mergedAt: new Date(),
        status: 'lost',
        lostReason: 'merged_duplicate',
        phoneNormalized: null,
        updatedAt: new Date(),
      } as any)
      .where(eq(leads.id, loserId));
  });

  return true;
}
