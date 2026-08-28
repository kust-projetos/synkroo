import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { anonymizePatient } from '../services/lgpd-service';

export const anonimizarPaciente = defineAction({
  name: 'operacional.anonimizarPaciente',
  module: 'operacional',
  requires: 'lgpd:anonymize',
  label: 'Anonimizar paciente (LGPD)',
  input: z.object({ patientId: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    const actorUserId = ctx.user?.id ?? null;
    return anonymizePatient(ctx.clinicId, input.patientId, actorUserId);
  },
});
