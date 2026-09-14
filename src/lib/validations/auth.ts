import { z } from 'zod'
import { emailSchema } from './common'

// --- Login ---
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

// --- Signup ---
export const signupSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(200),
  clinicName: z.string().min(1, 'Clinic name is required').max(200),
  phone: z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone number format').optional(),
})

// --- Change password (D3 — movido verbatim de src/app/api/auth/change-password/route.ts) ---
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  nextPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
})
