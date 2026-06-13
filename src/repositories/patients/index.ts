/**
 * Patients Repository
 * Provides Drizzle-based access to patients and related tables
 */

import { eq, desc, and, inArray } from "drizzle-orm";
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
 * Get patient by ID
 */
export async function findPatientById(
	patientId: string,
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
		.where(eq(patients.id, patientId))
		.limit(1);
	return (row as PatientRow) ?? null;
}

/** Alias for findPatientById */
export const findById = findPatientById

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
 * Get patient preferences
 */
export async function getPatientPreferences(
	patientId: string,
): Promise<PatientPreferenceRow[]> {
	const db = getDb();
	const rows = await db
		.select({
			key: patientPreferences.key,
			value: patientPreferences.value,
			category: patientPreferences.category,
		})
		.from(patientPreferences)
		.where(eq(patientPreferences.patientId, patientId));
	return rows as PatientPreferenceRow[];
}

/**
 * Get latest patient risk score
 */
export async function getLatestRiskScore(
	patientId: string,
): Promise<PatientRiskScoreRow | null> {
	const db = getDb();
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
 * Get recent appointments for a patient
 */
export async function getRecentAppointments(
	patientId: string,
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
		.where(eq(appointments.patientId, patientId))
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
 * Get patient by ID with clinic scoping (for API routes)
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
		.where(eq(appointments.patientId, patientId))
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
		.where(eq(patients.clinicId, clinicId))
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
 * Update a patient
 */
export async function update(
	id: string,
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
		.where(eq(patients.id, id))
		.returning();
	return (row as PatientRow) ?? null;
}

/**
 * Soft delete a patient
 */
export async function softDelete(id: string): Promise<void> {
	const db = getDb();
	await db
		.update(patients)
		.set({ deletedAt: new Date(), updatedAt: new Date() } as any)
		.where(eq(patients.id, id));
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
		.where(eq(patients.clinicId, clinicId))
		.limit(100);
	return rows.filter(
		(r) => r.lastVisitAt && r.lastVisitAt < cutoff,
	) as unknown as Array<PatientRow>;
}

/**
 * Bulk update tags for multiple patients
 */
export async function bulkUpdateTags(
	patientIds: string[],
	tags: string[],
): Promise<void> {
	const db = getDb();
	await db
		.update(patients)
		.set({ tags, updatedAt: new Date() } as any)
		.where(and(inArray(patients.id, patientIds)));
}
