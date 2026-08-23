import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { preencherVagaWaitlist } from '../repositories/waitlist-repository';

export const preencherWaitlist = defineAction({
  name: 'operacional.preencherWaitlist',
  module: 'operacional',
  requires: 'operacional:manage_waitlist',
  label: 'Preencher vaga a partir da waitlist',
  input: z.object({
    waitlistId: z.string().uuid(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int().positive().default(30),
    dentistId: z.string().uuid().optional(),
    procedureId: z.string().uuid().optional(),
    notes: z.string().max(1000).optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    try {
      const result = await preencherVagaWaitlist(ctx.clinicId, {
        waitlistId: input.waitlistId,
        scheduledAt: input.scheduledAt,
        durationMinutes: input.durationMinutes,
        dentistId: input.dentistId,
        procedureId: input.procedureId,
        notes: input.notes,
      });
      return result;
    } catch (err: unknown) {
      if (err instanceof ActionError) throw err;
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (code === '23P01') {
        throw new ActionError('conflict', 'Horário indisponível para este dentista.');
      }
      throw err;
    }
  },
});
