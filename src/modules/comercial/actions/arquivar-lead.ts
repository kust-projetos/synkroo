import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { updateLead, findLeadByIdForClinic } from '../repositories/leads-repository';

export const arquivarLead = defineAction({
  name: 'comercial.arquivarLead',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Arquivar lead',
  input: z.object({
    leadId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const existing = await findLeadByIdForClinic(input.leadId, ctx.clinicId);
    if (!existing) throw new ActionError('not_found', 'Lead não encontrado.');
    const updated = await updateLead(input.leadId, ctx.clinicId, {
      status: 'lost',
      lostReason: 'Archived',
    });
    if (!updated) throw new ActionError('not_found', 'Lead não encontrado.');
    return { success: true };
  },
});
