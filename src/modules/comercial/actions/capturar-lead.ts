import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { captureLead } from '../services/lead-capture-service';

export const capturarLead = defineAction({
  name: 'comercial.capturarLead',
  module: 'comercial',
  requires: 'comercial:capture_leads',
  label: 'Capturar lead',
  input: z.object({
    name: z.string().min(1),
    phone: z.string().min(1),
    source: z.string(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return captureLead({ ...input, clinicId: ctx.clinicId });
  },
});
