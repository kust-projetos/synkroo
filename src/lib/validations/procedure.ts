/**
 * Procedure validation schemas
 */
import { z } from 'zod'

export const createProcedureSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  duration_minutes: z.number().int().min(15).max(480).optional(),
  price: z.number().min(0).optional(),
})

export const updateProcedureSchema = createProcedureSchema.partial()
