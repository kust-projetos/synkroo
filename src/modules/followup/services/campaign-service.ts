/**
 * Campaign bridge — wraps legacy followup campaign + segmentation services.
 */

import * as campaignLegacy from '@/services/followup/campaign.service';
import * as segmentationLegacy from '@/services/followup/segmentation.service';
import type { Segment } from '@/services/followup/segmentation.service';

export type { Campaign, CampaignRecipient } from '@/services/followup/campaign.service';
export type { Segment };
export type { SegmentCriteria } from '@/services/followup/segmentation.service';

export async function executarCampanhas(): Promise<{ processed: number; sent?: number; failed?: number }> {
  await campaignLegacy.processScheduledCampaigns();
  return { processed: 1 };
}

export async function listarSegmentos(clinicId: string): Promise<{ segments: Segment[]; total: number }> {
  const segments = await segmentationLegacy.listSegments(clinicId);
  return { segments, total: segments.length };
}
