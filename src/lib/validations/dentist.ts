/**
 * Dentist validation schemas
 */
import { z } from 'zod'

export const createDentistSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?\d{10,15}$/).optional(),
  email: z.string().email().optional(),
  specialty: z.string().max(100).optional(),
  cro_number: z.string().max(20).optional(),
})

export const updateDentistSchema = createDentistSchema.partial()
