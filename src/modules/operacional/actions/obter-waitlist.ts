import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { findWaitlistById } from '../repositories/waitlist-repository';

export const obterWaitlist = defineAction({
  name: 'operacional.obterWaitlist',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Obter entrada da waitlist',
  input: z.object({
    id: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const entry = await findWaitlistById(input.id, ctx.clinicId);
    if (!entry) throw new ActionError('not_found', 'Entrada da waitlist não encontrada');
    return entry;
  },
});
