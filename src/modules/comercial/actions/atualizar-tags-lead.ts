import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { updateLeadTags } from '../services/lead-owner-service';

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
  handler: async (input, ctx: ActionContext) => updateLeadTags({
    clinicId: ctx.clinicId,
    leadId: input.leadId,
    tags: input.tags,
    actorUserId: ctx.user?.id ?? null,
  }),
});
