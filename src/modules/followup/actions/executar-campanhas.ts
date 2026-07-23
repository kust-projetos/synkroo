import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/campaign-service';

export const executarCampanhas = defineAction({
  name: 'followup.executarCampanhas',
  module: 'followup',
  requires: 'followup:manage_campaigns',
  label: 'Executar campanhas agendadas',
  input: z.object({}),
  handler: async (_input, _ctx: ActionContext) => {
    return service.executarCampanhas();
  },
});
