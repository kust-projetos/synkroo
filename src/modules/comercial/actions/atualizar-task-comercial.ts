import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { atualizarTask } from '../services/tasks-service';

export const atualizarTaskComercial = defineAction({
  name: 'comercial.atualizarTaskComercial',
  module: 'comercial',
  requires: 'comercial:manage_tasks',
  label: 'Atualizar task comercial',
  input: z.object({
    clinicId: z.string().uuid(),
    taskId: z.string().uuid(),
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    status: z.string().optional(),
    assignedTo: z.string().uuid().nullable().optional(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.dueDate !== undefined) patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.status !== undefined) patch.status = input.status;
    if (input.assignedTo !== undefined) patch.assignedTo = input.assignedTo;

    return atualizarTask(input.clinicId, input.taskId, patch);
  },
});
