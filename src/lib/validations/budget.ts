/**
 * Budget validation schemas
 */
import { z } from 'zod'

const budgetItemSchema = z.object({
  procedure_id: z.string().uuid(),
  procedure_name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).default(1),
  unit_price: z.number().min(0),
  discount_percent: z.number().min(0).max(100).optional().default(0),
  total_price: z.number().optional(),
  notes: z.string().optional(),
})

export const createBudgetSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
  description: z.string().max(1000).optional(),
  items: z.array(budgetItemSchema).min(1),
  discount_percent: z.number().min(0).max(100).optional(),
  discount_value: z.number().min(0).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
})

export const updateBudgetSchema = z.object({
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  notes: z.string().max(1000).optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
})
