/**
 * Router Tools for Synkroo Agent
 * Tools for intent classification and entity extraction
 */

import type { Tool } from './base.tools'
import { dbLogger } from '@/lib/logger'
import { BASE_TOOLS } from './base.tools'

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Router-specific tools (extends BASE_TOOLS)
 */
export const ROUTER_TOOLS: Tool[] = [
  ...BASE_TOOLS,
  {
    name: 'classify_intent',
    description: 'Classifica a intenção do usuário a partir de uma mensagem',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensagem do usuário' },
        context: { type: 'string', description: 'Contexto da conversa (opcional)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'extract_entities',
    description: 'Extrai entidades de uma mensagem (datas, procedimentos, dentistas)',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Mensagem do usuário' },
        clinicId: { type: 'string', description: 'ID da clínica' },
      },
      required: ['message', 'clinicId'],
    },
  },
]

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Classify user intent from message
 */
export async function classifyIntentTool(
  message: string,
  context?: string
): Promise<{
  success: boolean
  data?: {
    intent: string
    confidence: number
    suggestedAction?: string
  }
  error?: string
}> {
  try {
    const { getLLMProvider } = await import('@/lib/llm')

    const intentPatterns = [
      // Scheduling intents
      { pattern: /agend|marcar|horário|consulta/i, intent: 'schedule', suggestedAction: 'transfer_to_scheduler' },
      { pattern: /cancel|desmarcar/i, intent: 'cancel', suggestedAction: 'transfer_to_scheduler' },
      { pattern: /remarcar|alterar|mudar.*horário/i, intent: 'reschedule', suggestedAction: 'transfer_to_scheduler' },

      // Sales intents
      { pattern: /orçament|valor|preço|custo/i, intent: 'budget_request', suggestedAction: 'transfer_to_sales' },
      { pattern: /tratamento|procedimento|serviço/i, intent: 'treatment_inquiry', suggestedAction: 'transfer_to_sales' },
      { pattern: /promoç|desconto|oferta/i, intent: 'promotion_inquiry', suggestedAction: 'transfer_to_sales' },

      // Information intents
      { pattern: /info|informações|sobre/i, intent: 'general_info', suggestedAction: 'answer_from_knowledge' },
      { pattern: /local|endereço|onde.*fic|como.*cheg/i, intent: 'location_info', suggestedAction: 'answer_from_knowledge' },
      { pattern: /horário.*funciona|aberto|fechado/i, intent: 'hours_info', suggestedAction: 'answer_from_knowledge' },

      // Patient intents
      { pattern: /meu.*histor|minha.*consulta|vi|Antes/i, intent: 'patient_history', suggestedAction: 'search_patient_data' },
      { pattern: /lembrete|lembrar|lembrar/i, intent: 'reminder_request', suggestedAction: 'set_reminder' },

      // Conversation
      { pattern: /oi|olá|boa|tudo.*bem|bom.*dia/i, intent: 'greeting', suggestedAction: 'respond_greeting' },
      { pattern: /obrigad|Valeu|flw/i, intent: 'farewell', suggestedAction: 'close_conversation' },
      { pattern: /ajuda|help|socorro/i, intent: 'help_request', suggestedAction: 'provide_help' },
    ]

    // Quick pattern matching for common intents
    for (const { pattern, intent, suggestedAction } of intentPatterns) {
      if (pattern.test(message)) {
        return {
          success: true,
          data: {
            intent,
            confidence: 0.85,
            suggestedAction,
          },
        }
      }
    }

    // For ambiguous cases, use LLM for better classification
    if (!context) {
      return {
        success: true,
        data: {
          intent: 'unknown',
          confidence: 0.3,
          suggestedAction: 'ask_forclarification',
        },
      }
    }

    const llm = getLLMProvider()
    const prompt = `Classifique a intenção do paciente na seguinte mensagem, considerando o contexto.

Mensagem: "${message}"
Contexto: "${context}"

Intensões possíveis: schedule, cancel, reschedule, budget_request, treatment_inquiry, promotion_inquiry, general_info, location_info, hours_info, patient_history, reminder_request, greeting, farewell, help_request, unknown

Responda apenas com o JSON: {"intent": "...", "confidence": 0.0-1.0}`

    const response = await llm.chat([{ role: 'user', content: prompt }])

    try {
      const parsed = JSON.parse(response)
      return {
        success: true,
        data: {
          intent: parsed.intent || 'unknown',
          confidence: parsed.confidence || 0.5,
          suggestedAction: 'continue_conversation',
        },
      }
    } catch {
      return {
        success: true,
        data: {
          intent: 'unknown',
          confidence: 0.4,
          suggestedAction: 'ask_for_clarification',
        },
      }
    }
  } catch (error) {
    dbLogger.error('classifyIntentTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao classificar intenção',
    }
  }
}

/**
 * Extract entities from message (dates, procedures, dentists)
 */
export async function extractEntitiesTool(
  message: string,
  clinicId: string
): Promise<{
  success: boolean
  data?: {
    date?: string
    time?: string
    procedure?: { id: string; name: string }
    dentist?: { id: string; name: string }
    phone?: string
    name?: string
  }
  error?: string
}> {
  try {
    const { parseNaturalDate, parseTime } = await import('@/services/scheduler/scheduler.service')
    const { l3ClinicService } = await import('@/services/memory/L3-clinic.service')
    const { createTypedClient } = await import('@/lib/supabase/typed')

    const result: {
      date?: string
      time?: string
      procedure?: { id: string; name: string }
      dentist?: { id: string; name: string }
      phone?: string
      name?: string
    } = {}

    // Extract date
    const dateStr = parseNaturalDate(message)
    if (dateStr) {
      result.date = dateStr
    }

    // Extract time
    const timeStr = parseTime(message)
    if (timeStr) {
      result.time = timeStr
    }

    // Extract phone number
    const phoneMatch = message.match(/(\d{2,3})?\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/)
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/\D/g, '')
    }

    // Extract name (simple heuristic - capitalized words)
    const nameMatch = message.match(/(?:meu nome é|sou|chamo|é o|com o)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
    if (nameMatch) {
      result.name = nameMatch[1].trim()
    }

    // Get clinic data for matching procedures and dentists
    const clinic = await l3ClinicService.getById(clinicId)
    if (clinic) {
      // Match procedure names in message
      const lowerMessage = message.toLowerCase()
      for (const proc of clinic.procedimentos) {
        const procName = proc.name.toLowerCase()
        if (lowerMessage.includes(procName)) {
          result.procedure = { id: proc.id, name: proc.name }
          break
        }
      }

      // Match dentist names in message
      for (const dent of clinic.profissionais) {
        const dentName = dent.name.toLowerCase()
        if (lowerMessage.includes(dentName)) {
          result.dentist = { id: dent.id, name: dent.name }
          break
        }
      }
    }

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    dbLogger.error('extractEntitiesTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao extrair entidades',
    }
  }
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

/**
 * Registry mapping router tool names to their implementations
 */
export const ROUTER_TOOL_IMPLEMENTATIONS: Record<string, (...args: unknown[]) => Promise<unknown>> = {
  classify_intent: async (args: { message: string; context?: string }) =>
    classifyIntentTool(args.message, args.context),

  extract_entities: async (args: { message: string; clinicId: string }) =>
    extractEntitiesTool(args.message, args.clinicId),
}
