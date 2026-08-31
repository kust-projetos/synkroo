import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { campaignSegments } from '@/modules/followup/schema/campaigns';
import { dbLogger } from '@/lib/logger';
import * as campaignRepo from '../repositories/campaigns-repository';

export type Campaign = campaignRepo.CampaignRow;
export type CampaignRecipient = campaignRepo.CampaignRecipientRow;

function toSegment(row: typeof campaignSegments.$inferSelect) {
  return {
    id: row.id,
    clinic_id: row.clinicId,
    name: row.name,
    description: row.description ?? null,
    criteria: row.criteria,
    patient_count: row.patientCount ?? 0,
    created_by: row.createdBy ?? null,
    created_at: row.createdAt?.toISOString() ?? '',
    updated_at: row.updatedAt?.toISOString() ?? '',
  };
}

async function startCampaign(campaign: campaignRepo.CampaignRow): Promise<void> {
  await campaignRepo.updateCampaignStatus(campaign.id, 'running');
  const recipients = await campaignRepo.findPendingRecipients(campaign.id);
  for (const recipient of recipients) {
    if (recipient.optOutMarketing || recipient.optOutReminders) {
      await campaignRepo.markRecipientSuppressed(recipient.id, 'opt-out');
      continue;
    }
    try {
      await campaignRepo.enqueueRecipientDelivery({
        clinicId: campaign.clinicId,
        campaignId: campaign.id,
        recipientId: recipient.id,
        patientId: recipient.patientId,
        phone: recipient.patientPhone ?? '',
        message: campaign.messageTemplate,
      });
    } catch (error) {
      await campaignRepo.markRecipientError(recipient.id, error instanceof Error ? error.message : 'CAMPAIGN_ENQUEUE_FAILED');
    }
  }
  await campaignRepo.updateCampaignCounts(campaign.id);
}

export async function processScheduledCampaigns(clinicId: string, now = new Date()): Promise<void> {
  const scheduled = await campaignRepo.findScheduledCampaigns(clinicId, now);
  for (const campaign of scheduled) await startCampaign(campaign);
  dbLogger.info('scheduled campaigns processed', { clinicId, count: scheduled.length });
}

export async function executarCampanhas(clinicId: string): Promise<{ processed: number }> {
  await processScheduledCampaigns(clinicId);
  return { processed: 1 };
}

export async function listarSegmentos(clinicId: string) {
  try {
    const rows = await getDb().select().from(campaignSegments)
      .where(eq(campaignSegments.clinicId, clinicId)).orderBy(desc(campaignSegments.createdAt));
    const segments = rows.map(toSegment);
    return { segments, total: segments.length };
  } catch (error) {
    dbLogger.error('Error listing segments', error);
    return { segments: [], total: 0 };
  }
}
