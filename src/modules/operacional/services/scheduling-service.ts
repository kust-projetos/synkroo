/**
 * Operacional module — scheduling service.
 *
 * Thin orchestration layer between actions and repository.
 * Translates DB errors (including EXCLUDE constraint 23P01) to ActionError.
 * Error chain: pg error is in err.cause (Node.js Error cause chain).
 */

import { ActionError } from '@/core/actions/types';
import * as repo from '../repositories/appointments-repository';
import * as patientsRepo from '../repositories/patients-repository';
import * as catalogRepo from '../repositories/catalog-repository';
import * as waitlistRepo from '../repositories/waitlist-repository';
import { withIdempotency } from '@/lib/idempotency';

export interface AppointmentInput {
  clinicId: string;
  patientId: string;
  dentistId?: string | null;
  procedureId?: string | null;
  scheduledAt: Date;
  durationMinutes?: number;
  notes?: string;
  /** Client-supplied idempotency key (from `Idempotency-Key` header). Optional — absent = legacy behavior. */
  idempotencyKey?: string;
}

export async function agendarConsulta(input: AppointmentInput) {
  // W1.3: validate relational ownership before insert
  const patient = await patientsRepo.findById(input.clinicId, input.patientId);
  if (!patient) throw new ActionError('not_found', 'Paciente não encontrado.');
  if (input.dentistId) {
    const dentist = await catalogRepo.findDentistById(input.clinicId, input.dentistId);
    if (!dentist) throw new ActionError('not_found', 'Dentista não encontrado.');
  }
  if (input.procedureId) {
    const procedure = await catalogRepo.findProcedureById(input.clinicId, input.procedureId);
    if (!procedure) throw new ActionError('not_found', 'Procedimento não encontrado.');
  }
  const createCore = async () => {
    try {
      const appt = await repo.createAppointment(input);
      if (!appt) throw new ActionError('internal', 'Erro ao criar agendamento.');
      return { id: appt.id };
    } catch (err: unknown) {
      // Drizzle wraps pg errors in err.cause — check both for safety
      const code = (err as { cause?: { code?: string } })?.cause?.code;
      if (code === '23P01') {
        throw new ActionError('conflict', 'Horário indisponível para este dentista.');
      }
      throw err;
    }
  };

  const rawKey = input.idempotencyKey?.trim();
  if (!rawKey) return createCore();

  // Idempotent creation (padrão charge-service): primeira execução processa,
  // duplicata retorna o resultado original sem reinserir (lookup por identidade
  // do domínio, pois idempotency_keys não armazena payload de resultado).
  const namespaced = `appointment:create:${input.clinicId}:${rawKey}`;
  const outcome = await withIdempotency(namespaced, 'appointment_create', createCore);
  if (outcome.status === 'completed' && outcome.result) return outcome.result;
  const original = await repo.findByExactSlot(
    input.clinicId,
    input.patientId,
    input.dentistId ?? null,
    input.scheduledAt,
  );
  if (original) return { id: original.id };
  throw new ActionError('conflict', 'Agendamento em processamento. Tente novamente.');
}

export async function remarcarConsulta(input: {
  clinicId: string;
  id: string;
  scheduledAt: Date;
  durationMinutes?: number;
}) {
  const existing = await repo.findById(input.clinicId, input.id);
  if (!existing) throw new ActionError('not_found', 'Agendamento não encontrado.');
  try {
    const row = await repo.moveSlot(input.clinicId, input.id, input.scheduledAt, input.durationMinutes);
    return { id: row!.id };
  } catch (err: unknown) {
    const code = (err as { cause?: { code?: string } })?.cause?.code;
    if (code === '23P01') {
      throw new ActionError('conflict', 'Novo horário indisponível para este dentista.');
    }
    throw err;
  }
}

export async function confirmarConsulta(input: { clinicId: string; id: string }) {
  const row = await repo.setStatus(input.clinicId, input.id, 'confirmed');
  if (!row) throw new ActionError('not_found', 'Agendamento não encontrado.');
  return { id: row.id };
}

export async function cancelarConsulta(input: { clinicId: string; id: string; reason?: string }) {
  const existing = await repo.findById(input.clinicId, input.id);
  if (!existing) throw new ActionError('not_found', 'Agendamento não encontrado.');
  const row = await repo.setStatus(input.clinicId, input.id, 'cancelled', {
    cancellationReason: input.reason,
  });

  // Check waitlist for the freed slot (same dentist or same procedure timeframe)
  // Exceção deliberada: o toque na waitlist é best-effort e fica FORA de transação
  // com o cancelamento — falhar a notificação não pode reverter o cancelamento.
  try {
    const waitlist = await waitlistRepo.listWaitlist(input.clinicId);
    const candidate = waitlist.find((w) =>
      w.status === 'waiting' &&
      (!existing.dentistId || w.dentistId === existing.dentistId)
    );
    if (candidate) {
      // Notification to the freed waitlist candidate is deferred to E-01
      // (atendimento channel delivery / WhatsApp integration). Here we only
      // release the slot by marking the entry as cancelled.
      await waitlistRepo.cancelWaitlistEntry(candidate.id, 'slot_freed');
    }
  } catch { /* waitlist processing is best-effort */ }

  return { id: row!.id };
}

export async function registrarNoShow(input: { clinicId: string; id: string }) {
  const row = await repo.setStatus(input.clinicId, input.id, 'no_show');
  if (!row) throw new ActionError('not_found', 'Agendamento não encontrado.');
  return { id: row.id };
}

export interface ListInput {
  patientId?: string;
  dentistId?: string;
  status?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
  dentistIds?: string[];
  page?: number;
  limit?: number;
}

export async function listarConsultas(clinicId: string, input: ListInput) {
  const isCalendarRange = Boolean(input.startDate && input.endDate);
  const page = input.page ?? 1;
  const limit = Math.min(input.limit ?? (isCalendarRange ? 999 : 50), 999);
  const offset = (page - 1) * limit;

  const rows = await repo.findByClinicWithJoins(clinicId, {
    patientId: input.patientId,
    dentistId: input.dentistId,
    status: input.status,
    date: input.date,
    startDate: input.startDate,
    endDate: input.endDate,
    dentistIds: input.dentistIds,
    limit,
    offset,
  });

  const total = await repo.findByClinicWithJoins(clinicId, {
    patientId: input.patientId,
    dentistId: input.dentistId,
    status: input.status,
    date: input.date,
    startDate: input.startDate,
    endDate: input.endDate,
    dentistIds: input.dentistIds,
    count: true,
  });

  const totalPages = Math.ceil(total / limit);

  return { appointments: rows, pagination: { page, limit, total, totalPages } };
}
