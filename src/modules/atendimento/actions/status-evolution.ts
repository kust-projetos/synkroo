import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { getEvolutionService, getInstanceInfo } from '../services/evolution-service';

export const statusEvolution = defineAction({
  name: 'atendimento.statusEvolution',
  module: 'atendimento',
  requires: 'atendimento:view',
  label: 'Status da instância Evolution',
  input: z.object({}).optional(),
  handler: async (_input, ctx: ActionContext) => {
    const evolution = getEvolutionService();
    const instances = await getInstanceInfo(ctx.clinicId);

    return {
      evolutionAvailable: evolution !== null,
      instances: instances.map((i) => ({
        instanceName: i.instanceName,
        status: i.status ?? 'unknown',
        lastConnectedAt: i.lastConnectedAt,
        createdAt: i.createdAt,
      })),
    };
  },
});
