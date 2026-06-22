import { z } from 'zod';
import { defineAction } from '@/core/actions/registry';
import { ActionContext } from '@/core/actions/types';
import { cancelAppointment } from '../services/scheduling-service';

const CancelarConsultaInput = z.object({
  appointmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type CancelarConsultaOutput = { success: boolean };

export const cancelarConsulta = defineAction({
  name: 'operacional:cancelar_consulta',
  module: 'operacional',
  requires: 'appointments:write',
  label: 'Cancelar consulta',
  description: 'Cancela um agendamento existente.',
  input: CancelarConsultaInput,
  async handler(input: z.infer<typeof CancelarConsultaInput>, _ctx: ActionContext) {
    return cancelAppointment(input.appointmentId, input.reason);
  },
});
