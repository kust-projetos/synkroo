import * as appointmentRepo from '@/repositories/appointments'

/**
 * Shared appointment-to-API mapper — consistent contract across list and detail.
 *
 * Extracted from the route module so Next.js' generated route-type
 * constraint (which requires route modules to export only handlers and
 * allowed symbols) is satisfied. Without this, `tsc --noEmit` fails
 * with TS2344 on `.next/types/app/api/appointments/route.ts`.
 */
export function appointmentToApi(
  row: NonNullable<Awaited<ReturnType<typeof appointmentRepo.findByIdWithJoins>>>
) {
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
      ? { id: row.patient.id, name: row.patient.name, phone: row.patient.phone, email: row.patient.email ?? null }
      : null,
    dentists: row.dentist
      ? { id: row.dentist.id, name: row.dentist.name, phone: row.dentist.phone ?? null, specialty: row.dentist.specialty ?? null }
      : null,
    procedures: row.procedure
      ? { id: row.procedure.id, name: row.procedure.name, duration_minutes: row.procedure.durationMinutes, price: row.procedure.price, category: row.procedure.category }
      : null,
  }
}
