import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { updatePatientTags } from '../services/patient-owner-service';

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
  handler: async (input, ctx: ActionContext) => updatePatientTags({
    clinicId: ctx.clinicId,
    patientId: input.patientId,
    tags: input.tags,
    actorUserId: ctx.user?.id ?? null,
  }),
});
