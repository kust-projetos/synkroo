/**
 * Comercial module — leads repository.
 *
 * DB operations for the leads table.
 * Handles phone-normalized upsert, lookup, and update.
 */

import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { leads } from '@/modules/comercial/schema/leads';

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

export async function listLeadsByClinic(clinicId: string) {
  const db = getDb();
  return db
    .select()
    .from(leads)
    .where(eq(leads.clinicId, clinicId))
    .orderBy(leads.createdAt);
}
