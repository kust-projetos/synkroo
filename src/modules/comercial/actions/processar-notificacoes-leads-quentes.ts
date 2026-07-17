import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { processarNotificacoesLeadsQuentesHandler } from '../services/hot-lead-notification-service';

export const processarNotificacoesLeadsQuentes = defineAction({
  name: 'comercial.processarNotificacoesLeadsQuentes',
  module: 'comercial',
  requires: 'comercial:manage_hot_leads',
  label: 'Processar notificações de leads quentes',
  input: z.object({
    clinicId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    return processarNotificacoesLeadsQuentesHandler({ clinicId: input.clinicId });
  },
});
