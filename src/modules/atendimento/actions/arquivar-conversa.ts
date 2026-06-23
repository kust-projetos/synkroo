import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const arquivarConversa = defineAction({
  name: 'atendimento.arquivarConversa',
  module: 'atendimento',
  requires: 'atendimento:manage_conversations',
  label: 'Arquivar conversa',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const row = await repo.archiveConversation(input.id, ctx.clinicId);
    if (!row) throw new ActionError('not_found', 'Conversa não encontrada.');
    return { success: true };
  },
});
