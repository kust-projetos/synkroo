import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as repo from '../repositories/conversations-repository';

export const iniciarConversa = defineAction({
  name: 'atendimento.iniciarConversa',
  module: 'atendimento',
  requires: 'atendimento:manage_conversations',
  label: 'Iniciar conversa',
  input: z.object({
    patientId: z.string().optional(),
    channel: z.enum(['whatsapp', 'instagram', 'web', 'telegram']),
    externalId: z.string(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await repo.createConversation({
      clinicId: ctx.clinicId,
      channel: input.channel,
      externalId: input.externalId,
      patientId: input.patientId,
    });
    return result;
  },
});
