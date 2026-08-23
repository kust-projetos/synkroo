import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { assertClinicScope } from '@/core/actions/tenant-scope';
import { fecharTask } from '../services/tasks-service';

export const fecharTaskComercial = defineAction({
  name: 'comercial.fecharTaskComercial',
  module: 'comercial',
  requires: 'comercial:manage_tasks',
  label: 'Fechar task comercial',
  input: z.object({
    clinicId: z.string().uuid(),
    taskId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    assertClinicScope(input.clinicId, ctx);
    return fecharTask(input.clinicId, input.taskId);
  },
});
