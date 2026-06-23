/**
 * Operacional module — patients repository.
 *
 * Port of patient CRUD from src/repositories/patients/,
 * adapted to use module schemas (@/modules/operacional/schema).
 */

import { eq, and, like, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { patients } from '@/modules/operacional/schema/patients';

// ─── Normalizers ─────────────────────────────────────────────────────────────

export function normalizePhone(v: string): string {
  return v.replace(/\D/g, '');
}

export function normalizeCpf(v: string): string {
  return v.replace(/\D/g, '');
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
    .select({ id: patients.id })
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
  const conditions = [eq(patients.clinicId, clinicId), sql`${patients.deletedAt} IS NULL`];
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = await db.insert(patients).values(input as any).returning({ id: patients.id });
  return { id: row.id };
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = await db
    .update(patients)
    .set({ ...patch, updatedAt: new Date() } as any)
    .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)))
    .returning({ id: patients.id });
  return row ?? null;
}
