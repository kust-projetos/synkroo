/**
 * Waitlist repository — scoped by clinicId.
 * Uses operational schema.
 */

import { getDb } from '@/lib/db/client';
import { waitlist, appointments } from '../schema/appointments';
import { eq, and, isNull, gte, lte, desc, asc } from 'drizzle-orm';
import { ActionError } from '@/core/actions/types';

export async function findWaitlistById(id: string, clinicId?: string) {
  const db = getDb();
  const conditions = [eq(waitlist.id, id)];
  if (clinicId) {
    conditions.push(eq(waitlist.clinicId, clinicId));
  }
  const [row] = await db
    .select()
    .from(waitlist)
    .where(and(...conditions))
    .limit(1);
  return row ?? null;
}

export async function listWaitlist(
  clinicId: string,
  opts?: {
    date?: string;
    status?: string;
    patientId?: string;
    dentistId?: string;
    includeScheduled?: boolean;
  },
) {
  const db = getDb();
  const conditions: any[] = [eq(waitlist.clinicId, clinicId)];

  if (!opts?.includeScheduled && !opts?.status) {
    conditions.push(isNull(waitlist.scheduledAppointmentId));
  }
  if (opts?.status) conditions.push(eq(waitlist.status, opts.status));
  if (opts?.patientId) conditions.push(eq(waitlist.patientId, opts.patientId));
  if (opts?.dentistId) conditions.push(eq(waitlist.dentistId, opts.dentistId));
  if (opts?.date) {
    conditions.push(eq(waitlist.preferredDate, new Date(opts.date + 'T00:00:00Z')));
  }

  return db
    .select()
    .from(waitlist)
    .where(and(...conditions))
    .orderBy(desc(waitlist.priority), asc(waitlist.createdAt));
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
  const [row] = await db
    .insert(waitlist)
    .values({
      clinicId: data.clinicId,
      patientId: data.patientId,
      dentistId: data.dentistId ?? null,
      preferredDate: data.preferredDate ? new Date(data.preferredDate + (data.preferredDate.includes('T') ? '' : 'T00:00:00Z')) : null,
      preferredTimeStart: data.preferredTimeStart ?? null,
      preferredTimeEnd: data.preferredTimeEnd ?? null,
      priority: data.priority ?? 0,
      notes: data.notes ?? null,
      procedureId: data.procedureId ?? null,
      status: data.status ?? 'waiting',
    })
    .returning();
  return row;
}

export async function updateWaitlist(
  id: string,
  data: Partial<{
    status: string;
    priority: number;
    notes: string | null;
    preferredDate: Date | null;
    preferredTimeStart: string | null;
    preferredTimeEnd: string | null;
    dentistId: string | null;
    procedureId: string | null;
    notifiedAt: Date | null;
    scheduledAppointmentId: string | null;
  }>,
) {
  const db = getDb();
  const [row] = await db
    .update(waitlist)
    .set({ ...data, updatedAt: new Date() } as any)
    .where(eq(waitlist.id, id))
    .returning();
  return row ?? null;
}

export async function cancelWaitlistEntry(id: string, reason?: string) {
  const db = getDb();
  const [row] = await db
    .update(waitlist)
    .set({
      status: 'cancelled',
      notes: reason !== undefined ? reason : undefined,
      updatedAt: new Date(),
    } as any)
    .where(eq(waitlist.id, id))
    .returning();
  return row ?? null;
}

export interface PreencherVagaInput {
  waitlistId: string;
  scheduledAt: Date;
  durationMinutes?: number;
  dentistId?: string;
  procedureId?: string;
  notes?: string;
}

export interface PreencherVagaResult {
  id: string; // appointment id
  waitlistId: string;
  alreadyScheduled: boolean;
}

/**
 * Idempotent slot filling from waitlist using SELECT ... FOR UPDATE transaction.
 */
export async function preencherVagaWaitlist(
  clinicId: string,
  input: PreencherVagaInput,
): Promise<PreencherVagaResult> {
  const db = getDb();

  return db.transaction(async (tx: any) => {
    // 1. Lock the waitlist row with FOR UPDATE
    const [entry] = await tx
      .select()
      .from(waitlist)
      .where(and(eq(waitlist.id, input.waitlistId), eq(waitlist.clinicId, clinicId)))
      .for('update');

    if (!entry) {
      throw new ActionError('not_found', 'Entrada da waitlist não encontrada.');
    }

    // 2. Idempotency: if already scheduled, return the existing appointment ID
    if (entry.status === 'scheduled' && entry.scheduledAppointmentId) {
      return {
        id: entry.scheduledAppointmentId,
        waitlistId: entry.id,
        alreadyScheduled: true,
      };
    }

    // 3. Reject invalid state (cancelled, expired)
    if (entry.status === 'cancelled' || entry.status === 'expired') {
      throw new ActionError('conflict', `Entrada da waitlist está com status '${entry.status}'.`);
    }

    const finalDentistId = input.dentistId ?? entry.dentistId ?? null;
    const finalProcedureId = input.procedureId ?? entry.procedureId ?? null;
    const durationMinutes = input.durationMinutes ?? 30;

    // 4. Insert appointment inside transaction
    const [appt] = await tx
      .insert(appointments)
      .values({
        clinicId,
        patientId: entry.patientId,
        dentistId: finalDentistId,
        procedureId: finalProcedureId,
        scheduledAt: input.scheduledAt,
        durationMinutes,
        notes: input.notes ?? entry.notes ?? null,
        status: 'scheduled',
      })
      .returning();

    // 5. Update waitlist entry to scheduled
    await tx
      .update(waitlist)
      .set({
        status: 'scheduled',
        scheduledAppointmentId: appt.id,
        dentistId: finalDentistId,
        procedureId: finalProcedureId,
        updatedAt: new Date(),
      })
      .where(eq(waitlist.id, entry.id));

    return {
      id: appt.id,
      waitlistId: entry.id,
      alreadyScheduled: false,
    };
  });
}
