import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

/**
 * Retired widget action. The HTTP endpoint returns 410 until a replacement channel is introduced.
 */
export const receberWidgetMensagem = defineAction({
  name: 'atendimento.receberWidgetMensagem',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Receber mensagem do widget web',
  input: z.object({
    name: z.string().optional(),
    phone: z.string().optional(),
    message: z.string(),
    clinicId: z.string().optional(),
  }),
  handler: async (_input, _ctx: ActionContext) => ({
    success: false,
    code: 'WIDGET_MESSAGING_RETIRED',
  }),
});
