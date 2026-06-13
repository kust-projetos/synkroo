/**
 * Reminders Repository
 * DB operations for appointment_reminders table via Drizzle.
 */

import { getDb } from "@/lib/db/client";
import { appointmentReminders } from "@/lib/db/schema/appointments";

export async function createReminder(params: {
	appointmentId: string;
	reminderType: string;
	channel: string;
	status: string;
	messageId?: string;
	errorMessage?: string;
	sentAt?: Date;
}): Promise<void> {
	const db = getDb();
	await db.insert(appointmentReminders).values({
		appointmentId: params.appointmentId,
		reminderType: params.reminderType,
		channel: params.channel,
		status: params.status,
		messageId: params.messageId ?? null,
		errorMessage: params.errorMessage ?? null,
		sentAt: params.sentAt ?? null,
	} as any);
}
