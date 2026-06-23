import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { cancelWaitlistEntry, findWaitlistById } from '../repositories/waitlist-repository';

export const cancelarWaitlist = defineAction({
  name: 'operacional.cancelarWaitlist',
  module: 'operacional',
  requires: 'operacional:manage_waitlist',
  label: 'Cancelar entrada da waitlist',
  input: z.object({
    id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const entry = await findWaitlistById(input.id);
    if (!entry) throw new ActionError('not_found', 'Waitlist entry not found');
    if (entry.clinicId !== ctx.clinicId) throw new ActionError('not_found', 'Waitlist entry not found');
    await cancelWaitlistEntry(input.id, input.reason);
    return { id: input.id };
  },
});
