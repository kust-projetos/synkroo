import { eq, and, asc } from 'drizzle-orm';
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

export async function findById(id: string) {
  const db = getDb();
  const rows = await db.select().from(procedures).where(eq(procedures.id, id)).limit(1);
  return rows[0] || null;
}

export async function findByClinic(clinicId: string, opts?: { activeOnly?: boolean }) {
  const db = getDb();
  const conditions = [eq(procedures.clinicId, clinicId)];
  if (opts?.activeOnly) conditions.push(eq(procedures.isActive, true));
  return db.select().from(procedures).where(and(...conditions)).orderBy(asc(procedures.name));
}

export async function create(data: { clinicId: string; name: string; description?: string | null; durationMinutes?: number; price?: string; category?: string | null; isActive?: boolean }) {
  const db = getDb();
  const [row] = await db.insert(procedures).values(data).returning();
  return row;
}

export async function update(id: string, data: Partial<{ name: string; description: string | null; durationMinutes: number; price: string; category: string | null; isActive: boolean }>) {
  const db = getDb();
  const [row] = await db.update(procedures).set(data).where(eq(procedures.id, id)).returning();
  return row;
}

export async function remove(id: string) {
  const db = getDb();
  await db.update(procedures).set({ deletedAt: new Date() }).where(eq(procedures.id, id));
}
