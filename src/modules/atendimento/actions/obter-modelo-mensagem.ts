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
    // If a conversation is provided, get the clinic from it
    let clinicId = ctx.clinicId;
    if (input.conversationId) {
      const conv = await repo.findById(input.conversationId);
      if (conv) clinicId = conv.clinicId;
    }
    const templates = await getApprovedTemplates(clinicId);
    return { templates };
  },
});
