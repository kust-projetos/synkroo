/**
 * Followup Repository
 * DB operations for patient_feedback table via Drizzle.
 */

import { eq, and } from 'drizzle-orm';
import { getDb } from "@/lib/db/client";
import { patientFeedback } from "@/modules/operacional/schema";

export async function createFeedback(params: {
	clinicId: string;
	patientId: string;
	appointmentId?: string;
	feedbackType?: string;
	rating?: number;
	npsScore?: number;
	wouldRecommend?: boolean;
	comments?: string;
	channel?: string;
}): Promise<void> {
	const db = getDb();
	await db.insert(patientFeedback).values({
		clinicId: params.clinicId,
		patientId: params.patientId,
		appointmentId: params.appointmentId ?? null,
		feedbackType: params.feedbackType ?? "post_consultation",
		rating: params.rating ?? null,
		npsScore: params.npsScore ?? null,
		wouldRecommend: params.wouldRecommend ?? null,
		comments: params.comments ?? null,
		channel: params.channel ?? "whatsapp",
	} as any);
}

/**
 * Find a patient by id + clinicId. Returns null if not found or belongs to another clinic.
 */
export async function findPatientForClinic(
	clinicId: string,
	patientId: string,
): Promise<{ id: string; name: string } | null> {
	const db = getDb();
	const [row] = await db
		.select({ id: patients.id, name: patients.name })
		.from(patients)
		.where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId)))
		.limit(1);
	return row ?? null;
}

/**
 * Find an appointment by id + patientId + clinicId. Returns null if not found or belongs to another tenant.
 */
export async function findAppointmentForClinicPatient(
	clinicId: string,
	patientId: string,
	appointmentId: string,
): Promise<{ id: string } | null> {
	const db = getDb();
	const [row] = await db
		.select({ id: appointments.id })
		.from(appointments)
		.where(
			and(
				eq(appointments.id, appointmentId),
				eq(appointments.patientId, patientId),
				eq(appointments.clinicId, clinicId),
			),
			)
		.limit(1);
	return row ?? null;
}
