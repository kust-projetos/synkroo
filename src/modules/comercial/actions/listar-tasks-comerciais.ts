import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { listarTasks } from '../services/tasks-service';

export const listarTasksComerciais = defineAction({
  name: 'comercial.listarTasksComerciais',
  module: 'comercial',
  requires: 'comercial:view',
  label: 'Listar tasks comerciais',
  input: z.object({
    clinicId: z.string().uuid(),
    leadId: z.string().uuid().optional(),
    status: z.string().optional(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const tasks = await listarTasks(input.clinicId, {
      leadId: input.leadId,
      status: input.status,
    });
    return { tasks, total: tasks.length };
  },
});
