import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { findLeadByIdForClinic } from '../repositories/leads-repository';

export const obterLead = defineAction({
  name: 'comercial.obterLead',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Obter lead',
  input: z.object({
    leadId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const lead = await findLeadByIdForClinic(input.leadId, ctx.clinicId);
    if (!lead) throw new ActionError('not_found', 'Lead não encontrado.');
    return lead;
  },
});
