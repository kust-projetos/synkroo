import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import {
  findById,
  insertPatientObservation,
} from '../repositories/patients-repository';

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
  sensitiveFields: ['content'],
  input: z.object({
    patientId: z.string().uuid(),
    content: z.string().min(1),
  }),
  handler: async (input, ctx: ActionContext) => {
    const patient = await findById(ctx.clinicId, input.patientId);
    if (!patient) {
      throw new ActionError('not_found', 'Paciente não encontrado.');
    }
    const result = await insertPatientObservation({
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      content: input.content,
      createdBy: ctx.user?.id ?? null,
    });
    return result;
  },
});