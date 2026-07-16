import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import {
  findLeadByIdForClinic,
  normalizeLeadTags,
  updateLeadTags,
} from '../repositories/leads-repository';

/**
 * Owner-bridge CRM → comercial: atualiza as tags do lead com normalização
 * (trim + dedup case-insensitive preservando a primeira ocorrência)
 * e predicate ownerId+clinicId.
 */
export const atualizarTagsLead = defineAction({
  name: 'comercial.atualizarTagsLead',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Atualizar tags do lead',
  input: z.object({
    leadId: z.string().uuid(),
    tags: z.array(z.string()).default([]),
  }),
  handler: async (input, ctx: ActionContext) => {
    const lead = await findLeadByIdForClinic(input.leadId, ctx.clinicId);
    if (!lead) {
      throw new ActionError('not_found', 'Lead não encontrado.');
    }
    const tags = normalizeLeadTags(input.tags);
    const updated = await updateLeadTags(input.leadId, ctx.clinicId, tags);
    if (!updated) {
      throw new ActionError('not_found', 'Lead não encontrado.');
    }
    return { id: updated.id, tags };
  },
});