import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/inactive-service';

export const listarInativos = defineAction({
  name: 'followup.listarInativos',
  module: 'followup',
  requires: 'followup:view',
  label: 'Listar pacientes inativos',
  input: z.object({
    minDays: z.number().int().min(30).default(30),
    segment: z
      .enum(['inactive_30', 'inactive_60', 'inactive_90', 'inactive_180'])
      .optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  handler: async (input, ctx: ActionContext) => {
    const all = await service.findInactivePatients(ctx.clinicId, input.minDays);

    let filtered = all;
    if (input.segment) {
      filtered = all.filter((p) => p.inactivitySegment === input.segment);
    }

    const total = filtered.length;
    const offset = (input.page - 1) * input.limit;
    const items = filtered.slice(offset, offset + input.limit);

    return {
      patients: items,
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  },
});
