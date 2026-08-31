/**
 * Operacional module — patients repository.
 *
 * Port of patient CRUD from src/repositories/patients/,
 * adapted to use module schemas (@/modules/operacional/schema).
 */

import { and, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { enqueueOutbox } from '@/lib/outbox/outbox-repository';
import { OUTBOX_OPERATIONS } from '@/lib/outbox/operations';
import { patients, patientObservations, patientPreferences, patientRiskScores, patientFeedback } from '@/modules/operacional/schema/patients';
import { appointments, waitlist } from '@/modules/operacional/schema';
import { treatmentPlans } from '@/modules/operacional/schema/treatments';

// ─── Normalizers ─────────────────────────────────────────────────────────────

export function normalizePhone(v: string): string {
  return v.replace(/\D/g, '');
}

export function normalizeCpf(v: string): string {
  return v.replace(/\D/g, '');
}

/**
 * Tag normalization used by CRM owner-bridge (atualizarTagsPaciente).
 * Regras:
 *  - trim em cada item
 *  - descarta string vazia após trim
 *  - dedup case-insensitive preservando a primeira ocorrência
 * Ex.: [' VIP ','vip','','Lead'] → ['VIP','Lead']
 */
export function normalizeTags(tags: readonly string[]): string[] {
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

async function enqueuePatientChanged(tx: unknown, clinicId: string, patientId: string) {
  await enqueueOutbox(tx, {
    clinicId,
    operation: OUTBOX_OPERATIONS.CRM_CONTACT_CHANGED,
    businessKey: `patient:${patientId}:${globalThis.crypto.randomUUID()}`,
    payload: { ownerType: 'patient', ownerId: patientId },
  });
}

// ─── Query helpers ───────────────────────────────────────────────────────────

export async function findById(clinicId: string, id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findByPhone(clinicId: string, phone: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.phone, phone)))
    .limit(1);
  return row ?? null;
}

export async function findByCpf(clinicId: string, cpf: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.clinicId, clinicId), eq(patients.cpf, cpf)))
    .limit(1);
  return row ?? null;
}

export async function listPatients(clinicId: string, opts?: { search?: string; limit?: number; offset?: number }) {
  const db = getDb();
  const conditions = [
    eq(patients.clinicId, clinicId),
    sql`${patients.deletedAt} IS NULL`,
    // Hide soft-merged losers at the DB level so the SELECT projection
    // (and the API response contract) stays unchanged.
    sql`${patients.mergeStatus} IS NULL OR ${patients.mergeStatus} <> 'merged'`,
  ];
  if (opts?.search) {
    conditions.push(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sql`${patients.name} ILIKE ${'%' + opts.search + '%'}` as any,
    );
  }
  return db
    .select({
      id: patients.id,
      clinicId: patients.clinicId,
      name: patients.name,
      phone: patients.phone,
      email: patients.email,
      cpf: patients.cpf,
      birthDate: patients.birthDate,
      gender: patients.gender,
      notes: patients.notes,
      tags: patients.tags,
      status: patients.status,
      riskScore: patients.riskScore,
      lastVisitAt: patients.lastVisitAt,
      createdAt: patients.createdAt,
      updatedAt: patients.updatedAt,
    })
    .from(patients)
    .where(and(...conditions))
    .orderBy(patients.name)
    .limit(opts?.limit ?? 50)
    .offset(opts?.offset ?? 0);
}

// ─── Mutation helpers ─────────────────────────────────────────────────────────

export async function insertPatient(input: {
  clinicId: string;
  name: string;
  phone: string;
  cpf?: string | null;
  email?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  notes?: string | null;
}) {
  const db = getDb();
  return db.transaction(async (tx: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [row] = await tx.insert(patients).values(input as any).returning({ id: patients.id });
    await enqueuePatientChanged(tx, input.clinicId, row.id);
    return { id: row.id };
  });
}

export async function updatePatient(
  clinicId: string,
  id: string,
  patch: {
    name?: string;
    phone?: string;
    email?: string | null;
    cpf?: string | null;
    notes?: string | null;
    tags?: string[];
  },
) {
  const db = getDb();
  return db.transaction(async (tx: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [row] = await tx
      .update(patients)
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)))
      .returning({ id: patients.id });
    if (!row) return null;
    await enqueuePatientChanged(tx, clinicId, row.id);
    return row;
  });
}

// ─── Owner-bridge helpers (Task 2 — CRM Integration Closure) ────────────────

/**
 * Insere uma observação clínica do paciente com predicate ownerId+clinicId.
 * Caller deve ter verificado findById(clinicId, patientId) antes para obter
 * erro semântico de not_found; aqui o predicate na tabela garante isolamento
 * mesmo se um id estrangeiro escorregar.
 */
export async function insertPatientObservation(input: {
  clinicId: string;
  patientId: string;
  content: string;
  createdBy: string | null;
}) {
  const db = getDb();
  const [row] = await db
    .insert(patientObservations)
    .values({
      clinicId: input.clinicId,
      patientId: input.patientId,
      content: input.content,
      createdBy: input.createdBy,
    })
    .returning({ id: patientObservations.id });
  return { id: row.id };
}

/**
 * Atualiza SOMENTE o array de tags do paciente, com predicate owner+clinic.
 * Retorna null se a linha não pertence à clínica (cross-tenant → not_found).
 */
export async function updatePatientTags(
  clinicId: string,
  patientId: string,
  tags: string[],
) {
  const db = getDb();
  return db.transaction(async (tx: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [row] = await tx
      .update(patients)
      .set({ tags, updatedAt: new Date() } as any)
      .where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
      .returning({ id: patients.id });
    if (!row) return null;
    await enqueuePatientChanged(tx, clinicId, row.id);
    return row;
  });
}

// ─── Merge helpers ──────────────────────────────────────────────────────────

export async function updatePatientLastVisit(clinicId: string, patientId: string, at: Date) {
  const db = getDb();
  await db.update(patients).set({ lastVisitAt: at, updatedAt: new Date() } as any).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)));
}

export async function mergePatients(
  winnerId: string,
  loserId: string,
  clinicId: string,
): Promise<boolean> {
  const db = getDb();

  const winner = await findById(clinicId, winnerId);
  const loser = await findById(clinicId, loserId);
  if (!winner || !loser) return false;

  await db.transaction(async (tx) => {
    await tx.update(appointments)
      .set({ patientId: winnerId } as any)
      .where(and(eq(appointments.patientId, loserId), eq(appointments.clinicId, clinicId)));
    await tx.update(waitlist)
      .set({ patientId: winnerId } as any)
      .where(and(eq(waitlist.patientId, loserId), eq(waitlist.clinicId, clinicId)));
    await tx.update(patientObservations)
      .set({ patientId: winnerId } as any)
      .where(and(eq(patientObservations.patientId, loserId), eq(patientObservations.clinicId, clinicId)));
    await tx.update(patientPreferences)
      .set({ patientId: winnerId } as any)
      .where(eq(patientPreferences.patientId, loserId));
    await tx.update(patientRiskScores)
      .set({ patientId: winnerId } as any)
      .where(eq(patientRiskScores.patientId, loserId));
    await tx.update(patientFeedback)
      .set({ patientId: winnerId } as any)
      .where(and(eq(patientFeedback.patientId, loserId), eq(patientFeedback.clinicId, clinicId)));
    await tx.update(treatmentPlans)
      .set({ patientId: winnerId } as any)
      .where(eq(treatmentPlans.patientId, loserId));

    // Fill loser gaps into winner
    const gapFill: Record<string, unknown> = {};
    if (loser.phone && !winner.phone) gapFill.phone = loser.phone;
    if (loser.email && !winner.email) gapFill.email = loser.email;
    if (loser.cpf && !winner.cpf) gapFill.cpf = loser.cpf;
    if (loser.birthDate && !winner.birthDate) gapFill.birthDate = loser.birthDate;
    if (loser.gender && !winner.gender) gapFill.gender = loser.gender;
    if (loser.address && (!winner.address || Object.keys(winner.address).length === 0)) gapFill.address = loser.address;
    if (loser.notes && !winner.notes) gapFill.notes = loser.notes;
    if (Object.keys(gapFill).length > 0) {
      await tx.update(patients)
        .set({ ...gapFill, updatedAt: new Date() } as any)
        .where(eq(patients.id, winnerId));
    }

    // Soft-merge the loser record
    await tx.update(patients)
      .set({
        mergeStatus: 'merged',
        mergedIntoId: winnerId,
        mergedAt: new Date(),
        updatedAt: new Date(),
      } as any)
      .where(eq(patients.id, loserId));

    await enqueuePatientChanged(tx, clinicId, winnerId);
  });

  return true;
}
