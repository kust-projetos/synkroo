import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import * as service from '../services/inactive-service';

export const reativarPaciente = defineAction({
  name: 'followup.reativarPaciente',
  module: 'followup',
  requires: 'followup:manage_followups',
  label: 'Reativar paciente inativo',
  input: z.object({
    patientId: z.string().uuid(),
  }),
  handler: async (input, _ctx: ActionContext) => {
    return service.reactivatePatient(input.patientId);
  },
});
