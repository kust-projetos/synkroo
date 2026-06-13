import { eq, and, desc, asc, sql } from 'drizzle-orm';
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

export async function findById(id: string): Promise<DentistRow | null> {
  const db = getDb();
  const rows = await db.select().from(dentists).where(eq(dentists.id, id)).limit(1);
  return rows[0] || null;
}

export async function findByClinic(clinicId: string, opts?: { activeOnly?: boolean }): Promise<DentistRow[]> {
  const db = getDb();
  const conditions = [eq(dentists.clinicId, clinicId)];
  if (opts?.activeOnly) conditions.push(eq(dentists.isActive, true));
  return db.select().from(dentists).where(and(...conditions)).orderBy(asc(dentists.name));
}

export async function create(data: { clinicId: string; name: string; phone?: string | null; email?: string | null; specialty?: string | null; cro?: string | null; isActive?: boolean; workingHours?: unknown }) {
  const db = getDb();
  const [row] = await db.insert(dentists).values(data).returning();
  return row;
}

export async function update(id: string, data: Partial<{ name: string; phone: string | null; email: string | null; specialty: string | null; cro: string | null; isActive: boolean; workingHours: unknown }>) {
  const db = getDb();
  const [row] = await db.update(dentists).set(data).where(eq(dentists.id, id)).returning();
  return row;
}

export async function remove(id: string) {
  const db = getDb();
  await db.update(dentists).set({ deletedAt: new Date() }).where(eq(dentists.id, id));
}
