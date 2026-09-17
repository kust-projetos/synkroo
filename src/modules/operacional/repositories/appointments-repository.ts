/**
 * Operacional module — appointments repository.
 *
 * Port of findByClinicWithJoins and supporting helpers from
 * src/repositories/appointments/index.ts, adapted to use module schemas
 * (@/modules/operacional/schema) instead of the legacy core schema.
 *
 * All other appointment repository functions (create, updateStatus, etc.)
 * remain in src/repositories/appointments/ until migrated.
 */

import { desc, eq, and, gte, isNull, lte, asc, inArray, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  appointments,
  patients,
  dentists,
  procedures,
  scheduleBlocks,
} from '@/modules/operacional/schema';
import type { appointments as AppointmentsTable } from '@/modules/operacional/schema';

/** Shape returned by findByClinicWithJoins. */
export type AppointmentRow = {
  id: string;
  clinicId: string;
  patientId: string;
  dentistId: string | null;
  procedureId: string | null;
  scheduledAt: Date;
  durationMinutes: number | null;
  status: string;
  notes: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  dentist: {
    id: string;
    name: string;
    phone: string | null;
    specialty: string | null;
  } | null;
  procedure: {
    id: string;
    name: string;
    durationMinutes: number | null;
    price: string | null;
    category: string | null;
  } | null;
};

export async function findById(clinicId: string, id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findByIdWithJoins(id: string, clinicId: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
      dentistId: appointments.dentistId,
      procedureId: appointments.procedureId,
      scheduledAt: appointments.scheduledAt,
      durationMinutes: appointments.durationMinutes,
      status: appointments.status,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      patient: {
        id: patients.id,
        name: patients.name,
        phone: patients.phone,
        email: patients.email,
      },
      dentist: {
        id: dentists.id,
        name: dentists.name,
        phone: dentists.phone,
        specialty: dentists.specialty,
      },
      procedure: {
        id: procedures.id,
        name: procedures.name,
        durationMinutes: procedures.durationMinutes,
        price: procedures.price,
        category: procedures.category,
      },
    })
    .from(appointments)
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(dentists, eq(dentists.id, appointments.dentistId))
    .leftJoin(procedures, eq(procedures.id, appointments.procedureId))
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .limit(1);
  return (rows[0] as AppointmentRow | undefined) ?? null;
}

// ──────────────────────────────────────────────
// findByClinicWithJoins — ported faithfully from src/repositories/appointments
// ──────────────────────────────────────────────

export async function findByClinicWithJoins(
  clinicId: string,
  opts: {
    count: true;
    patientId?: string;
    dentistId?: string;
    status?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    dentistIds?: string[];
    limit?: number;
    offset?: number;
  },
): Promise<number>;
export async function findByClinicWithJoins(
  clinicId: string,
  opts?: {
    count?: false;
    patientId?: string;
    dentistId?: string;
    status?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    dentistIds?: string[];
    limit?: number;
    offset?: number;
  },
): Promise<AppointmentRow[]>;
export async function findByClinicWithJoins(
  clinicId: string,
  opts?: {
    patientId?: string;
    dentistId?: string;
    status?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    dentistIds?: string[];
    limit?: number;
    offset?: number;
    count?: boolean;
  },
): Promise<number | AppointmentRow[]> {
  const db = getDb();
  const conditions: Parameters<typeof and>[0][] = [
    eq(appointments.clinicId, clinicId),
    sql`${appointments.deletedAt} IS NULL`,
  ];

  if (opts?.patientId)
    conditions.push(eq(appointments.patientId, opts.patientId));
  if (opts?.dentistId)
    conditions.push(eq(appointments.dentistId, opts.dentistId));
  if (opts?.status)
    conditions.push(eq(appointments.status, opts.status as any));
  if (opts?.dentistIds?.length)
    conditions.push(inArray(appointments.dentistId, opts.dentistIds));

  if (opts?.date) {
    const start = new Date(opts.date + 'T00:00:00Z');
    const end = new Date(opts.date + 'T23:59:59.999Z');
    conditions.push(gte(appointments.scheduledAt, start));
    conditions.push(lte(appointments.scheduledAt, end));
  } else if (opts?.startDate && opts?.endDate) {
    const start = new Date(opts.startDate + 'T00:00:00Z');
    const end = new Date(opts.endDate + 'T23:59:59.999Z');
    conditions.push(gte(appointments.scheduledAt, start));
    conditions.push(lte(appointments.scheduledAt, end));
  }

  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  if (opts?.count) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(appointments)
      .where(and(...conditions));
    return row?.count ?? 0;
  }

  return db
    .select({
      id: appointments.id,
      clinicId: appointments.clinicId,
      patientId: appointments.patientId,
      dentistId: appointments.dentistId,
      procedureId: appointments.procedureId,
      scheduledAt: appointments.scheduledAt,
      durationMinutes: appointments.durationMinutes,
      status: appointments.status,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      patient: {
        id: patients.id,
        name: patients.name,
        phone: patients.phone,
        email: patients.email,
      },
      dentist: {
        id: dentists.id,
        name: dentists.name,
        phone: dentists.phone,
        specialty: dentists.specialty,
      },
      procedure: {
        id: procedures.id,
        name: procedures.name,
        durationMinutes: procedures.durationMinutes,
        price: procedures.price,
        category: procedures.category,
      },
    })
    .from(appointments)
    .leftJoin(patients, eq(patients.id, appointments.patientId))
    .leftJoin(dentists, eq(dentists.id, appointments.dentistId))
    .leftJoin(procedures, eq(procedures.id, appointments.procedureId))
    .where(and(...conditions))
    .orderBy(asc(appointments.scheduledAt))
    .limit(limit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .offset(offset) as any;
}

// ──────────────────────────────────────────────
// Mutation helpers
// ──────────────────────────────────────────────

export async function createAppointment(data: {
  clinicId: string;
  patientId: string;
  dentistId?: string | null;
  procedureId?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string | null;
}) {
  const db = getDb();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [row] = await db.insert(appointments).values(data as any).returning();
    return row;
  } catch (err: any) {
    // Drizzle wraps pg error as `cause`; expose pg code/message in outer message
    // so integration tests matching /23P01|exclusion|overlap/ on `message` still pass.
    const pgCode = err?.cause?.code ?? err?.code;
    const pgMsg = err?.cause?.message ?? '';
    if (pgCode === '23P01' || /exclusion/i.test(pgMsg)) {
      // enrich outer message but keep original error identity and cause
      err.message = `${err.message} [pg:${pgCode} ${pgMsg}]`;
    }
    throw err;
  }
}

export async function setAppointmentStatus(
  id: string,
  status: string,
  extra?: Record<string, unknown>,
) {
  const db = getDb();
  const [row] = await db
    .update(appointments)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .set({ status, ...extra, updatedAt: new Date() } as any)
    .where(eq(appointments.id, id))
    .returning();
  return row;
}

export async function moveAppointment(
  id: string,
  scheduledAt: Date,
  opts?: { dentistId?: string | null; durationMinutes?: number },
) {
  const db = getDb();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [row] = await db
    .update(appointments)
    .set({
      scheduledAt,
      ...(opts?.dentistId !== undefined ? { dentistId: opts.dentistId } : {}),
      ...(opts?.durationMinutes !== undefined ? { durationMinutes: opts.durationMinutes } : {}),
      status: 'scheduled',
      updatedAt: new Date(),
    } as any)
    .where(eq(appointments.id, id))
    .returning();
  return row;
}

// Aliases matching plan service signatures
export async function setStatus(
  clinicId: string,
  id: string,
  status: string,
  extra?: { cancellationReason?: string | null; confirmationSentAt?: Date | null },
) {
  const db = getDb();
  const [row] = await db
    .update(appointments)
    .set({
      status,
      ...extra,
      updatedAt: new Date(),
    } as any)
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .returning();
  return row;
}

export async function moveSlot(
  clinicId: string,
  id: string,
  scheduledAt: Date,
  durationMinutes?: number,
) {
  const db = getDb();
  const [row] = await db
    .update(appointments)
    .set({
      scheduledAt,
      ...(durationMinutes !== undefined ? { durationMinutes } : {}),
      status: 'scheduled',
      updatedAt: new Date(),
    } as any)
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .returning();
  return row;
}

export async function updateAppointment(
  clinicId: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const db = getDb();
  const [row] = await db
    .update(appointments)
    .set({ ...patch, updatedAt: new Date() } as any)
    .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
    .returning();
  return row;
}

/**
 * Idempotency replay lookup: most recent appointment matching the exact
 * creation fingerprint (clinic + patient + dentist + scheduledAt).
 * Usado para devolver o resultado original em retry com a mesma chave.
 */
export async function findByExactSlot(
  clinicId: string,
  patientId: string,
  dentistId: string | null,
  scheduledAt: Date,
) {
  const db = getDb();
  const conditions = [
    eq(appointments.clinicId, clinicId),
    eq(appointments.patientId, patientId),
    dentistId ? eq(appointments.dentistId, dentistId) : isNull(appointments.dentistId),
    eq(appointments.scheduledAt, scheduledAt),
    sql`${appointments.deletedAt} IS NULL`,
  ];
  const rows = await db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(desc(appointments.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Atomic update path (repo-owns-tx): atualiza o agendamento e o last_visit
 * do paciente na MESMA transação — nunca meio-aplicado.
 */
export async function updateAppointmentAndTouchVisit(
  clinicId: string,
  id: string,
  patch: Record<string, unknown>,
  visit: { patientId: string; at: Date } | null,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(appointments)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set({ ...patch, updatedAt: new Date() } as any)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
      .returning();
    if (row && visit) {
      await tx
        .update(patients)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set({ lastVisitAt: visit.at, updatedAt: new Date() } as any)
        .where(and(eq(patients.id, visit.patientId), eq(patients.clinicId, clinicId)));
    }
    return row;
  });
}

// ─── Availability helpers ─────────────────────────────────────────────────────

/**
 * Return booked appointment slots for a dentist within a day window.
 * Status filter: scheduled | confirmed | in_progress (not cancelled/no_show/deleted).
 */
export async function bookedSlots(
  clinicId: string,
  dentistId: string,
  dayStart: Date,
  dayEnd: Date,
) {
  const db = getDb();
  const rows = await db
    .select({
      scheduledAt: appointments.scheduledAt,
      durationMinutes: appointments.durationMinutes,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.clinicId, clinicId),
        eq(appointments.dentistId, dentistId),
        gte(appointments.scheduledAt, dayStart),
        lte(appointments.scheduledAt, dayEnd),
        // Only active statuses — not cancelled, no_show, or soft-deleted
        inArray(appointments.status, ['scheduled', 'confirmed', 'in_progress']),
        sql`${appointments.deletedAt} IS NULL`,
      ),
    );
  return rows;
}

/**
 * Return schedule blocks (available time windows) for a dentist on a given day of week.
 */
export async function getScheduleBlocksForDay(
  clinicId: string,
  dentistId: string,
  dayOfWeek: number,
) {
  const db = getDb();
  const rows = await db
    .select({
      startTime: scheduleBlocks.startTime,
      endTime: scheduleBlocks.endTime,
    })
    .from(scheduleBlocks)
    .where(
      and(
        eq(scheduleBlocks.clinicId, clinicId),
        eq(scheduleBlocks.dentistId, dentistId),
        eq(scheduleBlocks.dayOfWeek, dayOfWeek),
        eq(scheduleBlocks.isAvailable, true),
      ),
    );
  return rows;
}
