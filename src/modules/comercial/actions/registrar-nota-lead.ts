import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { findLeadByIdForClinic } from '../repositories/leads-repository';
import { insertActivity } from '../repositories/activities-repository';

/**
 * Owner-bridge CRM → comercial: registra uma nota na timeline do lead
 * (insere em lead_activities com activityType='note').
 * Resolve o lead com predicate ownerId+clinicId ANTES de inserir —
 * se o lead não existir na clínica do contexto, devolve not_found
 * sem chamar insertActivity.
 */
export const registrarNotaLead = defineAction({
  name: 'comercial.registrarNotaLead',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Registrar nota do lead',
  auditFields: ['leadId', 'activityId'],
  input: z.object({
    leadId: z.string().uuid(),
    description: z.string().min(1),
  }),
  handler: async (input, ctx: ActionContext) => {
    const lead = await findLeadByIdForClinic(input.leadId, ctx.clinicId);
    if (!lead) {
      throw new ActionError('not_found', 'Lead não encontrado.');
    }
    const result = await insertActivity({
      leadId: input.leadId,
      activityType: 'note',
      description: input.description,
    });
    return result;
  },
});