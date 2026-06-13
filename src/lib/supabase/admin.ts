/**
 * Supabase admin helpers
 *
 * NOTE: All data-access functions below have been migrated to Drizzle repositories.
 * This file is kept for backward compatibility during the transition.
 * Direct Supabase usage is no longer allowed in migrated slices.
 *
 * Migration map:
 *   getOrCreateConversation   → conversationsRepo.getOrCreateConversation
 *   storeMessage             → conversationsRepo.createMessage
 *   getConversationContext   → conversationsRepo.getConversationContext
 *   getPatientInsights       → conversationsRepo.getPatientInsights
 *   getAvailableSlots        → appointmentsRepo.getAvailableSlots
 *   getClinicConfig          → clinicsRepo.getClinicConfig
 *   searchKnowledgeBase      → knowledgeRepo.searchKnowledgeBase
 */

import {
	getOrCreateConversation as repoGetOrCreate,
	createMessage as repoCreateMessage,
	getConversationContext as repoGetContext,
	getPatientInsights as repoGetInsights,
} from "@/repositories/conversations";
import { getAvailableSlots as repoGetSlots } from "@/repositories/appointments";
import { getClinicConfig as repoGetClinic } from "@/repositories/clinics";
import { searchKnowledgeBase as repoSearchKb } from "@/repositories/knowledge";
import { dbLogger } from "@/lib/logger";

/**
 * @deprecated Use conversationsRepo.getOrCreateConversation instead
 */
export async function getOrCreateConversation(
	clinicId: string,
	channel: "whatsapp" | "instagram" | "web",
	externalId: string,
	patientPhone?: string,
): Promise<string> {
	try {
		return await repoGetOrCreate(clinicId, channel, externalId, patientPhone);
	} catch (error) {
		dbLogger.error("getOrCreateConversation failed", error);
		throw error;
	}
}

/**
 * @deprecated Use conversationsRepo.createMessage instead
 */
export async function storeMessage(
	conversationId: string,
	direction: "inbound" | "outbound",
	content: string,
	metadata?: Record<string, unknown>,
): Promise<string> {
	try {
		const row = await repoCreateMessage({
			conversationId,
			direction: direction as "inbound" | "outbound",
			content,
			messageType: "text",
			metadata: metadata ?? {},
		});
		return row.id;
	} catch (error) {
		dbLogger.error("storeMessage failed", error);
		throw error;
	}
}

/**
 * @deprecated Use conversationsRepo.getConversationContext instead
 */
export async function getConversationContext(
	conversationId: string,
	limit = 10,
): Promise<Array<{ role: string; content: string; intent: string | null }>> {
	try {
		return await repoGetContext(conversationId, limit);
	} catch (error) {
		dbLogger.error("getConversationContext failed", error);
		throw error;
	}
}

/**
 * @deprecated Use conversationsRepo.getPatientInsights instead
 */
export async function getPatientInsights(patientId: string) {
	try {
		return await repoGetInsights(patientId);
	} catch (error) {
		dbLogger.error("getPatientInsights failed", error);
		throw error;
	}
}

/**
 * @deprecated Use appointmentsRepo.getAvailableSlots instead
 */
export async function getAvailableSlots(
	clinicId: string,
	dentistId: string,
	date: string,
	durationMinutes = 30,
): Promise<Array<{ start_time: string; end_time: string }>> {
	try {
		return await repoGetSlots(clinicId, dentistId, date, durationMinutes);
	} catch (error) {
		dbLogger.error("getAvailableSlots failed", error);
		throw error;
	}
}

/**
 * @deprecated Use clinicsRepo.getClinicConfig instead
 */
export async function getClinicConfig(clinicId: string) {
	try {
		return await repoGetClinic(clinicId);
	} catch (error) {
		dbLogger.error("getClinicConfig failed", error);
		throw error;
	}
}

/**
 * @deprecated Use knowledgeRepo.searchKnowledgeBase instead
 */
export async function searchKnowledgeBase(
	clinicId: string,
	query: string,
): Promise<Array<{ question: string; answer: string; relevance: number }>> {
	try {
		const results = await repoSearchKb(clinicId, query);
		return results.map((r) => ({
			question: r.question,
			answer: r.answer,
			relevance: r.relevance,
		}));
	} catch (error) {
		dbLogger.error("searchKnowledgeBase failed", error);
		return [];
	}
}

// Re-export supabaseAdmin as a no-op proxy for any remaining direct usage
// This prevents breakage from any code still importing supabaseAdmin
export const supabaseAdmin = new Proxy(
	{},
	{
		get(_target, prop) {
			if (prop === "then") return undefined; // prevent "promise-like" issues
			return () => {
				dbLogger.warn(
					`supabaseAdmin.${String(prop)} called — this should be migrated`,
				);
				return Promise.resolve(null);
			};
		},
	},
) as any;
