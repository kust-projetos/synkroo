import { ActionError } from '@/core/actions/types';
import {
  findLeadByIdForClinic,
  normalizeLeadTags,
  updateLeadTags as persistLeadTags,
} from '../repositories/leads-repository';
import { insertActivity } from '../repositories/activities-repository';

export interface LeadNoteInput {
  clinicId: string;
  leadId: string;
  content: string;
  actorUserId: string | null;
}

export interface LeadTagsInput {
  clinicId: string;
  leadId: string;
  tags: string[];
  actorUserId: string | null;
}

export async function registerLeadNote(input: LeadNoteInput) {
  const lead = await findLeadByIdForClinic(input.leadId, input.clinicId);
  if (!lead) {
    throw new ActionError('not_found', 'Lead não encontrado.');
  }

  return insertActivity({
    leadId: input.leadId,
    activityType: 'note',
    description: input.content,
  });
}

export async function updateLeadTags(input: LeadTagsInput) {
  const lead = await findLeadByIdForClinic(input.leadId, input.clinicId);
  if (!lead) {
    throw new ActionError('not_found', 'Lead não encontrado.');
  }

  const tags = normalizeLeadTags(input.tags);
  const updated = await persistLeadTags(input.leadId, input.clinicId, tags);
  if (!updated) {
    throw new ActionError('not_found', 'Lead não encontrado.');
  }

  return { id: updated.id, tags };
}
