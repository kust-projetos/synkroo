import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { atualizarDentista as service } from '../services/catalog-service';

export const atualizarDentista = defineAction({
  name: 'operacional.atualizarDentista',
  module: 'operacional',
  requires: 'operacional:manage_catalog',
  label: 'Atualizar dentista',
  input: z.object({
    id: z.string().uuid(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    specialty: z.string().optional(),
    cro: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    service(ctx.clinicId, input.id, input),
});
