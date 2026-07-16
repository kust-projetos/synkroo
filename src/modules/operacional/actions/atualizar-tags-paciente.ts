import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import {
  findById,
  normalizeTags,
  updatePatientTags,
} from '../repositories/patients-repository';

/**
 * Owner-bridge CRM → operacional: atualiza as tags do paciente com
 * normalização (trim + dedup case-insensitive preservando a primeira
 * ocorrência) e predicate ownerId+clinicId.
 */
export const atualizarTagsPaciente = defineAction({
  name: 'operacional.atualizarTagsPaciente',
  module: 'operacional',
  requires: 'operacional:manage_patients',
  label: 'Atualizar tags do paciente',
  input: z.object({
    patientId: z.string().uuid(),
    tags: z.array(z.string()).default([]),
  }),
  handler: async (input, ctx: ActionContext) => {
    const patient = await findById(ctx.clinicId, input.patientId);
    if (!patient) {
      throw new ActionError('not_found', 'Paciente não encontrado.');
    }
    const tags = normalizeTags(input.tags);
    const updated = await updatePatientTags(ctx.clinicId, input.patientId, tags);
    if (!updated) {
      throw new ActionError('not_found', 'Paciente não encontrado.');
    }
    return { id: updated.id, tags };
  },
});