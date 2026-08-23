/**
 * Waitlist Repository
 * All DB operations for waitlist table via Drizzle.
 */

import { eq, and, lte, gte, lt, desc, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { waitlist, appointments, patients, dentists, procedures } from "@/lib/db/schema";
import { ActionError } from "@/core/actions/types";

// Infer row type from Drizzle's select to match actual schema columns
export type WaitlistRow = {
	id: string;
	clinicId: string;
	patientId: string;
	dentistId: string | null;
	procedureId: string | null;
	preferredDate: Date | null;
	preferredTimeStart: string | null;
	preferredTimeEnd: string | null;
	priority: number | null;
	notes: string | null;
	status: string | null;
	notifiedAt: Date | null;
	scheduledAppointmentId: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
	patients?: {
		name: string;
		phone: string;
	} | null;
	dentists?: {
		name: string;
	} | null;
	procedures?: {
		name: string;
	} | null;
};

// ─── Find by ID (with joins) ──────────────────────────────────────────────────

export async function findById(
	id: string,
	clinicId?: string,
): Promise<WaitlistRow | null> {
	const db = getDb();
	const conditions = [eq(waitlist.id, id)];
	if (clinicId) {
		conditions.push(eq(waitlist.clinicId, clinicId));
	}

	const rows = await db
		.select({
			id: waitlist.id,
			clinicId: waitlist.clinicId,
			patientId: waitlist.patientId,
			dentistId: waitlist.dentistId,
			procedureId: waitlist.procedureId,
			preferredDate: waitlist.preferredDate,
			preferredTimeStart: waitlist.preferredTimeStart,
			preferredTimeEnd: waitlist.preferredTimeEnd,
			priority: waitlist.priority,
			notes: waitlist.notes,
			status: waitlist.status,
			notifiedAt: waitlist.notifiedAt,
			scheduledAppointmentId: waitlist.scheduledAppointmentId,
			createdAt: waitlist.createdAt,
			updatedAt: waitlist.updatedAt,
			patients: {
				name: patients.name,
				phone: patients.phone,
			},
			dentists: {
				name: dentists.name,
			},
			procedures: {
				name: procedures.name,
			},
		})
		.from(waitlist)
		.leftJoin(patients, eq(patients.id, waitlist.patientId))
		.leftJoin(dentists, eq(dentists.id, waitlist.dentistId))
		.leftJoin(procedures, eq(procedures.id, waitlist.procedureId))
		.where(and(...conditions))
		.limit(1);

	return (rows[0] as WaitlistRow | undefined) ?? null;
}

// ─── Find by patient + clinic + date (for dedup check) ───────────────────────

export async function findByPatientClinicDate(params: {
	clinicId: string;
	patientId: string;
	preferredDate: string;
}): Promise<{ id: string } | null> {
	const db = getDb();
	const rows = await db
		.select({ id: waitlist.id })
		.from(waitlist)
		.where(
			and(
				eq(waitlist.clinicId, params.clinicId),
				eq(waitlist.patientId, params.patientId),
				eq(
					waitlist.preferredDate,
					new Date(params.preferredDate + "T00:00:00Z"),
				),
				eq(waitlist.status, "waiting"),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

// ─── Create waitlist entry ────────────────────────────────────────────────────

export async function createWaitlistEntry(params: {
	clinicId: string;
	patientId: string;
	preferredDate: string;
	preferredTimeStart: string;
	preferredTimeEnd?: string;
	procedureId?: string;
	dentistId?: string;
	priority?: number;
	notes?: string;
}): Promise<{ id: string }> {
	const db = getDb();
	const [row] = await db
		.insert(waitlist)
		.values({
			clinicId: params.clinicId,
			patientId: params.patientId,
			preferredDate: new Date(params.preferredDate + (params.preferredDate.includes('T') ? '' : 'T00:00:00Z')),
			preferredTimeStart: params.preferredTimeStart,
			preferredTimeEnd: params.preferredTimeEnd ?? params.preferredTimeStart,
			procedureId: params.procedureId ?? null,
			dentistId: params.dentistId ?? null,
			priority: params.priority ?? 5,
			notes: params.notes ?? null,
			status: "waiting",
		} as any)
		.returning({ id: waitlist.id });
	return { id: row.id };
}

// ─── Update waitlist entry ────────────────────────────────────────────────────

export async function updateEntry(
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
): Promise<boolean> {
	const db = getDb();
	const [row] = await db
		.update(waitlist)
		.set({ ...data, updatedAt: new Date() } as any)
		.where(eq(waitlist.id, id))
		.returning({ id: waitlist.id });
	return !!row;
}

// ─── Find by clinic (for getWaitlist) ────────────────────────────────────────

export async function findByClinic(params: {
	clinicId: string;
	date?: string;
	status?: string;
	patientId?: string;
}): Promise<WaitlistRow[]> {
	const db = getDb();
	const conditions: any[] = [eq(waitlist.clinicId, params.clinicId)];

	if (params.date) {
		conditions.push(
			eq(waitlist.preferredDate, new Date(params.date + "T00:00:00Z")),
		);
	}
	if (params.status) {
		conditions.push(eq(waitlist.status, params.status));
	}
	if (params.patientId) {
		conditions.push(eq(waitlist.patientId, params.patientId));
	}

	return db
		.select({
			id: waitlist.id,
			clinicId: waitlist.clinicId,
			patientId: waitlist.patientId,
			dentistId: waitlist.dentistId,
			procedureId: waitlist.procedureId,
			preferredDate: waitlist.preferredDate,
			preferredTimeStart: waitlist.preferredTimeStart,
			preferredTimeEnd: waitlist.preferredTimeEnd,
			priority: waitlist.priority,
			notes: waitlist.notes,
			status: waitlist.status,
			notifiedAt: waitlist.notifiedAt,
			scheduledAppointmentId: waitlist.scheduledAppointmentId,
			createdAt: waitlist.createdAt,
			updatedAt: waitlist.updatedAt,
			patients: {
				name: patients.name,
				phone: patients.phone,
			},
			dentists: {
				name: dentists.name,
			},
			procedures: {
				name: procedures.name,
			},
		})
		.from(waitlist)
		.leftJoin(patients, eq(patients.id, waitlist.patientId))
		.leftJoin(dentists, eq(dentists.id, waitlist.dentistId))
		.leftJoin(procedures, eq(procedures.id, waitlist.procedureId))
		.where(and(...conditions))
		.orderBy(desc(waitlist.priority), asc(waitlist.createdAt));
}

// ─── Find matching entries for a slot ────────────────────────────────────────

export async function findMatchingEntries(params: {
	clinicId: string;
	date: string;
	time: string;
	dentistId?: string;
}): Promise<WaitlistRow[]> {
	const db = getDb();
	const conditions: any[] = [
		eq(waitlist.clinicId, params.clinicId),
		eq(waitlist.preferredDate, new Date(params.date + "T00:00:00Z")),
		eq(waitlist.status, "waiting"),
		lte(waitlist.preferredTimeStart, params.time),
		gte(waitlist.preferredTimeEnd, params.time),
	];

	const rows = await db
		.select({
			id: waitlist.id,
			clinicId: waitlist.clinicId,
			patientId: waitlist.patientId,
			dentistId: waitlist.dentistId,
			procedureId: waitlist.procedureId,
			preferredDate: waitlist.preferredDate,
			preferredTimeStart: waitlist.preferredTimeStart,
			preferredTimeEnd: waitlist.preferredTimeEnd,
			priority: waitlist.priority,
			notes: waitlist.notes,
			status: waitlist.status,
			notifiedAt: waitlist.notifiedAt,
			scheduledAppointmentId: waitlist.scheduledAppointmentId,
			createdAt: waitlist.createdAt,
			updatedAt: waitlist.updatedAt,
			patients: {
				name: patients.name,
				phone: patients.phone,
			},
			dentists: {
				name: dentists.name,
			},
			procedures: {
				name: procedures.name,
			},
		})
		.from(waitlist)
		.leftJoin(patients, eq(patients.id, waitlist.patientId))
		.leftJoin(dentists, eq(dentists.id, waitlist.dentistId))
		.leftJoin(procedures, eq(procedures.id, waitlist.procedureId))
		.where(and(...conditions))
		.orderBy(desc(waitlist.priority), asc(waitlist.createdAt));

	// Sort: specific dentist first, then no preference
	if (params.dentistId) {
		const specific = rows.filter((r) => r.dentistId === params.dentistId);
		const noPref = rows.filter((r) => !r.dentistId);
		return [...specific, ...noPref];
	}

	return rows;
}

// ─── Update status to notified ────────────────────────────────────────────────

export async function markNotified(waitlistId: string): Promise<void> {
	const db = getDb();
	await db
		.update(waitlist)
		.set({
			status: "notified",
			notifiedAt: new Date(),
			updatedAt: new Date(),
		} as any)
		.where(eq(waitlist.id, waitlistId));
}

// ─── Update status to scheduled ──────────────────────────────────────────────

export async function markScheduled(
	waitlistId: string,
	appointmentId: string,
): Promise<void> {
	const db = getDb();
	await db
		.update(waitlist)
		.set({
			status: "scheduled",
			scheduledAppointmentId: appointmentId,
			updatedAt: new Date(),
		} as any)
		.where(eq(waitlist.id, waitlistId));
}

// ─── Update status to cancelled ───────────────────────────────────────────────

export async function cancelEntry(
	waitlistId: string,
	reason?: string,
): Promise<boolean> {
	const db = getDb();
	const [updated] = await db
		.update(waitlist)
		.set({
			status: "cancelled",
			notes: reason ?? null,
			updatedAt: new Date(),
		} as any)
		.where(eq(waitlist.id, waitlistId))
		.returning({ id: waitlist.id });
	return !!updated;
}

// ─── Expire old waiting entries ───────────────────────────────────────────────

export async function expireOldEntries(beforeDate: string): Promise<string[]> {
	const db = getDb();
	const rows = await db
		.update(waitlist)
		.set({
			status: "expired",
			updatedAt: new Date(),
		} as any)
		.where(
			and(
				eq(waitlist.status, "waiting"),
				lt(waitlist.preferredDate, new Date(beforeDate + "T00:00:00Z")),
			),
		)
		.returning({ id: waitlist.id });
	return rows.map((r) => r.id);
}

// ─── Idempotent Fill Slot Transaction ────────────────────────────────────────

export async function fillSlot(
	clinicId: string,
	input: {
		waitlistId: string;
		scheduledAt: Date;
		durationMinutes?: number;
		dentistId?: string;
		procedureId?: string;
		notes?: string;
	},
): Promise<{
	appointmentId: string;
	waitlistId: string;
	alreadyScheduled: boolean;
}> {
	const db = getDb();

	return db.transaction(async (tx: any) => {
		const [entry] = await tx
			.select()
			.from(waitlist)
			.where(and(eq(waitlist.id, input.waitlistId), eq(waitlist.clinicId, clinicId)))
			.for("update");

		if (!entry) {
			throw new ActionError("not_found", "Entrada da waitlist não encontrada.");
		}

		if (entry.status === "scheduled" && entry.scheduledAppointmentId) {
			return {
				appointmentId: entry.scheduledAppointmentId,
				waitlistId: entry.id,
				alreadyScheduled: true,
			};
		}

		if (entry.status === "cancelled" || entry.status === "expired") {
			throw new ActionError(
				"conflict",
				`Entrada da waitlist está com status '${entry.status}'.`,
			);
		}

		const finalDentistId = input.dentistId ?? entry.dentistId ?? null;
		const finalProcedureId = input.procedureId ?? entry.procedureId ?? null;
		const durationMinutes = input.durationMinutes ?? 30;

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
				status: "scheduled",
			})
			.returning();

		await tx
			.update(waitlist)
			.set({
				status: "scheduled",
				scheduledAppointmentId: appt.id,
				dentistId: finalDentistId,
				procedureId: finalProcedureId,
				updatedAt: new Date(),
			})
			.where(eq(waitlist.id, entry.id));

		return {
			appointmentId: appt.id,
			waitlistId: entry.id,
			alreadyScheduled: false,
		};
	});
}
