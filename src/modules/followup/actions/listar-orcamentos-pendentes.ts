import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/budget-followup-service';

export const listarOrcamentosPendentes = defineAction({
  name: 'followup.listarOrcamentosPendentes',
  module: 'followup',
  requires: 'followup:view',
  label: 'Listar orçamentos pendentes de conversão',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    return service.listarOrcamentosPendentes(ctx.clinicId);
  },
});
