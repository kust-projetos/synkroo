import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { criarTask } from '../services/tasks-service';

export const criarTaskComercial = defineAction({
  name: 'comercial.criarTaskComercial',
  module: 'comercial',
  requires: 'comercial:manage_tasks',
  label: 'Criar task comercial',
  input: z.object({
    leadId: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    dueDate: z.string().datetime().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    assignedTo: z.string().uuid().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return criarTask({
      ...input,
      clinicId: ctx.clinicId,
      leadId: input.leadId ?? null,
      description: input.description ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      priority: input.priority ?? 'medium',
      assignedTo: input.assignedTo ?? null,
    });
  },
});
