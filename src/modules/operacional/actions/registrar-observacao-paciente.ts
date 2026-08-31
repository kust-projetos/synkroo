import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { registerPatientObservation } from '../services/patient-owner-service';

/**
 * Owner-bridge CRM → operacional: registra uma observação no prontuário do
 * paciente. clinicId sempre derivado de ctx (nunca aceito no input) e
 * predicado ownerId+clinicId garante isolamento entre clínicas.
 */
export const registrarObservacaoPaciente = defineAction({
  name: 'operacional.registrarObservacaoPaciente',
  module: 'operacional',
  requires: 'operacional:manage_patients',
  label: 'Registrar observação do paciente',
  auditFields: ['patientId', 'observationId'],
  input: z.object({
    patientId: z.string().uuid(),
    content: z.string().min(1),
  }),
  handler: async (input, ctx: ActionContext) => registerPatientObservation({
    clinicId: ctx.clinicId,
    patientId: input.patientId,
    content: input.content,
    actorUserId: ctx.user?.id ?? null,
  }),
});
