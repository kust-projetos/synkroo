import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getApprovedTemplates } from '../services/templates-service';
import * as repo from '../repositories/conversations-repository';

export const obterModeloMensagem = defineAction({
  name: 'atendimento.obterModeloMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_templates',
  label: 'Obter modelos de mensagem',
  input: z.object({
    conversationId: z.string().uuid().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    // Never substitute ctx.clinicId by conversation's clinic. If conversationId provided, only validate ownership.
    if (input.conversationId) {
      const conv = await repo.findByIdForClinic(input.conversationId, ctx.clinicId);
      if (!conv) throw new (await import('@/core/actions/types')).ActionError('not_found', 'Conversa não encontrada.');
    }
    const templates = await getApprovedTemplates(ctx.clinicId);
    return { templates };
  },
});
