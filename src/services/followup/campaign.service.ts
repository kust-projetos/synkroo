/**
 * Campaign Service
 * Handles reactivation campaigns, budget follow-ups, and patient engagement
 * Migrated from Supabase to Drizzle
 */

import { dbLogger } from "@/lib/logger";
import * as campaignRepo from "@/repositories/campaigns";
import { hasActiveConsent } from '@/services/contacts/consents.service';
import { withIdempotency } from '@/lib/idempotency';

type PatientBasic = { id: string; name: string; phone: string };

export interface Campaign {
	id: string;
	clinicId: string;
	name: string;
	description?: string;
	campaignType: "reactivation" | "retention" | "promotional" | "follow_up";
	targetSegment?: string;
	messageTemplate: string;
	channel: string;
	status:
		| "draft"
		| "scheduled"
		| "running"
		| "paused"
		| "completed"
		| "failed"
		| "partial"
		| "cancelled";
	scheduledAt?: Date;
	startedAt?: Date;
	completedAt?: Date;
	totalRecipients: number;
	sentCount: number;
	responseCount: number;
	conversionCount: number;
	optOutCount: number;
}

export interface CampaignRecipient {
	campaignId: string;
	patientId: string;
	patientName: string;
	patientPhone: string;
	status:
		| "pending"
		| "sent"
		| "delivered"
		| "failed"
		| "responded"
		| "converted"
		| "opted_out";
}

// ─── Type adapters ─────────────────────────────────────────────

function repoCampaignToService(c: campaignRepo.CampaignRow): Campaign {
	return {
		id: c.id,
		clinicId: c.clinicId,
		name: c.name,
		description: c.description ?? undefined,
		campaignType: c.campaignType as Campaign["campaignType"],
		targetSegment: c.targetSegment ?? undefined,
		messageTemplate: c.messageTemplate,
		channel: c.channel,
		status: c.status as Campaign["status"],
		scheduledAt: c.scheduledAt ?? undefined,
		startedAt: c.startedAt ?? undefined,
		completedAt: c.completedAt ?? undefined,
		totalRecipients: c.totalRecipients,
		sentCount: c.sentCount,
		responseCount: c.responseCount,
		conversionCount: c.conversionCount,
		optOutCount: c.optOutCount,
	};
}

// ─── CRUD Operations ───────────────────────────────────────────

export async function createCampaign(params: {
	clinicId: string;
	name: string;
	description?: string;
	campaignType: string;
	targetSegment?: string;
	messageTemplate: string;
	channel?: string;
	scheduledAt?: Date;
}): Promise<{ success: boolean; campaign?: Campaign; error?: string }> {
	const campaign = await campaignRepo.createCampaign({
		clinicId: params.clinicId,
		name: params.name,
		description: params.description,
		campaignType: params.campaignType,
		targetSegment: params.targetSegment,
		messageTemplate: params.messageTemplate,
		channel: params.channel,
		scheduledAt: params.scheduledAt,
	});

	if (!campaign) {
		return { success: false, error: "Failed to create campaign" };
	}

	return { success: true, campaign: repoCampaignToService(campaign) };
}

export async function addCampaignRecipients(
	campaignId: string,
	patientIds: string[],
): Promise<{ success: boolean; added: number; error?: string }> {
	const added = await campaignRepo.addCampaignRecipients({
		campaignId,
		patientIds,
	});
	if (added === 0 && patientIds.length > 0) {
		return { success: false, added: 0, error: "Failed to add recipients" };
	}
	return { success: true, added };
}

export async function startCampaign(
	campaignId: string,
): Promise<{ success: boolean; error?: string }> {
	const outcome = await withIdempotency(
		`campaign:run:${campaignId}`,
		'campaign_execution',
		() => executeCampaign(campaignId),
	);

	if (outcome.status === 'completed' && outcome.result) return outcome.result;
	if (outcome.status === 'already_processed') return { success: true };
	return { success: false, error: 'Campaign execution already in progress' };
}

async function executeCampaign(
	campaignId: string,
): Promise<{ success: boolean; error?: string }> {
	const campaign = await campaignRepo.findCampaignById(campaignId);
	if (!campaign) {
		return { success: false, error: "Campaign not found" };
	}

	await campaignRepo.updateCampaignStatus(campaignId, "running");
	const recipients = await campaignRepo.findPendingRecipients(campaignId);
	let sent = 0;

	for (const recipient of recipients) {
		if (recipient.optOutMarketing || recipient.optOutReminders) {
			await campaignRepo.markRecipientSuppressed(recipient.id, 'opt-out');
			continue;
		}
		const consented = await hasActiveConsent(campaign.clinicId, recipient.patientId, 'patient', 'marketing');
		if (!consented) {
			await campaignRepo.markRecipientSuppressed(recipient.id, 'missing-consent');
			continue;
		}
		try {
      await campaignRepo.enqueueRecipientDelivery({
        clinicId: campaign.clinicId, campaignId: campaign.id, recipientId: recipient.id,
        patientId: recipient.patientId, phone: recipient.patientPhone ?? '', message: campaign.messageTemplate,
      });
      sent++;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'CAMPAIGN_SEND_FAILED';
			await campaignRepo.markRecipientError(recipient.id, message);
		}
	}

  await campaignRepo.updateCampaignCounts(campaignId);
  if (sent === 0) {
    await campaignRepo.updateCampaignStatus(campaignId, 'failed');
    return { success: false, error: 'No recipients delivered' };
  }
  return { success: true };
}

export async function getCampaigns(
	clinicId: string,
	status?: string,
): Promise<Campaign[]> {
	const campaigns = await campaignRepo.findCampaignsByClinic(clinicId);
	let result = campaigns.map(repoCampaignToService);
	if (status) {
		result = result.filter((c) => c.status === status);
	}
	return result;
}

// ─── Message Sending ───────────────────────────────────────────


// ─── Scheduled Processing ─────────────────────────────────────

export async function processScheduledCampaigns(clinicId: string, now = new Date()): Promise<void> {
	const campaigns = await campaignRepo.findScheduledCampaigns(clinicId, now);
	for (const campaign of campaigns) await startCampaign(campaign.id);
	dbLogger.info('scheduled campaigns processed', { clinicId, count: campaigns.length });
}

// ─── Reactivation Campaigns ───────────────────────────────────

export async function createReactivationCampaign(
	clinicId: string,
	targetSegment: string,
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
	const messages: Record<string, string> = {
		inactive_30: `Olá, {{patient_name}}! 👋

Sentimos sua falta! Já faz um tempo desde sua última visita.

Que tal agendar uma consulta de retorno? Sua saúde bucal agradece! 🦷

📅 Responda essa mensagem que eu te ajudo a agendar.`,
		inactive_60: `Olá, {{patient_name}}! 💙

Faz 2 meses que não apareceu na clínica. Estamos com horários disponíveis!

✨ Agende sua consulta de retorno e mantenha seu sorriso saudável.

📱 É só responder essa mensagem!`,
		inactive_90: `Olá, {{patient_name}}! 🦷

Faz 3 meses que não te vemos. Sua saúde bucal é importante!

🎁 Vamos oferecer um desconto especial de 10% para sua próxima consulta!

📅 Agende agora respondendo essa mensagem.`,
	};

	const messageTemplate = messages[targetSegment] || messages.inactive_60;

	const result = await createCampaign({
		clinicId,
		name: `Reativação - ${targetSegment.replace("inactive_", "")} dias`,
		description: `Campanha automática para pacientes inativos (${targetSegment})`,
		campaignType: "reactivation",
		targetSegment,
		messageTemplate,
	});

	if (!result.success || !result.campaign) {
		return { success: false, error: result.error };
	}

	return { success: true, campaignId: result.campaign.id };
}
