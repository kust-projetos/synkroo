/**
 * Followup Repository
 * DB operations for patient_feedback table via Drizzle.
 */

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
