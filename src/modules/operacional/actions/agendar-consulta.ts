import { z } from 'zod';
import { defineAction } from '@/core/actions/registry';
import { ActionContext } from '@/core/actions/types';
import { scheduleAppointment } from '../services/scheduling-service';

const AgendarConsultaInput = z.object({
  patientId: z.string().uuid(),
  dentistId: z.string().uuid().optional(),
  procedureId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime({ message: 'Data/hora ISO 8601 obrigatória.' }),
  durationMinutes: z.number().int().min(5).max(480).optional(),
  notes: z.string().max(1000).optional(),
});

export type AgendarConsultaOutput = { id: string };

export const agendarConsulta = defineAction({
  name: 'operacional:agendar_consulta',
  module: 'operacional',
  requires: 'appointments:write',
  label: 'Agendar consulta',
  description: 'Cria um novo agendamento. Retorna 409 em caso de conflito de horário.',
  input: AgendarConsultaInput,
  async handler(input: z.infer<typeof AgendarConsultaInput>, ctx: ActionContext) {
    const scheduledAt = new Date(input.scheduledAt);
    if (isNaN(scheduledAt.getTime())) {
      throw new (require('@/core/actions/types').ActionError)('invalid_input', 'Data/hora inválida.');
    }
    if (scheduledAt <= new Date()) {
      throw new (require('@/core/actions/types').ActionError)('invalid_input', 'Agendamento deve ser em data futura.');
    }
    return scheduleAppointment({
      clinicId: ctx.clinicId,
      patientId: input.patientId,
      dentistId: input.dentistId,
      procedureId: input.procedureId,
      scheduledAt,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    });
  },
});
