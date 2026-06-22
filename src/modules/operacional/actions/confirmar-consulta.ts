import { z } from 'zod';
import { defineAction } from '@/core/actions/registry';
import { ActionContext } from '@/core/actions/types';
import { confirmAppointment } from '../services/scheduling-service';

const ConfirmarConsultaInput = z.object({
  appointmentId: z.string().uuid(),
});

export type ConfirmarConsultaOutput = { success: boolean };

export const confirmarConsulta = defineAction({
  name: 'operacional:confirmar_consulta',
  module: 'operacional',
  requires: 'appointments:write',
  label: 'Confirmar consulta',
  description: 'Confirma um agendamento pendente.',
  input: ConfirmarConsultaInput,
  async handler(input: z.infer<typeof ConfirmarConsultaInput>, _ctx: ActionContext) {
    return confirmAppointment(input.appointmentId);
  },
});
