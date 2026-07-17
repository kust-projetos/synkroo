import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { criarDentista as service } from '../services/catalog-service';

export const criarDentista = defineAction({
  name: 'operacional.criarDentista',
  module: 'operacional',
  requires: 'operacional:manage_catalog',
  label: 'Criar dentista',
  input: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    specialty: z.string().optional(),
    cro: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) =>
    service({ clinicId: ctx.clinicId, ...input }),
});
