import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { fecharTask } from '../services/tasks-service';

export const fecharTaskComercial = defineAction({
  name: 'comercial.fecharTaskComercial',
  module: 'comercial',
  requires: 'comercial:manage_tasks',
  label: 'Fechar task comercial',
  input: z.object({
    taskId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return fecharTask(ctx.clinicId, input.taskId);
  },
});
