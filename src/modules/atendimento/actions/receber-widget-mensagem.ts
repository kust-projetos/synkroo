import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

/**
 * Widget message receive action.
 * Currently disabled — legacy agent removed.
 * TODO(W5.3): reconnect to new agent.
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
  handler: async (_input, _ctx: ActionContext) => {
    return {
      success: false,
      disabled: true,
      reason: 'legacy_agent_removed',
      todo: 'TODO(W5.3): reconnect to new agent',
    };
  },
});
