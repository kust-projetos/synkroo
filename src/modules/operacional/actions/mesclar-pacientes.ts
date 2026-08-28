import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import { mergePatients } from '../repositories/patients-repository';

export const mesclarPacientes = defineAction({
  name: 'operacional.mesclarPacientes',
  module: 'operacional',
  requires: 'operacional:manage_patients',
  label: 'Mesclar pacientes duplicados',
  input: z.object({
    winnerId: z.string().uuid(),
    loserId: z.string().uuid(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const success = await mergePatients(
      input.winnerId,
      input.loserId,
      ctx.clinicId,
    );
    if (!success) throw new ActionError('not_found', 'Registros não encontrados.');
    return { success: true };
  },
});
