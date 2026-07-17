import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listarDentistas as service } from '../services/catalog-service';

export const listarDentistas = defineAction({
  name: 'operacional.listarDentistas',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Listar dentistas',
  input: z.object({
    activeOnly: z.boolean().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    service(ctx.clinicId, input),
});
