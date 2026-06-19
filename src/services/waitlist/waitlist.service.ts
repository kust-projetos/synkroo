import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { patients, procedures, dentists } from '@/lib/db/schema'
import { dbLogger, whatsappLogger } from '@/lib/logger'
import {
	createWaitlistEntry,
	findByPatientClinicDate,
	findByClinic,
	findMatchingEntries,
	markNotified,
	markScheduled,
	cancelEntry,
	expireOldEntries,
} from "@/repositories/waitlist";

/**
 * Waitlist Service
 * Manages patient waitlists for unavailable appointment slots
 */

export interface WaitlistEntry {
	id: string;
	clinicId: string;
	patientId: string;
	patientName: string;
	patientPhone: string;
	preferredDate: string; // YYYY-MM-DD
	preferredTimeStart: string; // HH:MM
	preferredTimeEnd: string; // HH:MM
	procedureId?: string;
	procedureName?: string;
	dentistId?: string;
	dentistName?: string;
	priority: number; // Higher = more urgent
	status: "waiting" | "notified" | "scheduled" | "expired" | "cancelled";
	notes?: string;
	createdAt: Date;
	notifiedAt?: Date;
	scheduledAppointmentId?: string;
}

export interface CreateWaitlistParams {
	clinicId: string;
	patientId: string;
	preferredDate: string;
	preferredTimeStart: string;
	preferredTimeEnd?: string;
	procedureId?: string;
	dentistId?: string;
	priority?: number;
	notes?: string;
}

/** Map raw DB row to service-level WaitlistEntry. */
function mapRow(raw: any): WaitlistEntry {
	return {
		id: raw.id,
		clinicId: raw.clinicId,
		patientId: raw.patientId,
		patientName: raw.patients?.name || "",
		patientPhone: raw.patients?.phone || "",
		preferredDate:
			raw.preferredDate instanceof Date
				? raw.preferredDate.toISOString().split("T")[0]
				: String(raw.preferredDate || "").split("T")[0],
		preferredTimeStart: raw.preferredTimeStart || "",
		preferredTimeEnd: raw.preferredTimeEnd || "",
		procedureId: raw.procedureId,
		procedureName: raw.procedures?.name,
		dentistId: raw.dentistId,
		dentistName: raw.dentists?.name,
		priority: raw.priority ?? 0,
		status: raw.status as WaitlistEntry["status"],
		notes: raw.notes,
		createdAt:
			raw.createdAt instanceof Date
				? raw.createdAt
				: new Date(raw.createdAt ?? Date.now()),
		notifiedAt: raw.notifiedAt ? new Date(raw.notifiedAt) : undefined,
		scheduledAppointmentId: raw.scheduledAppointmentId,
	};
}

/**
 * Add patient to waitlist
 */
export async function addToWaitlist(
	params: CreateWaitlistParams,
): Promise<{ success: boolean; entry?: WaitlistEntry; error?: string }> {
	try {
		// Get patient info via Drizzle
		const db = getDb()
		const [patient] = await db
			.select({ id: patients.id, name: patients.name, phone: patients.phone })
			.from(patients)
			.where(eq(patients.id, params.patientId))

		if (!patient) {
			return { success: false, error: "Patient not found" }
		}

		// Check if patient already has a waitlist entry for this date
		const existing = await findByPatientClinicDate({
			clinicId: params.clinicId,
			patientId: params.patientId,
			preferredDate: params.preferredDate,
		});

		if (existing) {
			return {
				success: false,
				error: "Patient already on waitlist for this date",
			};
		}

		// Get procedure name if provided
		let procedureName: string | undefined;
		if (params.procedureId) {
			const [proc] = await db
				.select({ name: procedures.name })
				.from(procedures)
				.where(eq(procedures.id, params.procedureId))
			procedureName = proc?.name
		}

		// Get dentist name if provided
		let dentistName: string | undefined;
		if (params.dentistId) {
			const [dent] = await db
				.select({ name: dentists.name })
				.from(dentists)
				.where(eq(dentists.id, params.dentistId))
			dentistName = dent?.name
		}

		// Create waitlist entry via repository
		const created = await createWaitlistEntry(params);

		dbLogger.info(`Patient ${patient.name} added to waitlist`, {
			patientId: params.patientId,
			date: params.preferredDate,
		});

		return {
			success: true,
			entry: {
				id: created.id,
				clinicId: params.clinicId,
				patientId: params.patientId,
				patientName: patient.name,
				patientPhone: patient.phone,
				preferredDate: params.preferredDate,
				preferredTimeStart: params.preferredTimeStart,
				preferredTimeEnd: params.preferredTimeEnd ?? params.preferredTimeStart,
				procedureId: params.procedureId,
				procedureName,
				dentistId: params.dentistId,
				dentistName,
				priority: params.priority ?? 5,
				status: "waiting",
				notes: params.notes,
				createdAt: new Date(),
			},
		};
	} catch (error) {
		dbLogger.error("Error in addToWaitlist", error);
		return { success: false, error: "Internal error" };
	}
}

/**
 * Get waitlist for a clinic
 */
export async function getWaitlist(
	clinicId: string,
	filters?: {
		date?: string;
		status?: string;
		patientId?: string;
	},
): Promise<WaitlistEntry[]> {
	try {
		const rows = await findByClinic({
			clinicId,
			date: filters?.date,
			status: filters?.status,
			patientId: filters?.patientId,
		});
		return rows.map(mapRow);
	} catch (error) {
		dbLogger.error("Error fetching waitlist", error);
		return [];
	}
}

/**
 * Find matching waitlist entries for an available slot
 */
export async function findMatchingWaitlist(
	clinicId: string,
	date: string,
	time: string,
	dentistId?: string,
): Promise<WaitlistEntry[]> {
	try {
		const rows = await findMatchingEntries({ clinicId, date, time, dentistId });
		return rows.map(mapRow);
	} catch (error) {
		dbLogger.error("Error finding matching waitlist", error);
		return [];
	}
}

/**
 * Notify patient about available slot
 */
export async function notifyWaitlistPatient(
	entry: WaitlistEntry,
	availableSlot: { date: string; time: string; dentistName?: string },
): Promise<{ success: boolean; error?: string }> {
	try {
		const dateStr = new Date(availableSlot.date).toLocaleDateString("pt-BR", {
			weekday: "long",
			day: "2-digit",
			month: "long",
		});

		const message = `🏥 *Vaga Disponível!*

Olá, ${entry.patientName}!

Temos uma vaga disponível:
📅 ${dateStr}
⏰ às ${availableSlot.time}
${availableSlot.dentistName ? `👨‍⚕️ Dr(a). ${availableSlot.dentistName}` : ""}
${entry.procedureName ? `🦷 ${entry.procedureName}` : ""}

Quer garantir este horário? Responda "SIM" para confirmar ou "NÃO" para continuar na lista de espera.

⚠️ Esta vaga é válida por 2 horas.`;

		// Send WhatsApp message
		const whatsappApiUrl = process.env.WHATSAPP_API_URL;
		const whatsappToken = process.env.WHATSAPP_TOKEN;

		if (!whatsappApiUrl || !whatsappToken) {
			return { success: false, error: "WhatsApp not configured" };
		}

		let formattedPhone = entry.patientPhone.replace(/\D/g, "");
		if (!formattedPhone.startsWith("55")) {
			formattedPhone = "55" + formattedPhone;
		}

		const response = await fetch(whatsappApiUrl, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${whatsappToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messaging_product: "whatsapp",
				to: formattedPhone,
				type: "text",
				text: { body: message },
			}),
		});

		if (!response.ok) {
			const data = await response.json();
			whatsappLogger.error("Failed to send waitlist notification", null, {
				data,
			});
			return { success: false, error: "Failed to send notification" };
		}

		// Update waitlist entry status via repository
		await markNotified(entry.id);

		dbLogger.info(`Notified patient ${entry.patientName} about available slot`);

		return { success: true };
	} catch (error) {
		dbLogger.error("Error notifying waitlist patient", error);
		return { success: false, error: "Internal error" };
	}
}

/**
 * Mark waitlist entry as scheduled
 */
export async function markWaitlistScheduled(
	waitlistId: string,
	appointmentId: string,
): Promise<void> {
	await markScheduled(waitlistId, appointmentId);
	dbLogger.info(`Waitlist entry ${waitlistId} marked as scheduled`);
}

/**
 * Cancel waitlist entry
 */
export async function cancelWaitlistEntry(
	waitlistId: string,
	reason?: string,
): Promise<{ success: boolean; error?: string }> {
	const updated = await cancelEntry(waitlistId, reason);
	if (!updated) {
		dbLogger.error("Error cancelling waitlist entry", { waitlistId });
		return { success: false, error: "Failed to cancel" };
	}
	return { success: true };
}

/**
 * Expire old waitlist entries (called by cron)
 */
export async function expireOldWaitlistEntries(): Promise<{ expired: number }> {
	try {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const dateStr = yesterday.toISOString().split("T")[0];

		const expiredIds = await expireOldEntries(dateStr);
		const count = expiredIds.length;
		if (count > 0) {
			dbLogger.info(`Expired ${count} old waitlist entries`);
		}
		return { expired: count };
	} catch (error) {
		dbLogger.error("Error expiring waitlist entries", error);
		return { expired: 0 };
	}
}

/**
 * Process waitlist when appointment is cancelled
 */
export async function processWaitlistOnCancellation(
	clinicId: string,
	date: string,
	time: string,
	dentistId?: string,
): Promise<{ notified: number }> {
	const matchingEntries = await findMatchingWaitlist(
		clinicId,
		date,
		time,
		dentistId,
	);

	if (matchingEntries.length > 0) {
		const entry = matchingEntries[0];
		const result = await notifyWaitlistPatient(entry, {
			date,
			time,
			dentistName: entry.dentistName,
		});
		return { notified: result.success ? 1 : 0 };
	}

	return { notified: 0 };
}
