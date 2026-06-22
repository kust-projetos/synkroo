import { z } from 'zod';
import { defineAction } from '@/core/actions/registry';
import { ActionContext } from '@/core/actions/types';
import { markNoShow } from '../services/scheduling-service';

const RegistrarNoShowInput = z.object({
  appointmentId: z.string().uuid(),
});

export type RegistrarNoShowOutput = { success: boolean };

export const registrarNoShow = defineAction({
  name: 'operacional:registrar_no_show',
  module: 'operacional',
  requires: 'appointments:write',
  label: 'Registrar falta (no-show)',
  description: 'Marca um agendamento como faltou (no-show).',
  input: RegistrarNoShowInput,
  async handler(input: z.infer<typeof RegistrarNoShowInput>, _ctx: ActionContext) {
    return markNoShow(input.appointmentId);
  },
});
