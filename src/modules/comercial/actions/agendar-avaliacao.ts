import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { agendarAvaliacao as service } from '../services/lead-conversion-service';

export const agendarAvaliacao = defineAction({
  name: 'comercial.agendarAvaliacao',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Agendar avaliação',
  input: z.object({
    leadId: z.string().uuid(),
    scheduledAt: z.coerce.date(),
    dentistId: z.string().uuid().optional(),
    procedureId: z.string().uuid().optional(),
    durationMinutes: z.number().int().positive().default(30),
    notes: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return service({ clinicId: ctx.clinicId, ...input });
  },
});
