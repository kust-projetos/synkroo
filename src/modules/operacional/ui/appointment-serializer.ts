/**
 * Operacional module — appointment serializer.
 *
 * Port of src/app/api/appointments/_serializer.ts, adapted to use the
 * operational module's AppointmentRow type.
 *
 * Maintains the existing API contract:
 * GET  → { appointments: [...], pagination: {...} }
 * POST → { appointment: {...} }
 */

import type { AppointmentRow } from '../repositories/appointments-repository';

/**
 * Maps a repository row to the API contract shape.
 */
export function appointmentToApi(row: AppointmentRow) {
  return {
    id: row.id,
    clinic_id: row.clinicId,
    patient_id: row.patientId,
    dentist_id: row.dentistId,
    procedure_id: row.procedureId,
    scheduled_at: row.scheduledAt,
    duration_minutes: row.durationMinutes,
    status: row.status,
    notes: row.notes,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
    patients: row.patient
      ? {
          id: row.patient.id,
          name: row.patient.name,
          phone: row.patient.phone,
          email: row.patient.email ?? null,
        }
      : null,
    dentists: row.dentist
      ? {
          id: row.dentist.id,
          name: row.dentist.name,
          phone: row.dentist.phone ?? null,
          specialty: row.dentist.specialty ?? null,
        }
      : null,
    procedures: row.procedure
      ? {
          id: row.procedure.id,
          name: row.procedure.name,
          duration_minutes: row.procedure.durationMinutes,
          price: row.procedure.price,
          category: row.procedure.category,
        }
      : null,
  };
}
