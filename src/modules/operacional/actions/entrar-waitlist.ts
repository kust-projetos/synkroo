import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { insertWaitlist } from '../repositories/waitlist-repository';

export const entrarWaitlist = defineAction({
  name: 'operacional.entrarWaitlist',
  module: 'operacional',
  requires: 'operacional:manage_waitlist',
  label: 'Entrar na waitlist',
  input: z.object({
    patientId: z.string().uuid(),
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
    preferredTimeStart: z.string(),
    preferredTimeEnd: z.string().optional(),
    dentistId: z.string().uuid().optional(),
    procedureId: z.string().uuid().optional(),
    priority: z.number().int().optional(),
    notes: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const today = new Date().toDateString();
    if (new Date(input.preferredDate) < new Date(today)) {
      throw new ActionError('invalid_input', 'preferredDate must be today or in the future');
    }
    const entry = await insertWaitlist({ clinicId: ctx.clinicId, ...input });
    return { id: entry.id };
  },
});
