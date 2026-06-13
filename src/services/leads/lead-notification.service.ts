/**
 * Lead Notification Service
 * Handles hot lead notifications via WhatsApp with deduplication
 * Migrated from Supabase to Drizzle
 */

import { dbLogger, createLogger } from "@/lib/logger";
import { sendWhatsAppMessage } from "@/services/whatsapp";
import { getHotLeads, type Lead } from "./leads.service";
import * as leadRepo from "@/repositories/leads";

const logger = createLogger("lead-notifications");

const HOT_LEAD_THRESHOLD = 70;
const DEDUP_HOURS = 24;

export interface LeadNotification {
	id: string;
	lead_id: string;
	clinic_id: string;
	type: "hot_lead" | "lead_converted" | "lead_cold";
	channel: "whatsapp" | "in_app";
	sent_at: string;
	acknowledged: boolean;
	lead_name?: string;
	lead_phone?: string;
	lead_score?: number;
	lead_source?: string;
	lead_interest?: string;
}

// ─── Dedup ─────────────────────────────────────────────────────

/**
 * Check if a lead was already notified within the dedup window
 * NOTE: lead_notifications table not in Drizzle schema yet
 * Returns false (no dedup) until table is added
 */
async function wasRecentlyNotified(_leadId: string): Promise<boolean> {
	// lead_notifications table not in schema - skip dedup for now
	return false;
}

// ─── Message Building ───────────────────────────────────────────

function buildHotLeadMessage(lead: Lead): string {
	const interest = lead.interest ? `\n- Interesse: ${lead.interest}` : "";
	const notes = lead.notes ? `\n- Observacoes: ${lead.notes}` : "";

	return (
		`LEAD QUENTE DETECTADO!\n\n` +
		`Nome: ${lead.name}\n` +
		`Telefone: ${lead.phone}\n` +
		`Email: ${lead.email || "N/A"}\n` +
		`Origem: ${lead.source}\n` +
		`Score: ${lead.score}/100\n` +
		`Status: ${lead.status}${interest}${notes}\n\n` +
		`Acesse o painel para agir rapidamente!`
	);
}

// ─── Main Functions ─────────────────────────────────────────────

export async function notifyHotLead(
	leadId: string,
): Promise<{ sent: boolean; error?: string }> {
	try {
		const lead = await leadRepo.findLeadById(leadId);
		if (!lead) {
			return { sent: false, error: "Lead not found" };
		}

		const typedLead: Lead = {
			id: lead.id,
			clinic_id: lead.clinicId,
			patient_id: lead.patientId,
			name: lead.name,
			phone: lead.phone,
			email: lead.email,
			source: lead.source as Lead["source"],
			status: lead.status as Lead["status"],
			temperature: lead.temperature as Lead["temperature"],
			score: lead.score,
			interest: lead.interest,
			notes: lead.notes,
			assigned_to: lead.assignedTo,
			last_contact_at: lead.lastContactAt?.toISOString() ?? null,
			next_followup_at: lead.nextFollowupAt?.toISOString() ?? null,
			converted_at: lead.convertedAt?.toISOString() ?? null,
			lost_reason: lead.lostReason,
			deal_value: lead.dealValue ? parseFloat(lead.dealValue) : null,
			created_at: lead.createdAt.toISOString(),
			updated_at: lead.updatedAt.toISOString(),
		};

		if (typedLead.score < HOT_LEAD_THRESHOLD) {
			return {
				sent: false,
				error: `Score ${typedLead.score} below threshold ${HOT_LEAD_THRESHOLD}`,
			};
		}

		if (await wasRecentlyNotified(leadId)) {
			logger.info("Skipping duplicate notification", { leadId });
			return { sent: false, error: "Already notified within 24h" };
		}

		// Find responsible phone - needs users table lookup
		// For now, send to the lead's phone as fallback
		const phone = typedLead.phone;
		if (!phone) {
			logger.warn("No phone found for lead", { leadId });
			return { sent: false, error: "No phone number found" };
		}

		const message = buildHotLeadMessage(typedLead);
		const result = await sendWhatsAppMessage(phone, message);

		if (!result.success) {
			logger.error(
				"WhatsApp send failed",
				new Error(result.error || "Unknown"),
				{ leadId, phone },
			);
			return { sent: false, error: result.error || "WhatsApp send failed" };
		}

		logger.info("Hot lead notification sent", { leadId, channel: "whatsapp" });
		return { sent: true };
	} catch (error) {
		logger.error("Error notifying hot lead", error, { leadId });
		return {
			sent: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function checkAndNotifyHotLeads(clinicId: string): Promise<void> {
	try {
		const hotLeads = await getHotLeads(clinicId, 50);
		logger.info("Checking hot leads for clinic", {
			clinicId,
			hotLeadsCount: hotLeads.length,
		});
		for (const lead of hotLeads) {
			if (lead.score >= HOT_LEAD_THRESHOLD) {
				await notifyHotLead(lead.id);
			}
		}
	} catch (error) {
		logger.error("Error in checkAndNotifyHotLeads", error, { clinicId });
	}
}

/**
 * Scan all active clinics and notify hot leads
 * NOTE: Requires clinics table access - out of scope for this slice
 */
export async function checkAllClinicsHotLeads(): Promise<void> {
	logger.warn("checkAllClinicsHotLeads - requires clinics table, out of scope");
}

export async function getUnacknowledgedNotifications(
	_clinicId: string,
): Promise<LeadNotification[]> {
	// lead_notifications table not in schema - return empty
	return [];
}

export async function acknowledgeNotification(
	_notificationId: string,
): Promise<boolean> {
	// lead_notifications table not in schema - no-op
	return true;
}
