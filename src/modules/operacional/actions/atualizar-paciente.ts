import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { recalculateDuplicatesForPatient } from '@/modules/crm';
import { atualizarPaciente as service } from '../services/patients-service';

export const atualizarPaciente = defineAction({
  name: 'operacional.atualizarPaciente',
  module: 'operacional',
  requires: 'operacional:manage_patients',
  label: 'Atualizar paciente',
  input: z.object({
    id: z.string().uuid(),
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    notes: z.string().optional(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const result = await service({ clinicId: ctx.clinicId, ...input });
    await recalculateDuplicatesForPatient({
      clinicId: ctx.clinicId,
      patientId: result.id,
    });
    return result;
  },
});
