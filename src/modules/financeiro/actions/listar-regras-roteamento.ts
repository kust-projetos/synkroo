import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listRoutingRules } from '../services/gateway-config-service';

export const listarRegrasRoteamento = defineAction({
  name: 'financeiro.listarRegrasRoteamento',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar regras de roteamento',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    const rules = await listRoutingRules(ctx.clinicId);
    return { data: rules };
  },
});
