/**
 * Treatment-plan validation schemas (D3 — consolidados das rotas).
 *
 * Movidos verbatim de `src/app/api/treatment-plans/**` sem alteração de regras.
 */
import { z } from 'zod'

const treatmentPlanItemSchema = z.object({
  procedure_id: z.string().uuid().optional().nullable(),
  procedure_name: z.string().min(1),
  session_number: z.number().int().positive().optional(),
  appointment_id: z.string().uuid().optional().nullable(),
  scheduled_at: z.string().datetime().optional(),
  notes: z.string().optional(),
})

export const createTreatmentPlanSchema = z.object({
  patient_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  total_sessions: z.number().int().positive(),
  started_at: z.string().datetime().optional(),
  expected_completion_at: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(treatmentPlanItemSchema).optional().default([]),
})

export const updateTreatmentPlanSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'completed', 'cancelled', 'paused']).optional(),
  total_sessions: z.number().int().positive().optional(),
  expected_completion_at: z.string().datetime().optional(),
  notes: z.string().optional(),
})
