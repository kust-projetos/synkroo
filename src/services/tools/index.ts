/**
 * Tools Index - Synkroo Agent Tools System
 * Exports all tools and provides agent-specific tool configurations
 */

import type { Tool } from './base.tools'

// Export Tool interface
export type { Tool } from './base.tools'

// Export all tool definitions
export { BASE_TOOLS } from './base.tools'
export { ROUTER_TOOLS } from './router.tools'
export { SCHEDULER_TOOLS } from './scheduler.tools'
export { SALES_TOOLS } from './sales.tools'
export { GENERALIST_TOOLS } from './generalist.tools'

// Export tool implementations
export {
  searchPatientTool,
  getClinicInfoTool,
  sendMessageTool,
  logDecisionTool,
} from './base.tools'

export {
  classifyIntentTool,
  extractEntitiesTool,
} from './router.tools'

export {
  checkAvailabilityTool,
  bookAppointmentTool,
  cancelAppointmentTool,
  rescheduleAppointmentTool,
} from './scheduler.tools'

export {
  getLeadInfoTool,
  createBudgetTool,
  sendPromotionTool,
} from './sales.tools'

export {
  searchKnowledgeTool,
  answerFaqTool,
} from './generalist.tools'

// Import implementations for registry
import { BASE_TOOL_IMPLEMENTATIONS } from './base.tools'
import { ROUTER_TOOL_IMPLEMENTATIONS } from './router.tools'
import { SCHEDULER_TOOL_IMPLEMENTATIONS } from './scheduler.tools'
import { SALES_TOOL_IMPLEMENTATIONS } from './sales.tools'
import { GENERALIST_TOOL_IMPLEMENTATIONS } from './generalist.tools'

// ============================================================================
// Agent Tool Configurations
// ============================================================================

/**
 * Tools available to each agent type
 * Combines base tools with agent-specific tools
 */
export const AGENT_TOOLS: Record<string, Tool[]> = {
  router: [
    // BASE_TOOLS
    { name: 'search_patient', description: 'Busca paciente por telefone ou nome', inputSchema: { type: 'object', properties: { query: { type: 'string' }, clinicId: { type: 'string' } }, required: ['query', 'clinicId'] } },
    { name: 'get_clinic_info', description: 'Obtém informações da clínica', inputSchema: { type: 'object', properties: { clinicId: { type: 'string' } }, required: ['clinicId'] } },
    { name: 'send_message', description: 'Envia mensagem para o paciente', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' }, conversationId: { type: 'string' }, patientId: { type: 'string' } }, required: ['channel', 'message'] } },
    { name: 'log_decision', description: 'Registra decisão do agente', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, action: { type: 'string' }, reasoning: { type: 'string' }, conversationId: { type: 'string' } }, required: ['agent', 'action', 'reasoning'] } },
    // Router-specific
    { name: 'classify_intent', description: 'Classifica a intenção do usuário a partir de uma mensagem', inputSchema: { type: 'object', properties: { message: { type: 'string' }, context: { type: 'string' } }, required: ['message'] } },
    { name: 'extract_entities', description: 'Extrai entidades de uma mensagem (datas, procedimentos, dentistas)', inputSchema: { type: 'object', properties: { message: { type: 'string' }, clinicId: { type: 'string' } }, required: ['message', 'clinicId'] } },
  ],

  scheduler: [
    // BASE_TOOLS
    { name: 'search_patient', description: 'Busca paciente por telefone ou nome', inputSchema: { type: 'object', properties: { query: { type: 'string' }, clinicId: { type: 'string' } }, required: ['query', 'clinicId'] } },
    { name: 'get_clinic_info', description: 'Obtém informações da clínica', inputSchema: { type: 'object', properties: { clinicId: { type: 'string' } }, required: ['clinicId'] } },
    { name: 'send_message', description: 'Envia mensagem para o paciente', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' }, conversationId: { type: 'string' }, patientId: { type: 'string' } }, required: ['channel', 'message'] } },
    { name: 'log_decision', description: 'Registra decisão do agente', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, action: { type: 'string' }, reasoning: { type: 'string' }, conversationId: { type: 'string' } }, required: ['agent', 'action', 'reasoning'] } },
    // Scheduler-specific
    { name: 'check_availability', description: 'Verifica disponibilidade de horários para uma data', inputSchema: { type: 'object', properties: { dentistId: { type: 'string' }, date: { type: 'string' }, clinicId: { type: 'string' }, durationMinutes: { type: 'number' } }, required: ['date', 'clinicId'] } },
    { name: 'book_appointment', description: 'Agenda uma consulta', inputSchema: { type: 'object', properties: { clinicId: { type: 'string' }, patientId: { type: 'string' }, dentistId: { type: 'string' }, procedureId: { type: 'string' }, date: { type: 'string' }, time: { type: 'string' }, notes: { type: 'string' } }, required: ['clinicId', 'patientId', 'date', 'time'] } },
    { name: 'cancel_appointment', description: 'Cancela uma consulta', inputSchema: { type: 'object', properties: { appointmentId: { type: 'string' }, reason: { type: 'string' } }, required: ['appointmentId'] } },
    { name: 'reschedule_appointment', description: 'Remarca uma consulta para nova data/horário', inputSchema: { type: 'object', properties: { appointmentId: { type: 'string' }, newDate: { type: 'string' }, newTime: { type: 'string' }, reason: { type: 'string' } }, required: ['appointmentId', 'newDate', 'newTime'] } },
  ],

  sales: [
    // BASE_TOOLS
    { name: 'search_patient', description: 'Busca paciente por telefone ou nome', inputSchema: { type: 'object', properties: { query: { type: 'string' }, clinicId: { type: 'string' } }, required: ['query', 'clinicId'] } },
    { name: 'get_clinic_info', description: 'Obtém informações da clínica', inputSchema: { type: 'object', properties: { clinicId: { type: 'string' } }, required: ['clinicId'] } },
    { name: 'send_message', description: 'Envia mensagem para o paciente', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' }, conversationId: { type: 'string' }, patientId: { type: 'string' } }, required: ['channel', 'message'] } },
    { name: 'log_decision', description: 'Registra decisão do agente', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, action: { type: 'string' }, reasoning: { type: 'string' }, conversationId: { type: 'string' } }, required: ['agent', 'action', 'reasoning'] } },
    // Sales-specific
    { name: 'get_lead_info', description: 'Obtém informações de um lead', inputSchema: { type: 'object', properties: { leadId: { type: 'string' } }, required: ['leadId'] } },
    { name: 'create_budget', description: 'Cria um orçamento para um paciente', inputSchema: { type: 'object', properties: { clinicId: { type: 'string' }, patientId: { type: 'string' }, title: { type: 'string' }, items: { type: 'array' }, discount_percent: { type: 'number' }, valid_until: { type: 'string' }, notes: { type: 'string' } }, required: ['clinicId', 'patientId', 'items'] } },
    { name: 'send_promotion', description: 'Envia uma promoção para um paciente ou lista de pacientes', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, patientIds: { type: 'array' }, promotionTitle: { type: 'string' }, promotionMessage: { type: 'string' }, campaignId: { type: 'string' } }, required: ['channel', 'patientIds', 'promotionTitle', 'promotionMessage'] } },
  ],

  generalist: [
    // BASE_TOOLS
    { name: 'search_patient', description: 'Busca paciente por telefone ou nome', inputSchema: { type: 'object', properties: { query: { type: 'string' }, clinicId: { type: 'string' } }, required: ['query', 'clinicId'] } },
    { name: 'get_clinic_info', description: 'Obtém informações da clínica', inputSchema: { type: 'object', properties: { clinicId: { type: 'string' } }, required: ['clinicId'] } },
    { name: 'send_message', description: 'Envia mensagem para o paciente', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message: { type: 'string' }, conversationId: { type: 'string' }, patientId: { type: 'string' } }, required: ['channel', 'message'] } },
    { name: 'log_decision', description: 'Registra decisão do agente', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, action: { type: 'string' }, reasoning: { type: 'string' }, conversationId: { type: 'string' } }, required: ['agent', 'action', 'reasoning'] } },
    // Generalist-specific
    { name: 'search_knowledge', description: 'Busca informações na base de conhecimento da clínica', inputSchema: { type: 'object', properties: { query: { type: 'string' }, clinicId: { type: 'string' }, patientId: { type: 'string' }, maxResults: { type: 'number' } }, required: ['query', 'clinicId'] } },
    { name: 'answer_faq', description: 'Busca e retorna resposta para uma pergunta frequente (FAQ)', inputSchema: { type: 'object', properties: { question: { type: 'string' }, clinicId: { type: 'string' } }, required: ['question', 'clinicId'] } },
  ],
}

// ============================================================================
// Tool Executor Registry
// ============================================================================

/**
 * Complete registry of all tool implementations
 * Maps tool name to implementation function
 */
export const TOOL_IMPLEMENTATIONS: Record<string, any> = {
  // Base tools
  ...BASE_TOOL_IMPLEMENTATIONS,
  // Router tools
  ...ROUTER_TOOL_IMPLEMENTATIONS,
  // Scheduler tools
  ...SCHEDULER_TOOL_IMPLEMENTATIONS,
  // Sales tools
  ...SALES_TOOL_IMPLEMENTATIONS,
  // Generalist tools
  ...GENERALIST_TOOL_IMPLEMENTATIONS,
}

// ============================================================================
// Tool Types
// ============================================================================

export type AgentType = 'router' | 'scheduler' | 'sales' | 'generalist'

/**
 * Get tools for a specific agent type
 */
export function getToolsForAgent(agentType: AgentType): Tool[] {
  return AGENT_TOOLS[agentType] || []
}

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const implementation = TOOL_IMPLEMENTATIONS[toolName]
  if (!implementation) {
    throw new Error(`Tool ${toolName} not found`)
  }
  return implementation(args)
}
