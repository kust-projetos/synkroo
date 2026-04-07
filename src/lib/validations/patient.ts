import { z } from 'zod'
import { emailSchema, phoneSchema, dateSchema } from './common'

// --- Full patient schema ---
export const patientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: phoneSchema,
  email: emailSchema.optional().nullable(),
  cpf: z.string().optional().nullable(),
  birth_date: dateSchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  tags: z.array(z.string()).optional(),
})

// --- Create (full required fields) ---
export const createPatientSchema = patientSchema

// --- Update (all optional) ---
export const updatePatientSchema = patientSchema.partial()
