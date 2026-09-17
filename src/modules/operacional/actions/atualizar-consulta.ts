import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';
import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/appointments-repository';
import * as patientsRepo from '../repositories/patients-repository';
import * as catalogRepo from '../repositories/catalog-repository';

export const atualizarConsulta = defineAction({
  name: 'operacional.atualizarConsulta',
  module: 'operacional',
  requires: 'operacional:manage_appointments',
  label: 'Atualizar consulta (PATCH)',
  // Etapa 5.3 + SYN-API-002: audit schedule mutation; the patientId allowlist
  // IS the reassignment telemetry. `notes` excluded (may carry health data).
  auditFields: ['id', 'patientId', 'dentistId', 'status', 'scheduledAt'],
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

    // W1.3: validate every relational ID present in patch belongs to same clinic before update
    if (input.patientId !== undefined) {
      const patient = await patientsRepo.findById(ctx.clinicId, input.patientId);
      if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');
    }
    if (input.dentistId !== undefined && input.dentistId !== null) {
      const dentist = await catalogRepo.findDentistById(ctx.clinicId, input.dentistId);
      if (!dentist) throw new ActionError('not_found', 'Dentista não encontrado.');
    }
    if (input.procedureId !== undefined && input.procedureId !== null) {
      const procedure = await catalogRepo.findProcedureById(ctx.clinicId, input.procedureId);
      if (!procedure) throw new ActionError('not_found', 'Procedimento não encontrado.');
    }

    const updateData: Record<string, unknown> = {};
    if (input.patientId !== undefined) updateData.patientId = input.patientId;
    if (input.dentistId !== undefined) updateData.dentistId = input.dentistId;
    if (input.procedureId !== undefined) updateData.procedureId = input.procedureId;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;
    if (input.durationMinutes !== undefined) updateData.durationMinutes = input.durationMinutes;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // Use clinicId in WHERE to prevent cross-tenant update.
    // updateAppointment + last_visit são aplicados atomicamente no repositório
    // (updateAppointmentAndTouchVisit) — nunca meio-aplicados.
    const patientIdForVisit = input.patientId ?? current.patientId;
    const touchVisit =
      input.status === 'completed' && patientIdForVisit
        ? {
            patientId: patientIdForVisit as string,
            at:
              input.scheduledAt instanceof Date
                ? input.scheduledAt
                : (current.scheduledAt as Date),
          }
        : null;
    const updated = await repo.updateAppointmentAndTouchVisit(
      ctx.clinicId,
      input.id,
      updateData,
      touchVisit,
    );

    if (!updated) throw new ActionError('internal', 'Erro ao atualizar agendamento.');
    const refreshed = await repo.findByIdWithJoins(input.id, ctx.clinicId);
    return { appointment: refreshed };
  },
});
