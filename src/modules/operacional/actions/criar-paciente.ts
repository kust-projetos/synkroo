import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { criarPaciente as service } from '../services/patients-service';

export const criarPaciente = defineAction({
  name: 'operacional.criarPaciente',
  module: 'operacional',
  requires: 'operacional:manage_patients',
  label: 'Criar paciente',
  input: z.object({
    name: z.string().min(1),
    phone: z.string().min(8),
    cpf: z.string().optional(),
    email: z.string().email().optional(),
    birthDate: z.string().optional(),
    gender: z.string().optional(),
    notes: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    return service({ clinicId: ctx.clinicId, ...input });
  },
});
