import { z } from 'zod';
import { defineAction } from '@/core/actions/registry';
import { ActionContext } from '@/core/actions/types';
import { rescheduleAppointment } from '../services/scheduling-service';

const RemarcarConsultaInput = z.object({
  appointmentId: z.string().uuid(),
  scheduledAt: z.string().datetime({ message: 'Nova data/hora ISO 8601 obrigatória.' }),
  dentistId: z.string().uuid().optional(),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  reason: z.string().max(500).optional(),
});

export type RemarcarConsultaOutput = { success: boolean };

export const remarcarConsulta = defineAction({
  name: 'operacional:remarcar_consulta',
  module: 'operacional',
  requires: 'appointments:write',
  label: 'Remarcar consulta',
  description: 'Reagenda um agendamento existente. Retorna 409 em caso de conflito de horário.',
  input: RemarcarConsultaInput,
  async handler(input: z.infer<typeof RemarcarConsultaInput>, ctx: ActionContext) {
    const scheduledAt = new Date(input.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new (require('@/core/actions/types').ActionError)('invalid_input', 'Nova data/hora inválida.');
    }
    return rescheduleAppointment({
      id: input.appointmentId,
      clinicId: ctx.clinicId,
      scheduledAt,
      dentistId: input.dentistId,
      durationMinutes: input.durationMinutes,
      reason: input.reason,
    });
  },
});
