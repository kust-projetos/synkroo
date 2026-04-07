/**
 * Base Tools for Synkroo Agents
 * Common tools available to all agents
 */

import { dbLogger } from '@/lib/logger'

// ============================================================================
// Tool Types
// ============================================================================

export interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Base tools available to all agents
 */
export const BASE_TOOLS: Tool[] = [
  {
    name: 'search_patient',
    description: 'Busca paciente por telefone ou nome',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Telefone ou nome do paciente' },
        clinicId: { type: 'string', description: 'ID da clínica' },
      },
      required: ['query', 'clinicId'],
    },
  },
  {
    name: 'get_clinic_info',
    description: 'Obtém informações da clínica',
    inputSchema: {
      type: 'object',
      properties: {
        clinicId: { type: 'string', description: 'ID da clínica' },
      },
      required: ['clinicId'],
    },
  },
  {
    name: 'send_message',
    description: 'Envia mensagem para o paciente',
    inputSchema: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Canal de comunicação (whatsapp, sms, email)' },
        message: { type: 'string', description: 'Conteúdo da mensagem' },
        conversationId: { type: 'string', description: 'ID da conversa' },
        patientId: { type: 'string', description: 'ID do paciente (alternativa ao conversationId)' },
      },
      required: ['channel', 'message'],
    },
  },
  {
    name: 'log_decision',
    description: 'Registra decisão do agente',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Nome do agente' },
        action: { type: 'string', description: 'Ação tomada' },
        reasoning: { type: 'string', description: 'Raciocínio da decisão' },
        conversationId: { type: 'string', description: 'ID da conversa' },
      },
      required: ['agent', 'action', 'reasoning'],
    },
  },
]

// ============================================================================
// Tool Implementations
// ============================================================================

/**
 * Search patient by phone or name
 */
export async function searchPatientTool(
  query: string,
  clinicId: string
): Promise<{
  success: boolean
  data?: {
    patientId: string
    nome: string
    telefone: string
    email?: string
    lastVisit?: string
  }
  error?: string
}> {
  try {
    const { l2PatientService } = await import('@/services/memory/L2-patient.service')

    // Try to find by phone first (most common search)
    const normalizedQuery = query.replace(/\D/g, '')

    if (normalizedQuery.length >= 8) {
      // Likely a phone number
      const patient = await l2PatientService.getByPhone(normalizedQuery, clinicId)
      if (patient) {
        return {
          success: true,
          data: {
            patientId: patient.patientId,
            nome: patient.nome,
            telefone: patient.telefone,
            email: patient.email,
            lastVisit: patient.ultimaVisita?.toISOString(),
          },
        }
      }
    }

    // If not found by phone, try to search by name
    // For name search, we'd need to implement a search method
    // For now, return not found
    return {
      success: true,
      data: undefined,
      error: 'Paciente não encontrado',
    }
  } catch (error) {
    dbLogger.error('searchPatientTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar paciente',
    }
  }
}

/**
 * Get clinic information
 */
export async function getClinicInfoTool(
  clinicId: string
): Promise<{
  success: boolean
  data?: {
    clinicId: string
    nome: string
    telefone: string
    profissionais: Array<{ id: string; name: string; specialty?: string }>
    procedimentos: Array<{ id: string; name: string; duration?: number; price?: number }>
    horarios: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isAvailable: boolean }>
  }
  error?: string
}> {
  try {
    const { l3ClinicService } = await import('@/services/memory/L3-clinic.service')

    const clinic = await l3ClinicService.getById(clinicId)
    if (!clinic) {
      return {
        success: false,
        error: 'Clínica não encontrada',
      }
    }

    return {
      success: true,
      data: {
        clinicId: clinic.clinicId,
        nome: clinic.nome,
        telefone: clinic.telefone,
        profissionais: clinic.profissionais,
        procedimentos: clinic.procedimentos,
        horarios: clinic.horarios,
      },
    }
  } catch (error) {
    dbLogger.error('getClinicInfoTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao buscar clínica',
    }
  }
}

/**
 * Send message to patient
 */
export async function sendMessageTool(
  channel: string,
  message: string,
  conversationId?: string,
  patientId?: string
): Promise<{
  success: boolean
  messageId?: string
  error?: string
}> {
  try {
    const { sendWhatsAppMessage } = await import('@/services/whatsapp')

    // Get phone number from conversation or patient
    let phone: string | undefined

    if (conversationId) {
      const { l4ConversationService } = await import('@/services/memory/L4-conversation.service')
      const conversation = await l4ConversationService.getBasicById(conversationId)
      if (conversation?.patientId) {
        const { l2PatientService } = await import('@/services/memory/L2-patient.service')
        const patient = await l2PatientService.getById(conversation.patientId)
        phone = patient?.telefone
      }
    } else if (patientId) {
      const { l2PatientService } = await import('@/services/memory/L2-patient.service')
      const patient = await l2PatientService.getById(patientId)
      phone = patient?.telefone
    }

    if (!phone) {
      return {
        success: false,
        error: conversationId
          ? 'Conversa não encontrada ou sem paciente associado'
          : 'Paciente não encontrado',
      }
    }

    // Send via WhatsApp (most common channel)
    if (channel === 'whatsapp' || channel === 'whatsapp-business') {
      const result = await sendWhatsAppMessage(phone, message)
      return result
    }

    // For other channels, return not implemented
    return {
      success: false,
      error: `Canal ${channel} não implementado`,
    }
  } catch (error) {
    dbLogger.error('sendMessageTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao enviar mensagem',
    }
  }
}

/**
 * Log agent decision for audit trail
 */
export async function logDecisionTool(
  agent: string,
  action: string,
  reasoning: string,
  conversationId?: string
): Promise<{
  success: boolean
  id?: string
  error?: string
}> {
  try {
    const { decisionLogService } = await import('@/services/agent/decision-log.service')

    const result = await decisionLogService.logDecision({
      clinicId: '', // Required but not used in tools context
      intentClassified: agent,
      confidenceScore: 1.0,
      actionTaken: action,
      riskLevel: 'LOW',
      reasoning,
    })

    return {
      success: !!result,
      id: result as string || undefined,
    }
  } catch (error) {
    dbLogger.error('logDecisionTool error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao registrar decisão',
    }
  }
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

/**
 * Registry mapping tool names to their implementations
 */
export const BASE_TOOL_IMPLEMENTATIONS: Record<string, any> = {
  search_patient: async (args: any) =>
    searchPatientTool(args.query, args.clinicId),

  get_clinic_info: async (args: any) =>
    getClinicInfoTool(args.clinicId),

  send_message: async (args: any) =>
    sendMessageTool(args.channel, args.message, args.conversationId, args.patientId),

  log_decision: async (args: any) =>
    logDecisionTool(args.agent, args.action, args.reasoning, args.conversationId),
}
