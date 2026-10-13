/**
 * Patients Repository
 * Provides Drizzle-based access to patients and related tables
 */

import { eq, desc, and, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
	patients,
	patientPreferences,
	patientRiskScores,
	appointments,
} from "@/lib/db/schema";

export interface PatientRow {
	id: string;
	clinicId: string;
	name: string;
	phone: string;
	email: string | null;
	cpf: string | null;
	birthDate: string | null;
	gender: string | null;
	notes: string | null;
	tags: string[] | null;
	lastVisitAt: Date | null;
	optOutMarketing: boolean | null;
	optOutReminders: boolean | null;
	riskScore: number | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface PatientPreferenceRow {
	key: string;
	value: string;
	category: string;
}

export interface PatientRiskScoreRow {
	score: string;
	calculatedAt: Date | null;
}

/**
 * NOTE (T1.4): unscoped `findPatientById`/`findById` removed — cross-tenant
 * risk. Use `findByIdScoped(patientId, clinicId)` with clinicId from trusted
 * auth context.
 */

/**
 * Get patient by phone within a clinic
 */
export async function findPatientByPhone(
	telefone: string,
	clinicId: string,
): Promise<PatientRow | null> {
	const db = getDb();
	const normalizedPhone = telefone.replace(/\D/g, "");
	const [row] = await db
		.select({
			id: patients.id,
			clinicId: patients.clinicId,
			name: patients.name,
			phone: patients.phone,
			email: patients.email,
			cpf: patients.cpf,
			lastVisitAt: patients.lastVisitAt,
			optOutMarketing: patients.optOutMarketing,
			optOutReminders: patients.optOutReminders,
			riskScore: patients.riskScore,
			createdAt: patients.createdAt,
			updatedAt: patients.updatedAt,
		})
		.from(patients)
		.where(
			and(eq(patients.clinicId, clinicId), eq(patients.phone, normalizedPhone)),
		)
		.limit(1);
	return (row as PatientRow) ?? null;
}

/**
 * Get patient preferences — tenant-scoped.
 * P1: clinicId must come from trusted auth context.
 */
export async function getPatientPreferences(
	patientId: string,
	clinicId: string,
): Promise<PatientPreferenceRow[]> {
	const db = getDb();
	const rows = await db
		.select({
			key: patientPreferences.key,
			value: patientPreferences.value,
			category: patientPreferences.category,
		})
		.from(patientPreferences)
		.where(
			and(
				eq(patientPreferences.patientId, patientId),
				eq(patientPreferences.clinicId, clinicId),
			),
		);
	return rows as PatientPreferenceRow[];
}

/**
 * Get latest patient risk score — tenant-scoped.
 * patient_risk_scores has no clinic_id column, so scope is enforced via a
 * patient-ownership gate (no cross-tenant leak).
 * P1: clinicId must come from trusted auth context.
 */
export async function getLatestRiskScore(
	patientId: string,
	clinicId: string,
): Promise<PatientRiskScoreRow | null> {
	const db = getDb();
	const [owner] = await db
		.select({ id: patients.id })
		.from(patients)
		.where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
		.limit(1);
	if (!owner) return null;
	const [row] = await db
		.select({
			score: patientRiskScores.score,
			calculatedAt: patientRiskScores.calculatedAt,
		})
		.from(patientRiskScores)
		.where(eq(patientRiskScores.patientId, patientId))
		.orderBy(desc(patientRiskScores.calculatedAt))
		.limit(1);
	return (row as unknown as PatientRiskScoreRow) ?? null;
}

/**
 * Get recent appointments for a patient — tenant-scoped.
 * P1: clinicId must come from trusted auth context.
 */
export async function getRecentAppointments(
	patientId: string,
	clinicId: string,
	limit = 10,
): Promise<
	Array<{
		id: string;
		scheduledAt: Date;
		status: string;
		notes: string | null;
		procedureName: string | null;
		dentistName: string | null;
	}>
> {
	const db = getDb();
	const rows = await db
		.select({
			id: appointments.id,
			scheduledAt: appointments.scheduledAt,
			status: appointments.status,
			notes: appointments.notes,
		})
		.from(appointments)
		.where(
			and(
				eq(appointments.patientId, patientId),
				eq(appointments.clinicId, clinicId),
			),
		)
		.orderBy(desc(appointments.scheduledAt))
		.limit(limit);
	return rows.map((r) => ({
		id: r.id,
		scheduledAt: r.scheduledAt,
		status: r.status,
		notes: r.notes,
		procedureName: null,
		dentistName: null,
	}));
}

/**
 * Get patient by ID with clinic scoping (for API routes).
 * P1: clinicId must come from trusted auth context.
 */
export async function findByIdScoped(
	patientId: string,
	clinicId: string,
): Promise<PatientRow | null> {
	const db = getDb();
	const [row] = await db
		.select({
			id: patients.id,
			clinicId: patients.clinicId,
			name: patients.name,
			phone: patients.phone,
			email: patients.email,
			cpf: patients.cpf,
			lastVisitAt: patients.lastVisitAt,
			optOutMarketing: patients.optOutMarketing,
			optOutReminders: patients.optOutReminders,
			riskScore: patients.riskScore,
			createdAt: patients.createdAt,
			updatedAt: patients.updatedAt,
		})
		.from(patients)
		.where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
		.limit(1);
	return (row as PatientRow) ?? null;
}

/**
 * Find patient by ID with appointments (for API routes)
 */
export async function findByIdWithAppointments(
	patientId: string,
	clinicId: string,
): Promise<{
	id: string;
	clinicId: string;
	name: string;
	phone: string;
	email: string | null;
	cpf: string | null;
	birthDate: string | null;
	gender: string | null;
	notes: string | null;
	tags: string[] | null;
	riskScore: string | null;
	lastVisitAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
	appointments: Array<{
		id: string;
		scheduledAt: Date;
		durationMinutes: number | null;
		status: string;
		notes: string | null;
	}>;
} | null> {
	const db = getDb();
	const [patient] = await db
		.select({
			id: patients.id,
			clinicId: patients.clinicId,
			name: patients.name,
			phone: patients.phone,
			email: patients.email,
			cpf: patients.cpf,
			birthDate: patients.birthDate,
			gender: patients.gender,
			notes: patients.notes,
			tags: patients.tags,
			riskScore: patients.riskScore,
			lastVisitAt: patients.lastVisitAt,
			createdAt: patients.createdAt,
			updatedAt: patients.updatedAt,
		})
		.from(patients)
		.where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
		.limit(1);
	if (!patient) return null;
	const apts = await db
		.select({
			id: appointments.id,
			scheduledAt: appointments.scheduledAt,
			durationMinutes: appointments.durationMinutes,
			status: appointments.status,
			notes: appointments.notes,
		})
		.from(appointments)
		.where(
			and(
				eq(appointments.patientId, patientId),
				eq(appointments.clinicId, clinicId),
			),
		)
		.orderBy(desc(appointments.scheduledAt))
		.limit(20);
	return { ...patient, appointments: apts } as unknown as ReturnType<typeof findByIdWithAppointments>;
}

/**
 * Find patients by clinic with optional search and pagination
 */
export async function findByClinic(
	clinicId: string,
	opts: { search?: string; limit?: number; offset?: number } = {},
): Promise<Array<PatientRow>> {
	const db = getDb();
	const { limit = 20, offset = 0 } = opts;
	const rows = await db
		.select()
		.from(patients)
		.where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt)))
		.limit(limit)
		.offset(offset);
	return rows as unknown as Array<PatientRow>;
}

/**
 * Create a new patient
 */
export async function create(data: {
	clinicId: string;
	name: string;
	phone: string;
	email?: string | null;
	cpf?: string | null;
	birthDate?: string | null;
	gender?: string | null;
	notes?: string | null;
}): Promise<PatientRow> {
	const db = getDb();
	const [row] = await db
		.insert(patients)
		.values({
			clinicId: data.clinicId,
			name: data.name,
			phone: data.phone,
			email: data.email ?? null,
			cpf: data.cpf ?? null,
			birthDate: data.birthDate ?? null,
			gender: data.gender ?? null,
			notes: data.notes ?? null,
		})
		.returning();
	return row as PatientRow;
}

/**
 * NOTE (T1.4): unscoped `update` removed — cross-tenant risk. Use
 * `updateScoped(id, clinicId, data)` with clinicId from trusted auth context.
 */

/**
 * Update a patient scoped to a clinic. Returns null when the id does not
 * belong to the given clinic (no cross-tenant write).
 * P1: clinicId must come from trusted auth context.
 */
export async function updateScoped(
	id: string,
	clinicId: string,
	data: Partial<{
		name: string;
		phone: string;
		email: string | null;
		cpf: string | null;
		birthDate: string | null;
		gender: string | null;
		notes: string | null;
		tags: string[];
	}>,
): Promise<PatientRow | null> {
	const db = getDb();
	const updateData: Record<string, unknown> = {
		...data,
		updatedAt: new Date(),
	};
	if (data.birthDate !== undefined)
		updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null;
	const [row] = await db
		.update(patients)
		.set(updateData as any)
		.where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)))
		.returning();
	return (row as PatientRow) ?? null;
}

/**
 * NOTE (T1.4): unscoped `softDelete` removed — cross-tenant risk. Use
 * `softDeleteScoped(id, clinicId)` with clinicId from trusted auth context.
 */

/**
 * Soft delete a patient scoped to a clinic. No-op when the id does not
 * belong to the given clinic (no cross-tenant write).
 * P1: clinicId must come from trusted auth context.
 */
export async function softDeleteScoped(
	id: string,
	clinicId: string,
): Promise<void> {
	const db = getDb();
	await db
		.update(patients)
		.set({ deletedAt: new Date(), updatedAt: new Date() } as any)
		.where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)));
}

/**
 * Find inactive patients by clinic
 */
export async function findInactiveByClinic(
	clinicId: string,
	opts: { sinceDays?: number } = {},
): Promise<Array<PatientRow>> {
	const db = getDb();
	const sinceDays = opts.sinceDays ?? 30;
	const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
	const rows = await db
		.select()
		.from(patients)
		.where(and(eq(patients.clinicId, clinicId), isNull(patients.deletedAt)))
		.limit(100);
	return rows.filter(
		(r) => r.lastVisitAt && r.lastVisitAt < cutoff,
	) as unknown as Array<PatientRow>;
}

/**
 * NOTE (T1.4): unscoped `bulkUpdateTags` removed — cross-tenant risk. Use
 * `bulkUpdateTagsScoped(patientIds, clinicId, tags)` with clinicId from
 * trusted auth context.
 */

/**
 * Bulk update tags scoped to a clinic — only rows belonging to the clinic
 * are touched.
 * P1: clinicId must come from trusted auth context.
 */
export async function bulkUpdateTagsScoped(
	patientIds: string[],
	clinicId: string,
	tags: string[],
): Promise<void> {
	const db = getDb();
	await db
		.update(patients)
		.set({ tags, updatedAt: new Date() } as any)
		.where(
			and(inArray(patients.id, patientIds), eq(patients.clinicId, clinicId)),
		);
}
