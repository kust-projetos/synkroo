import { eq, and, asc, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { procedures } from '@/lib/db/schema';

export interface ProcedureRow {
  id: string;
  clinicId: string;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  price: string | null;
  category: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
}

/**
 * UNSCOPED read — cross-tenant risk.
 * @deprecated Use `findByIdScoped(id, clinicId)` instead.
 * P1: clinicId must come from trusted auth context.
 */
export async function findById(id: string) {
  const db = getDb();
  const rows = await db.select().from(procedures).where(eq(procedures.id, id)).limit(1);
  return rows[0] || null;
}

/**
 * Tenant-scoped read by id. Returns null when the id does not belong to
 * the given clinic (no cross-tenant leak).
 * P1: clinicId must come from trusted auth context.
 */
export async function findByIdScoped(id: string, clinicId: string) {
  const db = getDb();
  const rows = await db.select().from(procedures).where(and(eq(procedures.id, id), eq(procedures.clinicId, clinicId))).limit(1);
  return rows[0] || null;
}

export async function findByClinic(clinicId: string, opts?: { activeOnly?: boolean }) {
  const db = getDb();
  const conditions = [eq(procedures.clinicId, clinicId), isNull(procedures.deletedAt)];
  if (opts?.activeOnly) conditions.push(eq(procedures.isActive, true));
  return db.select().from(procedures).where(and(...conditions)).orderBy(asc(procedures.name));
}

export async function create(data: { clinicId: string; name: string; description?: string | null; durationMinutes?: number; price?: string; category?: string | null; isActive?: boolean }) {
  const db = getDb();
  const [row] = await db.insert(procedures).values(data).returning();
  return row;
}

/**
 * UNSCOPED write — cross-tenant risk.
 * @deprecated Use `updateScoped(id, clinicId, data)` instead.
 * P1: clinicId must come from trusted auth context.
 */
export async function update(id: string, data: Partial<{ name: string; description: string | null; durationMinutes: number; price: string; category: string | null; isActive: boolean }>) {
  const db = getDb();
  const [row] = await db.update(procedures).set(data).where(eq(procedures.id, id)).returning();
  console.warn('[P1] procedures.update without clinicId is deprecated; use updateScoped with clinic from auth context');
  return row;
}

/**
 * Update scoped to a clinic. Returns undefined when the id does not belong
 * to the given clinic (no cross-tenant write).
 * P1: clinicId must come from trusted auth context.
 */
export async function updateScoped(id: string, clinicId: string, data: Partial<{ name: string; description: string | null; durationMinutes: number; price: string; category: string | null; isActive: boolean }>) {
  const db = getDb();
  const [row] = await db.update(procedures).set(data).where(and(eq(procedures.id, id), eq(procedures.clinicId, clinicId))).returning();
  return row;
}

/**
 * UNSCOPED soft-delete — cross-tenant risk.
 * @deprecated Use `removeScoped(id, clinicId)` instead.
 * P1: clinicId must come from trusted auth context.
 */
export async function remove(id: string) {
  const db = getDb();
  await db.update(procedures).set({ deletedAt: new Date() }).where(eq(procedures.id, id));
  console.warn('[P1] procedures.remove without clinicId is deprecated; use removeScoped with clinic from auth context');
}

/**
 * Soft-delete scoped to a clinic. No-op when the id does not belong to the
 * given clinic (no cross-tenant write).
 * P1: clinicId must come from trusted auth context.
 */
export async function removeScoped(id: string, clinicId: string) {
  const db = getDb();
  await db.update(procedures).set({ deletedAt: new Date() }).where(and(eq(procedures.id, id), eq(procedures.clinicId, clinicId)));
}
