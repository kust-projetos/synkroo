/**
 * Operacional module — scheduling service.
 *
 * Thin orchestration layer between actions and repository.
 * Translates DB errors (including EXCLUDE constraint 23P01) to ActionError.
 */

import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/appointments-repository';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'in_progress' | 'completed';

export async function scheduleAppointment(params: {
  clinicId: string;
  patientId: string;
  dentistId?: string | null;
  procedureId?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string;
}): Promise<{ id: string }> {
  try {
    const appt = await repo.createAppointment({
      clinicId: params.clinicId,
      patientId: params.patientId,
      dentistId: params.dentistId ?? null,
      procedureId: params.procedureId ?? null,
      scheduledAt: params.scheduledAt,
      durationMinutes: params.durationMinutes,
      notes: params.notes ?? null,
    });
    if (!appt) throw new ActionError('internal', 'Erro ao criar agendamento.');
    return { id: appt.id };
  } catch (err: any) {
    // Drizzle uses 'cause' (not 'original') for the pg error chain
    const isExclusion = err?.code === '23P01' || err?.cause?.code === '23P01' ||
      (err instanceof Error && err.message.includes('appointments_no_overlap'));
    if (isExclusion) {
      throw new ActionError('conflict', 'Horário indisponível. Já existe um agendamento neste horário.');
    }
    throw err;
  }
}

export async function confirmAppointment(id: string): Promise<{ success: boolean }> {
  const appt = await repo.findById(id);
  if (!appt) throw new ActionError('not_found', 'Agendamento não encontrado.');
  if (appt.status !== 'scheduled') {
    throw new ActionError('conflict', 'Apenas agendamentos pendentes podem ser confirmados.');
  }
  await repo.setAppointmentStatus(id, 'confirmed', { confirmationSentAt: new Date() });
  return { success: true };
}

export async function cancelAppointment(
  id: string,
  reason?: string,
  cancelledBy = 'clinic',
): Promise<{ success: boolean; waitlistNotified?: boolean }> {
  const appt = await repo.findById(id);
  if (!appt) throw new ActionError('not_found', 'Agendamento não encontrado.');
  if (appt.status === 'cancelled') {
    throw new ActionError('conflict', 'Este agendamento já foi cancelado.');
  }
  await repo.setAppointmentStatus(id, 'cancelled', {
    cancelledAt: new Date(),
    cancellationReason: reason ?? null,
  });
  return { success: true };
}

export async function markNoShow(id: string): Promise<{ success: boolean }> {
  const appt = await repo.findById(id);
  if (!appt) throw new ActionError('not_found', 'Agendamento não encontrado.');
  if (appt.status !== 'scheduled' && appt.status !== 'confirmed') {
    throw new ActionError('conflict', 'Apenas agendamentos pendentes ou confirmados podem ser marcados como faltoso.');
  }
  await repo.setAppointmentStatus(id, 'no_show');
  return { success: true };
}

export async function rescheduleAppointment(params: {
  id: string;
  clinicId: string;
  dentistId?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
  reason?: string;
}): Promise<{ success: boolean }> {
  try {
    const appt = await repo.findById(params.id);
    if (!appt) throw new ActionError('not_found', 'Agendamento não encontrado.');

    await repo.moveAppointment(params.id, params.scheduledAt, {
      dentistId: params.dentistId,
      durationMinutes: params.durationMinutes,
    });
    return { success: true };
  } catch (err: any) {
    if (err instanceof ActionError) throw err;
    // Drizzle uses 'cause' (not 'original') for the pg error chain
    const isExclusion = err?.code === '23P01' || err?.cause?.code === '23P01' ||
      (err instanceof Error && err.message.includes('appointments_no_overlap'));
    if (isExclusion) {
      throw new ActionError('conflict', 'Horário indisponível. Já existe um agendamento neste horário.');
    }
    throw err;
  }
}
