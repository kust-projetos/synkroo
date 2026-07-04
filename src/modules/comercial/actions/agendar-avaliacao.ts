import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

/**
 * agendarAvaliacao — Cross-module bridge to E-02 (agendamento).
 *
 * Stub: full orchestration (ensure patient + schedule via
 * operacional.criarPaciente + operacional.agendarConsulta) will be
 * implemented in Task 5 (cross-module bridges).
 */
export const agendarAvaliacao = defineAction({
  name: 'comercial.agendarAvaliacao',
  module: 'comercial',
  requires: 'comercial:edit_leads',
  label: 'Agendar avaliação',
  input: z.object({
    leadId: z.string().uuid(),
    clinicId: z.string().uuid(),
    patientId: z.string().uuid().optional(),
  }),
  handler: async (_input, _ctx: ActionContext) => {
    // TODO: Task 5 — call operacional.criarPaciente + operacional.agendarConsulta
    throw new Error('agendarAvaliacao: not yet implemented (Task 5)');
  },
});
