import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { recalculateDuplicatesForLead } from '@/modules/crm';
import { captureLead } from '../services/lead-capture-service';

export const capturarLead = defineAction({
  name: 'comercial.capturarLead',
  module: 'comercial',
  requires: 'comercial:capture_leads',
  label: 'Capturar lead',
  input: z.object({
    clinicId: z.string().uuid().optional(),
    name: z.string().min(1),
    phone: z.string().min(1),
    source: z.string(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await captureLead({ ...input, clinicId: ctx.clinicId });
    await recalculateDuplicatesForLead({
      clinicId: ctx.clinicId,
      leadId: result.leadId,
    });
    return result;
  },
});
