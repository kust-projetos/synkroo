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

export interface CampaignBatchResult {
  requested: number;
  /** Campanhas agendadas encontradas para a clínica. */
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
  success: boolean;
  status: 'completed' | 'partial' | 'failed';
}

interface CampaignEnqueueOutcome {
  requested: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

async function startCampaign(campaign: campaignRepo.CampaignRow): Promise<CampaignEnqueueOutcome> {
  await campaignRepo.updateCampaignStatus(campaign.id, 'running');
  const recipients = await campaignRepo.findPendingRecipients(campaign.id);
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const recipient of recipients) {
    if (recipient.optOutMarketing || recipient.optOutReminders) {
      await campaignRepo.markRecipientSuppressed(recipient.id, 'opt-out');
      skipped++;
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
      succeeded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CAMPAIGN_ENQUEUE_FAILED';
      await campaignRepo.markRecipientError(recipient.id, message);
      failed++;
      errors.push(`Campaign ${campaign.id} recipient ${recipient.id}: ${message}`);
    }
  }
  await campaignRepo.updateCampaignCounts(campaign.id);
  return { requested: recipients.length, succeeded, failed, skipped, errors };
}

export async function processScheduledCampaigns(clinicId: string, now = new Date()): Promise<CampaignBatchResult> {
  const scheduled = await campaignRepo.findScheduledCampaigns(clinicId, now);
  const aggregate: CampaignEnqueueOutcome = { requested: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
  for (const campaign of scheduled) {
    const outcome = await startCampaign(campaign);
    aggregate.requested += outcome.requested;
    aggregate.succeeded += outcome.succeeded;
    aggregate.failed += outcome.failed;
    aggregate.skipped += outcome.skipped;
    aggregate.errors.push(...outcome.errors);
  }
  const success = aggregate.failed === 0;
  const status = aggregate.failed === 0 ? 'completed' : aggregate.succeeded > 0 ? 'partial' : 'failed';
  dbLogger.info('scheduled campaigns processed', { clinicId, count: scheduled.length });
  return { ...aggregate, processed: scheduled.length, success, status };
}

export async function executarCampanhas(clinicId: string): Promise<CampaignBatchResult> {
  return processScheduledCampaigns(clinicId);
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
