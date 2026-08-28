import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { exportPatientData } from '../services/lgpd-service';

export const exportarDadosPaciente = defineAction({
  name: 'operacional.exportarDadosPaciente',
  module: 'operacional',
  requires: 'lgpd:export',
  label: 'Exportar dados do paciente (LGPD)',
  input: z.object({ patientId: z.string().uuid() }),
  handler: async (input, ctx: ActionContext) => {
    return exportPatientData(ctx.clinicId, input.patientId);
  },
});
