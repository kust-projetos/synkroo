import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { obterPaciente as service } from '../services/patients-service';

export const obterPaciente = defineAction({
  name: 'operacional.obterPaciente',
  module: 'operacional',
  requires: 'operacional:view',
  label: 'Obter paciente',
  input: z.object({ id: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => service(ctx.clinicId, input.id),
});
