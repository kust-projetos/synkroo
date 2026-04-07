import { z } from 'zod'
import { uuidSchema } from './common'

// --- Create appointment ---
export const createAppointmentSchema = z.object({
  patient_id: uuidSchema,
  dentist_id: uuidSchema.optional().nullable(),
  procedure_id: uuidSchema.optional().nullable(),
  scheduled_at: z.string().min(1, 'scheduled_at is required'),
  duration_minutes: z.number().int().min(1).max(480).optional(),
  notes: z.string().max(2000).optional().nullable(),
})

// --- Reschedule ---
export const rescheduleSchema = z.object({
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'new_date must be in YYYY-MM-DD format'),
  new_time: z.string().regex(/^\d{2}:\d{2}$/, 'new_time must be in HH:MM format'),
  notify_patient: z.boolean().optional(),
})
