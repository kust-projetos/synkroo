import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const escalarConversa = defineAction({
  name: 'atendimento.escalarConversa',
  module: 'atendimento',
  requires: 'atendimento:escalate',
  label: 'Escalar conversa para humano',
  input: z.object({
    id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const row = await repo.escalateConversation(input.id, ctx.clinicId);
    if (!row) throw new ActionError('not_found', 'Conversa não encontrada.');
    return { id: row.id, reason: input.reason };
  },
});
