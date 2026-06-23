import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { obterDentista as service } from '../services/catalog-service';

export const obterDentista = defineAction({
  name: 'operacional.obterDentista',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Obter dentista',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) =>
    service(ctx.clinicId, input.id),
});
