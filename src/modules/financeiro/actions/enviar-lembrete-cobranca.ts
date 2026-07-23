import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { sendReminder } from '../services/collection-service';

export const enviarLembreteCobranca = defineAction({
  name: 'financeiro.enviarLembreteCobranca',
  module: 'financeiro',
  requires: 'financeiro:manage_collections',
  label: 'Enviar lembrete de cobrança',
  input: z.object({
    clinicId: z.string().uuid(),
    chargeId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await sendReminder({
      clinicId: ctx.clinicId,
      chargeId: input.chargeId,
    });
    return result;
  },
});
