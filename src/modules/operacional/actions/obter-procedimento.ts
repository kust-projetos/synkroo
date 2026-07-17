import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { obterProcedimento as service } from '../services/catalog-service';

export const obterProcedimento = defineAction({
  name: 'operacional.obterProcedimento',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Obter procedimento',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) =>
    service(ctx.clinicId, input.id),
});
