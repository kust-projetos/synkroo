import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

export const obterDashboard = defineAction({
  name: 'financeiro.obterDashboard',
  module: 'financeiro',
  requires: 'financeiro:view',
  label: 'Obter dashboard',
  input: z.object({
    clinicId: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    throw new Error('Not yet im
