import { z } from 'zod'
import { emailSchema, phoneSchema } from './common'

// Conjunto REAL de fontes do produto (review D2D3): a UI envia
// whatsapp|instagram|web|referral|campaign|other; `website`/`manual`
// mantidos por compatibilidade com dados já gravados. A Action
// comercial.capturarLead aceita string livre — este enum é o único gate.
export const leadSourceEnum = z.enum([
  'whatsapp',
  'instagram',
  'web',
  'website',
  'referral',
  'campaign',
  'manual',
  'other',
])

// --- Create lead ---
export const createLeadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  phone: phoneSchema,
  email: emailSchema.optional().nullable(),
  source: leadSourceEnum.optional(),
  interest: z.string().max(500).optional().nullable(),
  patientId: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  deal_value: z.number().min(0).max(999999999999).optional(),
})

// --- Update lead ---
export const updateLeadSchema = z.object({
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']).optional(),
  notes: z.string().max(2000).optional().nullable(),
  hasBudget: z.boolean().optional(),
  hasTimeline: z.boolean().optional(),
  interest: z.string().max(500).optional().nullable(),
  deal_value: z.number().min(0).max(999999999999).optional().nullable(),
})

// --- POST /api/leads (D3) ---
// Validação de borda da rota, espelhando o input aceito pela Action
// comercial.capturarLead (name/phone/source + email passthrough).
// Regras mínimas de presença/tipo — sem endurecer além da Action.
export const leadApiCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  source: leadSourceEnum.optional(),
  email: emailSchema.optional().nullable(),
})
