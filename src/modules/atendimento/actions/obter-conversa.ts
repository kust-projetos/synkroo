import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const obterConversa = defineAction({
  name: 'atendimento.obterConversa',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Obter conversa',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const conversation = await repo.findByIdWithJoins(input.id, ctx.clinicId);
    if (!conversation) throw new ActionError('not_found', 'Conversa não encontrada.');
    const messages = await repo.findMessagesByConversation(ctx.clinicId, input.id);
    return { conversation, messages };
  },
});
