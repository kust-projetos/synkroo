/**
 * Leads Service
 * Manages lead capture, scoring, qualification, and pipeline for sales conversion
 * Migrated from Supabase to Drizzle
 */

import { dbLogger } from "@/lib/logger";
import * as leadRepo from "@/repositories/leads";

export type LeadSource =
	| "whatsapp"
	| "instagram"
	| "web"
	| "referral"
	| "campaign"
	| "other";
export type LeadStatus =
	| "new"
	| "contacted"
	| "qualified"
	| "proposal"
	| "negotiation"
	| "converted"
	| "lost";
export type LeadTemperature = "cold" | "warm" | "hot";

export interface Lead {
	id: string;
	clinic_id: string;
	patient_id: string | null;
	name: string;
	phone: string;
	email: string | null;
	source: LeadSource;
	status: LeadStatus;
	temperature: LeadTemperature;
	score: number;
	interest: string | null;
	notes: string | null;
	assigned_to: string | null;
	last_contact_at: string | null;
	next_followup_at: string | null;
	converted_at: string | null;
	lost_reason: string | null;
	deal_value: number | null;
	created_at: string;
	updated_at: string;
}

export interface LeadScore {
	score: number;
	factors: ScoreFactor[];
	recommendation: string;
}

export interface ScoreFactor {
	name: string;
	points: number;
	description: string;
}

export interface LeadQualification {
	is_qualified: boolean;
	temperature: LeadTemperature;
	score: number;
	missing_info: string[];
	next_steps: string[];
}

// ─── Score Calculation ───────────────────────────────────────

export function calculateLeadScore(params: {
	source: LeadSource;
	hasPhone: boolean;
	hasEmail: boolean;
	expressedInterest: boolean;
	hasBudget: boolean | null;
	hasTimeline: boolean | null;
	respondedToFollowup: boolean;
	previousPatient: boolean;
}): LeadScore {
	const factors: ScoreFactor[] = [];
	let totalScore = 0;

	const sourceScores: Record<LeadSource, number> = {
		whatsapp: 18,
		instagram: 15,
		web: 12,
		referral: 20,
		campaign: 10,
		other: 5,
	};
	factors.push({
		name: "source",
		points: sourceScores[params.source],
		description: `Origem: ${params.source}`,
	});
	totalScore += sourceScores[params.source];

	if (params.hasPhone) {
		factors.push({
			name: "phone",
			points: 10,
			description: "Telefone fornecido",
		});
		totalScore += 10;
	}
	if (params.hasEmail) {
		factors.push({ name: "email", points: 5, description: "Email fornecido" });
		totalScore += 5;
	}

	if (params.expressedInterest) {
		factors.push({
			name: "interest",
			points: 15,
			description: "Demonstrou interesse em procedimento",
		});
		totalScore += 15;
	}
	if (params.hasBudget === true) {
		factors.push({
			name: "budget",
			points: 10,
			description: "Orçamento compatível",
		});
		totalScore += 10;
	} else if (params.hasBudget === null) {
		factors.push({
			name: "budget_unknown",
			points: 5,
			description: "Orçamento não informado",
		});
		totalScore += 5;
	}

	if (params.hasTimeline === true) {
		factors.push({
			name: "timeline",
			points: 15,
			description: "Tem urgência definida",
		});
		totalScore += 15;
	} else if (params.hasTimeline === null) {
		factors.push({
			name: "timeline_unknown",
			points: 5,
			description: "Timeline não informada",
		});
		totalScore += 5;
	}

	if (params.respondedToFollowup) {
		factors.push({
			name: "engagement",
			points: 15,
			description: "Respondeu ao follow-up",
		});
		totalScore += 15;
	}

	if (params.previousPatient) {
		factors.push({
			name: "previous_patient",
			points: 10,
			description: "Paciente anterior",
		});
		totalScore += 10;
	}

	const normalizedScore = Math.min(totalScore, 100);

	let recommendation = "";
	if (normalizedScore >= 70) {
		recommendation =
			"Lead quente! Priorizar contato imediato e agendar avaliação.";
	} else if (normalizedScore >= 40) {
		recommendation =
			"Lead morno. Enviar mais informações e fazer follow-up em 2 dias.";
	} else {
		recommendation = "Lead frio. Adicionar à sequência de nurturing.";
	}

	return {
		score: normalizedScore,
		factors,
		recommendation,
	};
}

export function getTemperatureFromScore(score: number): LeadTemperature {
	if (score >= 70) return "hot";
	if (score >= 40) return "warm";
	return "cold";
}

// ─── Repository-to-Service type adapters ─────────────────────

function repoLeadToService(r: leadRepo.LeadRow): Lead {
	return {
		id: r.id,
		clinic_id: r.clinicId,
		patient_id: r.patientId,
		name: r.name,
		phone: r.phone,
		email: r.email,
		source: r.source as LeadSource,
		status: r.status as LeadStatus,
		temperature: r.temperature as LeadTemperature,
		score: r.score,
		interest: r.interest,
		notes: r.notes,
		assigned_to: r.assignedTo,
		last_contact_at: r.lastContactAt?.toISOString() ?? null,
		next_followup_at: r.nextFollowupAt?.toISOString() ?? null,
		converted_at: r.convertedAt?.toISOString() ?? null,
		lost_reason: r.lostReason,
		deal_value: r.dealValue ? parseFloat(r.dealValue) : null,
		created_at: r.createdAt.toISOString(),
		updated_at: r.updatedAt.toISOString(),
	};
}

// ─── Service Methods ───────────────────────────────────────────

export async function createLead(params: {
	clinicId: string;
	name: string;
	phone: string;
	email?: string;
	source: LeadSource;
	interest?: string;
	patientId?: string;
	notes?: string;
	deal_value?: number;
}): Promise<Lead | null> {
	const scoreResult = calculateLeadScore({
		source: params.source,
		hasPhone: !!params.phone,
		hasEmail: !!params.email,
		expressedInterest: !!params.interest,
		hasBudget: null,
		hasTimeline: null,
		respondedToFollowup: false,
		previousPatient: !!params.patientId,
	});

	const temperature = getTemperatureFromScore(scoreResult.score);

	const lead = await leadRepo.createLead({
		clinicId: params.clinicId,
		name: params.name,
		phone: params.phone,
		email: params.email,
		source: params.source,
		interest: params.interest,
		patientId: params.patientId,
		notes: params.notes,
		dealValue: params.deal_value,
		score: scoreResult.score,
		temperature,
	});

	if (!lead) return null;

	dbLogger.info("Lead created", {
		leadId: lead.id,
		score: scoreResult.score,
		temperature,
	});

	return repoLeadToService(lead);
}

export async function getLeads(params: {
	clinicId: string;
	status?: LeadStatus;
	temperature?: LeadTemperature;
	minScore?: number;
	assignedTo?: string;
	limit?: number;
	offset?: number;
}): Promise<{ leads: Lead[]; total: number }> {
	const result = await leadRepo.findLeads({
		clinicId: params.clinicId,
		status: params.status,
		temperature: params.temperature,
		minScore: params.minScore,
		assignedTo: params.assignedTo,
		limit: params.limit,
		offset: params.offset,
	});

	return {
		leads: result.leads.map(repoLeadToService),
		total: result.total,
	};
}

export async function updateLeadStatus(
	leadId: string,
	status: LeadStatus,
	notes?: string,
): Promise<Lead | null> {
	const lead = await leadRepo.updateLeadStatus(leadId, status, notes);
	return lead ? repoLeadToService(lead) : null;
}

export async function qualifyLead(
	leadId: string,
	qualification: {
		hasBudget?: boolean;
		hasTimeline?: boolean;
		interest?: string;
		notes?: string;
	},
): Promise<LeadQualification | null> {
	const currentLead = await leadRepo.findLeadById(leadId);
	if (!currentLead) return null;

	const previousScore = currentLead.score;

	const scoreResult = calculateLeadScore({
		source: currentLead.source as LeadSource,
		hasPhone: !!currentLead.phone,
		hasEmail: !!currentLead.email,
		expressedInterest: !!qualification.interest || !!currentLead.interest,
		hasBudget: qualification.hasBudget ?? null,
		hasTimeline: qualification.hasTimeline ?? null,
		respondedToFollowup: currentLead.status !== "new",
		previousPatient: !!currentLead.patientId,
	});

	const temperature = getTemperatureFromScore(scoreResult.score);
	const isQualified = scoreResult.score >= 50;

	const missingInfo: string[] = [];
	if (!currentLead.email) missingInfo.push("email");
	if (!qualification.hasBudget && !currentLead.interest)
		missingInfo.push("orçamento");
	if (!qualification.hasTimeline) missingInfo.push("urgência");

	const nextSteps: string[] = [];
	if (temperature === "hot") {
		nextSteps.push("Agendar avaliação imediatamente");
		nextSteps.push("Enviar propostas personalizadas");
	} else if (temperature === "warm") {
		nextSteps.push("Enviar mais informações sobre procedimentos");
		nextSteps.push("Follow-up em 2-3 dias");
	} else {
		nextSteps.push("Adicionar à sequência de nurturing");
		nextSteps.push("Enviar conteúdo educativo");
	}

	await leadRepo.updateLead(leadId, {
		score: scoreResult.score,
		temperature,
		status: isQualified ? "qualified" : currentLead.status,
		interest: qualification.interest ?? currentLead.interest ?? undefined,
		notes: qualification.notes ?? currentLead.notes ?? undefined,
	});

	if (previousScore < 70 && scoreResult.score >= 70) {
		import("@/services/leads/lead-notification.service")
			.then(({ notifyHotLead }) => notifyHotLead(leadId))
			.catch((err) => {
				dbLogger.error("Background notification failed", err, { leadId });
			});
	}

	return {
		is_qualified: isQualified,
		temperature,
		score: scoreResult.score,
		missing_info: missingInfo,
		next_steps: nextSteps,
	};
}

export async function getHotLeads(
	clinicId: string,
	limit: number = 10,
): Promise<Lead[]> {
	const rows = await leadRepo.findHotLeads(clinicId, limit);
	return rows.map(repoLeadToService);
}

export interface LeadCaptureResult {
	created: boolean;
	leadId: string;
	score: number;
	wasExisting: boolean;
}

function extractWhatsAppKeywords(text: string): string[] {
	const lower = text.toLowerCase();
	const keywords: string[] = [];
	if (/\b(orçamento|preço|quanto custa|valor)\b/.test(lower))
		keywords.push("budget");
	if (/\b(consulta|agendar|marcar|horário)\b/.test(lower))
		keywords.push("appointment");
	if (/\b(tratamento|procedimento|dentista)\b/.test(lower))
		keywords.push("treatment");
	return keywords;
}

function calculateWhatsAppLeadScore(keywords: string[]): number {
	if (keywords.includes("budget")) return 30;
	if (keywords.includes("appointment")) return 25;
	if (keywords.includes("treatment")) return 20;
	return 5;
}

export async function captureLeadFromWhatsApp(
	phone: string,
	messageText: string,
	clinicId: string,
): Promise<LeadCaptureResult> {
	const defaultStageId = await leadRepo.getDefaultStageId(clinicId);
	const messageKeywords = extractWhatsAppKeywords(messageText);
	const score = calculateWhatsAppLeadScore(messageKeywords);

	const existingLead = await leadRepo.findLeadByPhone(phone, clinicId);

	if (existingLead) {
		await leadRepo.updateLeadLastContact(
			existingLead.id,
			messageKeywords.length > 0 ? score : undefined,
		);
		return {
			created: false,
			leadId: existingLead.id,
			score,
			wasExisting: true,
		};
	}

	const newLead = await leadRepo.createLead({
		clinicId,
		phone,
		name: "Desconhecido",
		source: "whatsapp",
		stageId: defaultStageId ?? undefined,
		score,
	});

	if (!newLead) {
		dbLogger.error(
			"Failed to capture lead from WhatsApp",
			new Error("null result"),
		);
		return { created: false, leadId: "", score, wasExisting: false };
	}

	return { created: true, leadId: newLead.id, score, wasExisting: false };
}

export async function convertLeadToPatient(
	leadId: string,
	patientId: string,
): Promise<boolean> {
	const lead = await leadRepo.convertLeadToPatient(leadId, patientId);
	return lead !== null;
}

export async function getLeadStats(clinicId: string): Promise<{
	total: number;
	byStatus: Record<LeadStatus, number>;
	byTemperature: Record<LeadTemperature, number>;
	conversionRate: number;
	avgScore: number;
}> {
	const stats = await leadRepo.getLeadStats(clinicId);
	return {
		total: stats.total,
		byStatus: stats.byStatus as Record<LeadStatus, number>,
		byTemperature: stats.byTemperature as Record<LeadTemperature, number>,
		conversionRate: stats.conversionRate,
		avgScore: stats.avgScore,
	};
}
