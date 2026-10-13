import { eq, and, desc, asc, sql, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { dentists } from '@/lib/db/schema';

export interface DentistRow {
  id: string;
  clinicId: string;
  name: string;
  phone: string | null;
  email: string | null;
  cro: string | null;
  specialty: string | null;
  isActive: boolean | null;
  workingHours: unknown;
  createdAt: Date | null;
}

/**
 * UNSCOPED read — cross-tenant risk.
 * @deprecated Use `findByIdScoped(id, clinicId)` instead.
 * P1: clinicId must come from trusted auth context.
 */
export async function findById(id: string): Promise<DentistRow | null> {
  const db = getDb();
  const rows = await db.select().from(dentists).where(eq(dentists.id, id)).limit(1);
  return rows[0] || null;
}

/**
 * Tenant-scoped read by id. Returns null when the id does not belong to
 * the given clinic (no cross-tenant leak).
 * P1: clinicId must come from trusted auth context.
 */
export async function findByIdScoped(id: string, clinicId: string): Promise<DentistRow | null> {
  const db = getDb();
  const rows = await db.select().from(dentists).where(and(eq(dentists.id, id), eq(dentists.clinicId, clinicId))).limit(1);
  return rows[0] || null;
}

export async function findByClinic(clinicId: string, opts?: { activeOnly?: boolean }): Promise<DentistRow[]> {
  const db = getDb();
  const conditions = [eq(dentists.clinicId, clinicId), isNull(dentists.deletedAt)];
  if (opts?.activeOnly) conditions.push(eq(dentists.isActive, true));
  return db.select().from(dentists).where(and(...conditions)).orderBy(asc(dentists.name));
}

export async function create(data: { clinicId: string; name: string; phone?: string | null; email?: string | null; specialty?: string | null; cro?: string | null; isActive?: boolean; workingHours?: unknown }) {
  const db = getDb();
  const [row] = await db.insert(dentists).values(data).returning();
  return row;
}

/**
 * UNSCOPED write — cross-tenant risk.
 * @deprecated Use `updateScoped(id, clinicId, data)` instead.
 * P1: clinicId must come from trusted auth context.
 */
export async function update(id: string, data: Partial<{ name: string; phone: string | null; email: string | null; specialty: string | null; cro: string | null; isActive: boolean; workingHours: unknown }>) {
  const db = getDb();
  const [row] = await db.update(dentists).set(data).where(eq(dentists.id, id)).returning();
  console.warn('[P1] dentists.update without clinicId is deprecated; use updateScoped with clinic from auth context');
  return row;
}

/**
 * Update scoped to a clinic. Returns undefined when the id does not belong
 * to the given clinic (no cross-tenant write).
 * P1: clinicId must come from trusted auth context.
 */
export async function updateScoped(id: string, clinicId: string, data: Partial<{ name: string; phone: string | null; email: string | null; specialty: string | null; cro: string | null; isActive: boolean; workingHours: unknown }>) {
  const db = getDb();
  const [row] = await db.update(dentists).set(data).where(and(eq(dentists.id, id), eq(dentists.clinicId, clinicId))).returning();
  return row;
}

/**
 * UNSCOPED soft-delete — cross-tenant risk.
 * @deprecated Use `removeScoped(id, clinicId)` instead.
 * P1: clinicId must come from trusted auth context.
 */
export async function remove(id: string) {
  const db = getDb();
  await db.update(dentists).set({ deletedAt: new Date() }).where(eq(dentists.id, id));
  console.warn('[P1] dentists.remove without clinicId is deprecated; use removeScoped with clinic from auth context');
}

/**
 * Soft-delete scoped to a clinic. No-op when the id does not belong to the
 * given clinic (no cross-tenant write).
 * P1: clinicId must come from trusted auth context.
 */
export async function removeScoped(id: string, clinicId: string) {
  const db = getDb();
  await db.update(dentists).set({ deletedAt: new Date() }).where(and(eq(dentists.id, id), eq(dentists.clinicId, clinicId)));
}
