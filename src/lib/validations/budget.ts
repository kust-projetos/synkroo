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
  treatment_plan_id: z.string().uuid().optional(),
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
  treatment_plan_id: z.string().uuid().optional(),
})

/**
 * POST /api/budgets — schema legado snake_case (D3).
 *
 * Movido verbatim de `src/app/api/budgets/route.ts` sem alteração de regras.
 * DIVERGÊNCIA REGISTRADA: difere de `createBudgetSchema` — aceita `lead_id`,
 * não exige `procedure_id` nos itens, `unit_price` usa `.positive()` (vs `.min(0)`),
 * `valid_until` é string livre (vs regex YYYY-MM-DD). Mantida a versão da rota
 * (regra D3: em conflito, vale a rota).
 */
export const legacyCreateBudgetSchema = z.object({
  patient_id: z.string().uuid(),
  lead_id: z.string().uuid().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  items: z.array(z.object({
    procedure_name: z.string().min(1),
    quantity: z.number().int().min(1).default(1),
    unit_price: z.number().positive(),
    discount_percent: z.number().optional(),
    notes: z.string().optional(),
  })).min(1),
  discount_percent: z.number().min(0).max(100).optional(),
  valid_until: z.string().optional(),
})
