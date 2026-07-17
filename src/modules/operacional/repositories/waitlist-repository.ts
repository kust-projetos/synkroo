/**
 * Waitlist repository — scoped by clinicId.
 * Uses operational schema.
 */

import { getDb } from '@/lib/db/client';
import { waitlist } from '../schema/appointments';
import { eq, and, isNull, gte, lte, desc } from 'drizzle-orm';

export async function findWaitlistById(id: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(waitlist)
    .where(and(eq(waitlist.id, id), isNull(waitlist.scheduledAppointmentId)))
    .limit(1);
  return row ?? null;
}

export async function listWaitlist(clinicId: string, opts?: {
  date?: string;
  status?: string;
  patientId?: string;
}) {
  const db = getDb();
  const conditions: ReturnType<typeof eq>[] = [
    eq(waitlist.clinicId, clinicId),
    isNull(waitlist.scheduledAppointmentId),
  ];
  if (opts?.status) conditions.push(eq(waitlist.status, opts.status));
  if (opts?.patientId) conditions.push(eq(waitlist.patientId, opts.patientId));
  return db
    .select()
    .from(waitlist)
    .where(and(...conditions))
    .orderBy(desc(waitlist.createdAt));
}

export async function insertWaitlist(data: {
  clinicId: string;
  patientId: string;
  dentistId?: string;
  preferredDate?: string;
  preferredTimeStart?: string;
  preferredTimeEnd?: string;
  priority?: number;
  notes?: string;
  procedureId?: string;
  status?: string;
}) {
  const db = getDb();
  const [row] = await db.insert(waitlist).values({
    clinicId: data.clinicId,
    patientId: data.patientId,
    dentistId: data.dentistId ?? null,
    preferredDate: data.preferredDate ? new Date(data.preferredDate) : null,
    preferredTimeStart: data.preferredTimeStart ?? null,
    preferredTimeEnd: data.preferredTimeEnd ?? null,
    priority: data.priority ?? 0,
    notes: data.notes ?? null,
    procedureId: data.procedureId ?? null,
    status: data.status ?? 'waiting',
  }).returning();
  return row;
}

export async function updateWaitlist(
  id: string,
  data: Partial<{
    status: string;
    priority: number;
    notes: string;
    notifiedAt: Date;
    scheduledAppointmentId: string;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(waitlist)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(waitlist.id, id))
    .returning();
  return row ?? null;
}

export async function cancelWaitlistEntry(id: string, reason?: string) {
  return updateWaitlist(id, { status: 'cancelled' });
}
