import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listGateways } from '../services/gateway-config-service';

export const listarGateways = defineAction({
  name: 'financeiro.listarGateways',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Listar gateways',
  input: z.object({}),
  handler: async (_input, ctx: ActionContext) => {
    const gateways = await listGateways(ctx.clinicId);
    return { data: gateways };
  },
});
