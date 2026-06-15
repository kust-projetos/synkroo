/**
 * Sales Tools for Synkroo Agent
 * Tools for lead management, budgets, and promotions
 */

import type { Tool } from './base.tools'
import { dbLogger } from '@/lib/logger'
import { BASE_TOOLS } from './base.tools'

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Sales-specific tools (extends BASE_TOOLS)
 */
export const SALES_TOOLS: Tool[] = [
  ...BASE_TOOLS,
  {
    name: 'get_lead_info',
    description: 'Obtém informações de um lead',
    inputSchema: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'ID do lead' },
      },
      required: ['leadId'],
    },
  },
  {
    name: 'create_budget',
    description: 'Cria um orçamento para um paciente',
    inputSchema: {
      type: 'object',
      properties: {
        clinicId: { type: 'string', description: 'ID da clínica' },
        patientId: { type: 'string', description: 'ID do paciente' },
        title: { type: 'string', description: 'Título do orçamento' },
        items: {
          type: 'array',
          description: 'Itens do orçamento',
          items: {
            type: 'object',
            properties: {
              procedure_name: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' },
              discount_percent: { type: 'number' },
            },
            required: ['procedure_name', 'quantity', 'unit_price'],
          },
        },
        discount_percent: { type: 'number', description: 'Desconto percentual sobre o total' },
        valid_until: { type: 'string', description: 'Data de validade (YYYY-MM-DD)' },
        notes: { type: 'string', description: 'Observações' },
      },
      required: ['clinicId', 'patientId', 'items'],
    },
  },
  {
    name: 'send_promotion',
    description: 'Envia uma promoção para um paciente ou lista de pacientes',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Canal de envio (whatsapp, sms, email)' },
        patientIds: { type: 'array', items: { type: 'string' }, description: 'IDs dos pacientes' },
        promotionTitle: { type: 'string', description: 'Título da promoção' },
        promotionMessage: { type: 'string', description: 'Mensagem da promoção' },
        campaignId: { type: 'string', description: 'ID da campanha (opcional)' },
      },
      required: ['channel', 'patientIds', 'promotionTitle', 'promotionMessage'],
    },
  },
]

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Get lead information
 */
export async function getLeadInfoTool(
  leadId: string
): Promise<{
  success: boolean
  data?: {
    id: string
    name: string
    phone: string
    email?: string
    source: string
    status: string
    temperature: string
    score: number
    interest?: string
    notes?: string
    assignedTo?: string
    lastContactAt?: string
    nextFollowupAt?: string
    createdAt: string
  }
  error?: string
}> {
  try {
    const { getDb } = await import('@/lib/db/client')
    const { leads } = await import('@/lib/db/schema')
    const { eq } = await import('drizzle-orm')

    const db = getDb()
    const [lead] = await db.select().from(leads).where(eq(leads.id, leadId))

    if (!lead) {
      return { success: false, error: 'Lead não encontrado' }
    }

    return {
      success: true,
      data: {
        id: lead.id, name: lead.name, phone: lead.phone, email: lead.email ?? '',
        source: lead.source ?? '', status: lead.status, temperature: lead.temperature ?? 'cold',
        score: lead.score ?? 0, interest: lead.interest ?? undefined, notes: lead.notes ?? undefined,
        assignedTo: lead.assignedTo ?? undefined, lastContactAt: lead.lastContactAt?.toISOString?.() ?? undefined,
        nextFollowupAt: lead.nextFollowupAt?.toISOString?.() ?? undefined,
        createdAt: lead.createdAt?.toISOString?.() ?? '',
      } as any,
    }
  } catch (error) {
    dbLogger.error('getLeadInfoTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar lead',
    }
  }
}

/**
 * Create a budget for a patient
 */
export async function createBudgetTool(
  clinicId: string,
  patientId: string,
  title: string | undefined,
  items: Array<{
    procedure_name: string
    quantity: number
    unit_price: number
    discount_percent?: number
  }>,
  discount_percent: number = 0,
  valid_until: string | undefined,
  notes: string | undefined
): Promise<{
  success: boolean
  data?: {
    budgetId: string
    totalValue: number
    discountValue: number
    finalValue: number
    message: string
  }
  error?: string
}> {
  try {
    const { createBudget, calculateBudgetTotals } = await import('@/services/budgets/budget.service')

    const totals = calculateBudgetTotals(
      items.map(item => ({
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
      })),
      discount_percent
    )

    const budget = await createBudget({
      clinic_id: clinicId,
      patient_id: patientId,
      title: title || 'Orçamento de Tratamento',
      items: items.map(item => ({
        procedure_name: item.procedure_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent || 0,
      })) as any,
      discount_percent,
      discount_value: totals.discount_value,
      valid_until: valid_until,
      notes,
    })

    return {
      success: true,
      data: {
        budgetId: budget.id!,
        totalValue: budget.total_value,
        discountValue: budget.discount_value,
        finalValue: budget.final_value,
        message: `Orçamento criado com sucesso!\n\nValor total: R$ ${budget.total_value.toFixed(2)}\nDesconto: R$ ${budget.discount_value.toFixed(2)}\nValor final: R$ ${budget.final_value.toFixed(2)}`,
      },
    }
  } catch (error) {
    dbLogger.error('createBudgetTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao criar orçamento',
    }
  }
}

/**
 * Send promotion to patients
 */
export async function sendPromotionTool(
  channel: string,
  patientIds: string[],
  promotionTitle: string,
  promotionMessage: string,
  campaignId?: string
): Promise<{
  success: boolean
  data?: {
    sent: number
    failed: number
    errors?: string[]
  }
  error?: string
}> {
  try {
    const { sendWhatsAppMessage } = await import('@/services/whatsapp')
    const { l2PatientService } = await import('@/services/memory/L2-patient.service')

    const errors: string[] = []
    let sent = 0
    let failed = 0

    for (const patientId of patientIds) {
      try {
        // Get patient phone
        const patient = await l2PatientService.getById(patientId)
        if (!patient) {
          errors.push(`Paciente ${patientId}: não encontrado`)
          failed++
          continue
        }

        const fullMessage = `${promotionTitle}\n\n${promotionMessage}`

        if (channel === 'whatsapp') {
          const result = await sendWhatsAppMessage(patient.telefone, fullMessage)
          if (result.success) {
            sent++
          } else {
            errors.push(`Paciente ${patientId}: ${result.error}`)
            failed++
          }
        } else {
          errors.push(`Canal ${channel} não implementado`)
          failed++
        }
      } catch (error) {
        errors.push(`Paciente ${patientId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        failed++
      }
    }

    // If campaignId provided, could store campaign results here

    return {
      success: true,
      data: {
        sent,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      },
    }
  } catch (error) {
    dbLogger.error('sendPromotionTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao enviar promoção',
    }
  }
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

/**
 * Registry mapping sales tool names to their implementations
 */
export const SALES_TOOL_IMPLEMENTATIONS: Record<string, any> = {
  get_lead_info: async (args: { leadId: string }) =>
    getLeadInfoTool(args.leadId),

  create_budget: async (args: {
    clinicId: string
    patientId: string
    title?: string
    items: Array<{
      procedure_name: string
      quantity: number
      unit_price: number
      discount_percent?: number
    }>
    discount_percent?: number
    valid_until?: string
    notes?: string
  }) => createBudgetTool(
    args.clinicId,
    args.patientId,
    args.title,
    args.items,
    args.discount_percent,
    args.valid_until,
    args.notes
  ),

  send_promotion: async (args: {
    channel: string
    patientIds: string[]
    promotionTitle: string
    promotionMessage: string
    campaignId?: string
  }) => sendPromotionTool(
    args.channel,
    args.patientIds,
    args.promotionTitle,
    args.promotionMessage,
    args.campaignId
  ),
}
