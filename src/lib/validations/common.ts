import { z } from 'zod'

// Canonical tenant identity boundary: persist and compare e-mails trimmed and case-folded.
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// --- Primitives ---
export const uuidSchema = z.string().uuid()
export const emailSchema = z.string().transform(normalizeEmail).pipe(z.string().email())
export const phoneSchema = z.string().regex(/^\+?\d{10,15}$/, 'Invalid phone number format')
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:MM format')

// --- Pagination ---
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// --- Reusable partials ---
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
