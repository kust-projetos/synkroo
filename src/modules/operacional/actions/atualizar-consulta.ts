import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '@/repositories/appointments';

export const atualizarConsulta = defineAction({
  name: 'operacional.atualizarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Atualizar consulta (PATCH)',
  input: z.object({
    id: z.string().uuid(),
    patientId: z.string().uuid().optional(),
    dentistId: z.string().uuid().optional().nullable(),
    procedureId: z.string().uuid().optional().nullable(),
    scheduledAt: z.coerce.date().optional(),
    durationMinutes: z.number().int().positive().optional(),
    status: z.string().optional(),
    notes: z.string().max(1000).optional().nullable(),
  }),
  handler: async (input, ctx: ActionContext) => {
    const current = await repo.findByIdWithJoins(input.id, ctx.clinicId);
    if (!current) throw new ActionError('not_found', 'Agendamento não encontrado.');

    const updateData: Record<string, unknown> = {};
    if (input.patientId !== undefined) updateData.patientId = input.patientId;
    if (input.dentistId !== undefined) updateData.dentistId = input.dentistId;
    if (input.procedureId !== undefined) updateData.procedureId = input.procedureId;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;
    if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const updated = await repo.update(input.id, updateData);

    // Update patient's last_visit if completed
    if (input.status === 'completed' && input.patientId) {
      await repo.updatePatientLastVisit(input.patientId, typeof input.scheduledAt === 'object' ? input.scheduledAt : new Date());
    } else if (input.status === 'completed' && current.patientId) {
      await repo.updatePatientLastVisit(current.patientId, current.scheduledAt);
    }

    if (!updated) throw new ActionError('internal', 'Erro ao atualizar agendamento.');
    const refreshed = await repo.findByIdWithJoins(input.id, ctx.clinicId);
    return { appointment: refreshed };
  },
});
