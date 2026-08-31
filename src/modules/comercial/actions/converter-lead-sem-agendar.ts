import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { converterLeadSemAgendar } from '../services/lead-conversion-service';

/**
 * Action: comercial.converterLeadSemAgendar
 *
 * Converts a lead to a patient without creating an appointment.
 * Used by Financeiro module when a lead budget is accepted.
 *
 * Permission: comercial:edit_leads (same scope as converterLead)
 */
export const converterLeadSemAgendarAction = defineAction({
  name: 'comercial.converterLeadSemAgendar',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Converter lead sem agendar',
  input: z.object({
    leadId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await converterLeadSemAgendar({
      ...input,
      clinicId: ctx.clinicId,
      actorUserId: ctx.user?.id ?? null,
    });
    return result;
  },
});
