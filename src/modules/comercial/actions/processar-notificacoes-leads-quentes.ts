import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

/**
 * processarNotificacoesLeadsQuentes — Hot-lead notification cron action.
 *
 * Stub: full implementation (resolve recipients, call
 * atendimento.enviarMensagemDireta) will be done in Task 5.
 */
export const processarNotificacoesLeadsQuentes = defineAction({
  name: 'comercial.processarNotificacoesLeadsQuentes',
  module: 'comercial',
  requires: 'comercial:manage_hot_leads',
  label: 'Processar notificações de leads quentes',
  input: z.object({
    clinicId: z.string().uuid(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: Task 5 — implement notification logic
    return { notified: 0, skipped: 0, message: 'not yet implemented (Task 5)' };
  },
});
