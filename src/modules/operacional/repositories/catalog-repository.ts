/**
 * Catalog repository — dentists & procedures.
 * All queries scoped by clinicId.
 */

import { getDb } from '@/lib/db/client';
import { dentists, procedures } from '../schema/clinical';
import { eq, and, isNull, or } from 'drizzle-orm';

// ─── Dentists ────────────────────────────────────────────────────────────────

export async function findDentistById(clinicId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(dentists)
    .where(and(eq(dentists.clinicId, clinicId), eq(dentists.id, id), isNull(dentists.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listDentists(clinicId: string, opts?: { activeOnly?: boolean }) {
  const db = getDb();
  const conditions = [eq(dentists.clinicId, clinicId), isNull(dentists.deletedAt)];
  if (opts?.activeOnly) conditions.push(eq(dentists.isActive, true));
  return db.select().from(dentists).where(and(...conditions));
}

export async function insertDentist(data: {
  clinicId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  specialty?: string | null;
  cro?: string | null;
  isActive?: boolean;
}) {
  const db = getDb();
  const [row] = await db.insert(dentists).values(data).returning();
  return row;
}

export async function updateDentist(
  id: string,
  data: Partial<{
    name: string;
    phone: string | null;
    email: string | null;
    specialty: string | null;
    cro: string | null;
    isActive: boolean;
    workingHours: unknown;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(dentists)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(dentists.id, id), isNull(dentists.deletedAt)))
    .returning();
  return row ?? null;
}

// ─── Procedures ─────────────────────────────────────────────────────────────

export async function findProcedureById(clinicId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(procedures)
    .where(and(eq(procedures.clinicId, clinicId), eq(procedures.id, id), isNull(procedures.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listProcedures(clinicId: string, opts?: { activeOnly?: boolean }) {
  const db = getDb();
  const conditions = [eq(procedures.clinicId, clinicId), isNull(procedures.deletedAt)];
  if (opts?.activeOnly) conditions.push(eq(procedures.isActive, true));
  return db.select().from(procedures).where(and(...conditions));
}

export async function insertProcedure(data: {
  clinicId: string;
  name: string;
  description?: string | null;
  durationMinutes?: number;
  price?: string;
  category?: string | null;
  isActive?: boolean;
}) {
  const db = getDb();
  const [row] = await db.insert(procedures).values(data).returning();
  return row;
}

export async function updateProcedure(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    durationMinutes: number;
    price: string;
    category: string | null;
    isActive: boolean;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(procedures)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(procedures.id, id), isNull(procedures.deletedAt)))
    .returning();
  return row ?? null;
}
