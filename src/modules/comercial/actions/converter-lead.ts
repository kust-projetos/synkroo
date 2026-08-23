import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { updateLead, findLeadByIdForClinic } from '../repositories/leads-repository';

export const converterLead = defineAction({
  name: 'comercial.converterLead',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Converter lead',
  input: z.object({
    leadId: z.string().uuid(),
    clinicId: z.string().uuid(),
    patientId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    const existing = await findLeadByIdForClinic(input.leadId, input.clinicId);
    if (!existing) throw new ActionError('not_found', 'Lead não encontrado.');

    const patch: Record<string, unknown> = {
      status: 'converted',
      patientId: input.patientId,
    };
    const updated = await updateLead(input.leadId, input.clinicId, patch);
    if (!updated) throw new ActionError('not_found', 'Lead não encontrado.');
    return { id: updated.id, status: 'converted' };
  },
});
