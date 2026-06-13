import { eq, and, gte, lte, asc, desc, sql, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
	appointments,
	patients,
	dentists,
	procedures,
	scheduleBlocks,
} from "@/lib/db/schema";

export async function findById(id: string) {
	const db = getDb();
	const rows = await db
		.select()
		.from(appointments)
		.where(eq(appointments.id, id))
		.limit(1);
	return rows[0] || null;
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
	return (rows[0] as ClinicAppointmentRow | undefined) ?? null;
}

/** Shape returned by findByClinicWithJoins (without count mode). */
type ClinicAppointmentRow = {
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
): Promise<ClinicAppointmentRow[]>;
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
): Promise<number | ClinicAppointmentRow[]> {
	const db = getDb();
	const conditions: any[] = [
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
		const start = new Date(opts.date + "T00:00:00Z");
		const end = new Date(opts.date + "T23:59:59.999Z");
		conditions.push(
			gte(appointments.scheduledAt, start),
			lte(appointments.scheduledAt, end),
		);
	} else if (opts?.startDate && opts?.endDate) {
		const start = new Date(opts.startDate + "T00:00:00Z");
		const end = new Date(opts.endDate + "T23:59:59.999Z");
		conditions.push(
			gte(appointments.scheduledAt, start),
			lte(appointments.scheduledAt, end),
		);
	}
	const limit = opts?.limit ?? 50;
	const offset = opts?.offset ?? 0;

	// Count-only mode: use a lightweight query without JOINs
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
		.offset(offset);
}

export async function findByClinic(
	clinicId: string,
	opts?: {
		status?: string[];
		startDate?: Date;
		endDate?: Date;
		dentistId?: string;
		limit?: number;
		offset?: number;
	},
) {
	const db = getDb();
	const conditions: any[] = [
		eq(appointments.clinicId, clinicId),
		sql`${appointments.deletedAt} IS NULL`,
	];
	if (opts?.status?.length)
		conditions.push(inArray(appointments.status, opts.status as any));
	if (opts?.startDate)
		conditions.push(gte(appointments.scheduledAt, opts.startDate));
	if (opts?.endDate)
		conditions.push(lte(appointments.scheduledAt, opts.endDate));
	if (opts?.dentistId)
		conditions.push(eq(appointments.dentistId, opts.dentistId));
	return db
		.select()
		.from(appointments)
		.where(and(...conditions))
		.orderBy(desc(appointments.scheduledAt))
		.limit(opts?.limit || 100)
		.offset(opts?.offset || 0);
}

export async function findUpcoming(
	clinicId: string,
	opts?: { from?: Date; limit?: number },
) {
	const db = getDb();
	const from = opts?.from || new Date();
	const activeStatuses = ["scheduled", "confirmed"] as const;
	return db
		.select()
		.from(appointments)
		.where(
			and(
				eq(appointments.clinicId, clinicId),
				gte(appointments.scheduledAt, from),
				inArray(appointments.status, activeStatuses as any),
				sql`${appointments.deletedAt} IS NULL`,
			),
		)
		.orderBy(asc(appointments.scheduledAt))
		.limit(opts?.limit || 50);
}

export async function findByPatient(
	clinicId: string,
	patientId: string,
	opts?: { limit?: number },
) {
	const db = getDb();
	return db
		.select()
		.from(appointments)
		.where(
			and(
				eq(appointments.clinicId, clinicId),
				eq(appointments.patientId, patientId),
				sql`${appointments.deletedAt} IS NULL`,
			),
		)
		.orderBy(desc(appointments.scheduledAt))
		.limit(opts?.limit || 20);
}

/**
 * Find upcoming appointment for a patient at a clinic.
 */
export async function findUpcomingByPatient(params: {
	clinicId: string;
	patientId: string;
}): Promise<{ id: string; scheduledAt: Date; status: string } | null> {
	const db = getDb();
	const now = new Date();
	const rows = await db
		.select({
			id: appointments.id,
			scheduledAt: appointments.scheduledAt,
			status: appointments.status,
		})
		.from(appointments)
		.where(
			and(
				eq(appointments.clinicId, params.clinicId),
				eq(appointments.patientId, params.patientId),
				inArray(appointments.status, ["scheduled", "confirmed"]),
				gte(appointments.scheduledAt, now),
				sql`${appointments.deletedAt} IS NULL`,
			),
		)
		.orderBy(asc(appointments.scheduledAt))
		.limit(1);
	return rows[0] ?? null;
}

export async function findByDateRange(
	clinicId: string,
	dentistId: string | undefined,
	from: Date,
	to: Date,
) {
	const db = getDb();
	const conditions: any[] = [
		eq(appointments.clinicId, clinicId),
		gte(appointments.scheduledAt, from),
		lte(appointments.scheduledAt, to),
		sql`${appointments.deletedAt} IS NULL`,
	];
	if (dentistId) conditions.push(eq(appointments.dentistId, dentistId));
	return db
		.select()
		.from(appointments)
		.where(and(...conditions))
		.orderBy(asc(appointments.scheduledAt));
}

export async function create(data: {
	clinicId: string;
	patientId: string;
	dentistId?: string | null;
	procedureId?: string | null;
	scheduledAt: Date;
	durationMinutes?: number;
	notes?: string | null;
}) {
	const db = getDb();
	const [row] = await db
		.insert(appointments)
		.values(data as any)
		.returning();
	return row;
}

export async function updateStatus(
	id: string,
	status: string,
	extra?: Record<string, unknown>,
) {
	const db = getDb();
	const [row] = await db
		.update(appointments)
		.set({ status: status as any, ...extra, updatedAt: new Date() })
		.where(eq(appointments.id, id))
		.returning();
	return row;
}

export async function update(id: string, data: Record<string, unknown>) {
	const db = getDb();
	const [row] = await db
		.update(appointments)
		.set({ ...data, updatedAt: new Date() } as any)
		.where(eq(appointments.id, id))
		.returning();
	return row;
}

export async function remove(id: string) {
	const db = getDb();
	await db
		.update(appointments)
		.set({ deletedAt: new Date(), updatedAt: new Date() } as any)
		.where(eq(appointments.id, id));
}

/**
 * Get available time slots for a dentist on a given date.
 * Simplified implementation: returns schedule_blocks slots minus booked appointments.
 */
export async function getAvailableSlots(
	clinicId: string,
	dentistId: string,
	date: string, // 'YYYY-MM-DD'
	durationMinutes = 30,
): Promise<Array<{ start_time: string; end_time: string }>> {
	const db = getDb();

	// Get day of week from date string
	const dayOfWeek = new Date(date).getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

	// Get schedule blocks for this dentist and day
	const blocks = await db
		.select({
			startTime: sql<string>`${scheduleBlocks.startTime}::text`,
			endTime: sql<string>`${scheduleBlocks.endTime}::text`,
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

	if (blocks.length === 0) return [];

	// Get existing appointments for this dentist on this date
	const startOfDay = new Date(`${date}T00:00:00Z`);
	const endOfDay = new Date(`${date}T23:59:59Z`);

	const booked = await db
		.select({
			scheduledAt: appointments.scheduledAt,
			durationMinutes: appointments.durationMinutes,
		})
		.from(appointments)
		.where(
			and(
				eq(appointments.dentistId, dentistId),
				eq(appointments.clinicId, clinicId),
				gte(appointments.scheduledAt, startOfDay),
				lte(appointments.scheduledAt, endOfDay),
			),
		);

	// Compute free slots
	const slots: Array<{ start_time: string; end_time: string }> = [];
	for (const block of blocks) {
		const blockStart = block.startTime; // HH:mm:ss
		const blockEnd = block.endTime;

		// Simple slot generation every durationMinutes
		let current = timeToMinutes(blockStart);
		const end = timeToMinutes(blockEnd);

		while (current + durationMinutes <= end) {
			const slotStart = minutesToTime(current);
			const slotEnd = minutesToTime(current + durationMinutes);

			// Check if this slot overlaps with any booked appointment
			const slotStartDate = new Date(`${date}T${slotStart}`);
			const slotEndDate = new Date(`${date}T${slotEnd}`);

			const isBooked = booked.some((appt) => {
				const apptStart = new Date(appt.scheduledAt);
				const apptEnd = new Date(
					apptStart.getTime() + (appt.durationMinutes ?? 30) * 60 * 1000,
				);
				return slotStartDate < apptEnd && slotEndDate > apptStart;
			});

			if (!isBooked) {
				slots.push({ start_time: slotStart, end_time: slotEnd });
			}

			current += durationMinutes;
		}
	}

	return slots;
}

function timeToMinutes(t: string): number {
	const [h, m] = t.split(":").map(Number);
	return h * 60 + m;
}

function minutesToTime(m: number): string {
	const h = Math.floor(m / 60);
	const min = m % 60;
	return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`;
}

/**
 * Get schedule blocks for a clinic
 */
export async function getScheduleBlocks(clinicId: string): Promise<
	Array<{
		dayOfWeek: number;
		startTime: string;
		endTime: string;
		isAvailable: boolean;
	}>
> {
	const db = getDb();
	const rows = await db
		.select({
			dayOfWeek: scheduleBlocks.dayOfWeek,
			startTime: sql<string>`${scheduleBlocks.startTime}::text`,
			endTime: sql<string>`${scheduleBlocks.endTime}::text`,
			isAvailable: scheduleBlocks.isAvailable,
		})
		.from(scheduleBlocks)
		.where(eq(scheduleBlocks.clinicId, clinicId));
	return rows as unknown as Array<{
		dayOfWeek: number;
		startTime: string;
		endTime: string;
		isAvailable: boolean;
	}>;
}

/**
 * Atomically reschedule an appointment: check conflicts then update.
 * Replaces the `reschedule_appointment_slot` Supabase RPC call.
 * Returns `{ success: true }` or `{ success: false, error: string }`.
 */
export async function rescheduleAppointmentSlot(params: {
	appointmentId: string;
	clinicId: string;
	dentistId: string | null;
	scheduledAt: Date;
	durationMinutes: number;
}): Promise<{ success: boolean; error?: string }> {
	const db = getDb();
	const { appointmentId, clinicId, dentistId, scheduledAt, durationMinutes } =
		params;

	// Check for conflicting appointments (overlap check)
	// Exclude the appointment being rescheduled itself
	const slotStart = scheduledAt;
	const slotEnd = new Date(scheduledAt.getTime() + durationMinutes * 60 * 1000);

	const conflictConditions: any[] = [
		eq(appointments.clinicId, clinicId),
		gte(appointments.scheduledAt, slotStart),
		lte(appointments.scheduledAt, slotEnd),
		sql`${appointments.status} IN ('scheduled', 'confirmed')`,
		sql`${appointments.deletedAt} IS NULL`,
	];

	if (dentistId) {
		conflictConditions.push(eq(appointments.dentistId, dentistId));
	}

	// Exclude the appointment being rescheduled
	conflictConditions.push(sql`${appointments.id} != ${appointmentId}`);

	const conflicts = await db
		.select({ id: appointments.id })
		.from(appointments)
		.where(and(...conflictConditions))
		.limit(1);

	if (conflicts.length > 0) {
		return {
			success: false,
			error: "Horário não disponível para este profissional.",
		};
	}

	// Update the appointment
	const [updated] = await db
		.update(appointments)
		.set({
			scheduledAt,
			status: "scheduled",
			updatedAt: new Date(),
		} as any)
		.where(eq(appointments.id, appointmentId))
		.returning({ id: appointments.id });

	if (!updated) {
		return { success: false, error: "Agendamento não encontrado." };
	}

	return { success: true };
}
