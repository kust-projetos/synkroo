/**
 * MiniMax API Client
 * Provides LLM capabilities for Synkroo agent
 * Compatible with MiniMax 2.7 model
 */

import { withRetry, CircuitBreaker } from './retry'
import { aiLogger } from './logger'

interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface MiniMaxRequest {
  model: string
  messages: MiniMaxMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

interface MiniMaxResponse {
  id: string
  choices: {
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * Extract first complete JSON object from text
 */
function extractFirstJson(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        if (start === -1) start = i
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0 && start !== -1) {
          return text.substring(start, i + 1)
        }
      }
    }
  }

  return null
}

/**
 * Strip thinking/reasoning blocks from MiniMax-M2.7 responses
 * Handles both complete blocks and incomplete/unclosed blocks
 * Note: MiniMax uses literal characters ⍰ and ⍰ (not Unicode escapes)
 */
function stripThinkingBlocks(content: string): string {
  // Remove complete thinking blocks (literally ⍰...⍰)
  let result = content.replace(/<tool_call>[\s\S]*?<\/think>/g, '')
  // Remove incomplete thinking blocks (unclosed) - everything from thinking marker to next { or end
  result = result.replace(/<tool_call>[\s\S]*?(?=\{|\[|$)/g, '')
  // Remove any remaining thinking markers
  result = result.replace(/<tool_call>/g, '')
  result = result.replace(/<\/think>/g, '')
  return result.trim()
}

export class MiniMaxClient {
  private apiKey: string
  private apiUrl: string
  private model: string
  private circuitBreaker: CircuitBreaker

  constructor() {
    this.apiKey = process.env.MINIMAX_API_KEY || ''
    // Always use correct MiniMax API URL (api.minimax.io, not .chat)
    const envUrl = process.env.MINIMAX_API_URL || ''
    this.apiUrl = envUrl.includes('api.minimax.io')
      ? envUrl
      : 'https://api.minimax.io/v1/text/chatcompletion_v2'
    this.model = process.env.MINIMAX_MODEL || 'MiniMax-M2.7'
    // Circuit breaker: 5 failures in 30 seconds to open
    this.circuitBreaker = new CircuitBreaker(5, 30000)
  }

  /**
   * Send a chat completion request to MiniMax
   */
  async chat(
    messages: MiniMaxMessage[],
    options: {
      temperature?: number
      maxTokens?: number
    } = {}
  ): Promise<string> {
    const requestBody: MiniMaxRequest = {
      model: this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      stream: false,
    }

    return this.circuitBreaker.execute(async () => {
      return withRetry(
        async () => {
          const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(requestBody),
          })

          // Get response as text first to handle encoding issues
          const responseText = await response.text()

          // Try to parse JSON
          let data
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            aiLogger.error('Failed to parse MiniMax response', parseError)
            throw new Error('Invalid JSON response from MiniMax')
          }

          // MiniMax API returns base_resp for status
          if (data.base_resp && data.base_resp.status_code !== 0) {
            throw new Error(`MiniMax API error: ${data.base_resp.status_msg || 'Unknown error'}`)
          }

          // Handle both OpenAI and MiniMax response formats
          let content = data.choices?.[0]?.message?.content || data.reply || ''

          aiLogger.debug('Raw content received', { length: content.length })

          // Strip reasoning tokens from MiniMax-M2.7 (thinking model)
          content = stripThinkingBlocks(content)

          aiLogger.debug('Content after stripping thinking blocks', { length: content.length })

          return content
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (attempt, error) => {
            aiLogger.warn('MiniMax retry attempt', { attempt, error: error.message })
          },
        }
      )
    })
  }

  /**
   * Classify intent from a message
   */
  async classifyIntent(message: string): Promise<{
    intent: string
    confidence: number
    entities: Record<string, string>
  }> {
    const systemPrompt = `Você é um classificador de intenções especializado para uma clínica odontológica brasileira.
Analise a mensagem do paciente e retorne APENAS um JSON válido (sem markdown, sem code blocks, sem explicação).

{
  "intent": "agendamento" | "duvida" | "emergencia" | "confirmacao" | "reclamacao" | "outros",
  "confidence": 0.0 a 1.0,
  "entities": {
    "data": "data mencionada em formato ISO (YYYY-MM-DD) ou null",
    "hora": "hora em formato HH:MM ou null",
    "procedimento": "procedimento mencionado ou null",
    "nome": "nome mencionado ou null"
  }
}

GUIA DE CLASSIFICAÇÃO:

1. agendamento: Paciente quer AGENDAR, REAGENDAR ou CANCELAR consulta
   Exemplos: "quero marcar", "preciso reagendar", "vou cancelar minha consulta", "tem horário para quinta?"

2. duvida: Perguntas sobre SERVIÇOS, PREÇOS, PROCEDIMENTOS, HORÁRIOS
   Exemplos: "qual o valor do clareamento?", "vocês fazem implante?", "qual o horário de funcionamento?"

3. emergencia: DOR, URGÊNCIA, NECESSIDADE IMEDIATA - SEMPRE alta confiança (>0.9)
   Exemplos: "estou com muita dor", "meu dente quebrou", "é urgente", "socorro"

4. confirmacao: CONFIRMANDO presença em consulta já agendada
   Exemplos: "confirmo minha consulta", "sim, vou comparecer", "pode confirmar"

5. reclamacao: RECLAMAÇÕES, INSATISFAÇÃO, PROBLEMAS
   Exemplos: "fiquei esperando muito", "não gostei do atendimento", "estou insatisfeito"

6. outros: Saudações, despedidas, mensagens genéricas
   Exemplos: "olá", "bom dia", "obrigado", "tchau"

REGRAS IMPORTANTES:
- Emergências SEMPRE confidence > 0.9
- Se houver múltiplas intenções, priorize: emergencia > reclamacao > agendamento > duvida > outros
- Extraia entidades relacionadas à intenção principal
- Datas relativas como "amanhã", "quinta" devem ser normalizadas para ISO
- RETORNE APENAS O JSON, NENHUMA EXPLICAÇÃO ADICIONAL`

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ], { temperature: 0.3 })

      // Clean response - remove any remaining markdown
      const cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      // Try to find JSON object in response
      // Use extractFirstJson to get the first complete JSON
      const jsonStr = extractFirstJson(cleaned)
      if (jsonStr) {
        aiLogger.debug('Extracted JSON', { length: jsonStr.length })
        try {
          return JSON.parse(jsonStr)
        } catch (parseError) {
          aiLogger.warn('JSON parse failed, attempting fix', { error: String(parseError) })
          // Try to fix common JSON issues
          const fixed = jsonStr
            .replace(/,\s*}/g, '}')  // Remove trailing commas
            .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
            .replace(/'/g, '"')      // Replace single quotes
          return JSON.parse(fixed)
        }
      }

      // Fallback
      return {
        intent: 'outros',
        confidence: 0.5,
        entities: {},
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error)
      aiLogger.error('Intent classification failed', error)
      // Return error info for debugging
      return {
        intent: 'outros',
        confidence: 0.0,
        entities: { _error: errMsg.substring(0, 100) },
      }
    }
  }

  /**
   * Extract entities from a message
   */
  async extractEntities(message: string): Promise<Record<string, string | null>> {
    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = `Você é um extrator de entidades para uma clínica odontológica brasileira.
Analise a mensagem e retorne APENAS um JSON válido (sem markdown, sem code blocks, sem explicação).

Data de referência hoje: ${today}

{
  "data": "data normalizada em ISO (YYYY-MM-DD) ou null",
  "hora": "hora normalizada (HH:MM) ou null",
  "nome": "nome mencionado ou null",
  "telefone": "telefone em formato E.164 (+55...) ou null",
  "procedimento": "procedimento odontológico mencionado ou null"
}

REGRAS DE NORMALIZAÇÃO DE DATAS:
- "hoje" → ${today}
- "amanhã" → calcular a partir de ${today}
- "quinta", "sexta", etc. → PRÓXIMA ocorrência a partir de hoje
- "dia 15", "15/03" → completar com mês/ano atual
- "próxima semana" → calcular

REGRAS DE NORMALIZAÇÃO DE HORÁRIOS:
- "10h", "10 horas" → "10:00"
- "depois do almoço" → "14:00"
- "cedo", "manhã" → "09:00"
- "tarde" → "15:00"
- "fim de tarde" → "17:00"

PROCEDIMENTOS COMUNS:
- clareamento, limpeza, extração, canal, implante, lente, branqueamento, obturação, canal

TELEFONE:
- Sempre incluir código do país (+55)
- Remover formatação (espaços, parênteses, traços)

RETORNE APENAS O JSON, NENHUMA EXPLICAÇÃO ADICIONAL`

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ], { temperature: 0.2 })

      // Clean response
      const cleaned = response
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      // Try to find JSON object in response
      const jsonStr = extractFirstJson(cleaned)
      if (jsonStr) {
        try {
          return JSON.parse(jsonStr)
        } catch {
          // Try to fix common JSON issues
          const fixed = jsonStr
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/'/g, '"')
          return JSON.parse(fixed)
        }
      }

      return {}
    } catch (error) {
      aiLogger.error('Entity extraction failed', error)
      return {}
    }
  }

  /**
   * Generate a contextual response
   */
  async generateResponse(
    message: string,
    context: {
      intent: string
      entities: Record<string, string | null>
      conversationHistory: MiniMaxMessage[]
      clinicInfo?: {
        name: string
        procedures: string[]
      }
      ragContext?: string
    }
  ): Promise<string> {
    const clinicName = context.clinicInfo?.name || 'Clínica Odontológica'
    const procedures = context.clinicInfo?.procedures?.join(', ') || 'consultas, limpeza, clareamento, implantes'

    // Include RAG context in system prompt if available
    const ragPrompt = context.ragContext
      ? `\n\n### CONTEXTO RELEVANTE (use para responder com mais precisão):\n${context.ragContext}`
      : ''

    const systemPrompt = `Você é a Mia, assistente virtual da ${clinicName}.
Você é simpática, profissional e prestativa. Sua personalidade é acolhedora e você sempre tenta ajudar.

INFORMAÇÕES CONTEXTO:
- Intenção detectada: ${context.intent}
- Entidades extraídas: ${JSON.stringify(context.entities)}
- Procedimentos disponíveis: ${procedures}

REGRAS DE COMPORTAMENTO:

1. SAUDAÇÃO: Sempre cumprimente de forma amigável
   - "Olá! 😊", "Oi! Como posso ajudar?"

2. RESPOSTAS CONCRETAS:
   - Se agendamento: ajude a escolher dia e horário
   - Se dúvida: responda objetivamente sobre procedimentos
   - Se emergência: demonstre empatia e ofereça solução rápida

3. LINGUAGEM:
   - Use português brasileiro coloquial mas profissional
   - Evite jargões técnicos excessivos
   - Seja conciso (máximo 3 frases, exceto emergências)

4. O QUE NÃO FAZER:
   - ❌ Inventar preços ou valores
   - ❌ Prometer horários sem verificar
   - ❌ Ser roboticamente formal
   - ❌ Ignorar menção a dor ou urgência

5. QUANDO ESCALAR:
   - Se paciente pedir "falar com alguém", "atendente", "humano"
   - Se não souber responder após 2 tentativas
   - Emergências com dor intensa

EXEMPLOS DE RESPOSTAS BOAS:

Para agendamento:
"Claro! Vou te ajudar a agendar. Temos horários disponíveis na quinta-feira às 14h ou na sexta às 10h. Qual prefere?"

Para dúvida sobre procedimento:
"Fazemos clareamento sim! É um procedimento rápido e com ótimos resultados. Gostaria de saber mais sobre valores e duração?"

Para emergência:
"Poxa, sinto muito que você está passando por isso! 😔 Vou te ajudar rapidinho. Pode me dizer qual dente está doendo?"

Para confirmação:
"Perfeito! Sua consulta está confirmada. Vamos te enviar um lembrete no dia anterior. Mais alguma coisa?"

Para reclamação:
"Entendo sua insatisfação e peço desculpas pelo transtorno. Vou transferir você para nossa equipe que pode resolver isso agora mesmo."${ragPrompt}`

    const messages: MiniMaxMessage[] = [
      { role: 'system', content: systemPrompt },
      ...context.conversationHistory.slice(-6), // Keep last 6 messages for context
      { role: 'user', content: message },
    ]

    return await this.chat(messages, { temperature: 0.8 })
  }

  /**
   * Check if escalation to human is needed
   */
  async shouldEscalate(message: string, intent: string): Promise<boolean> {
    const escalationKeywords = [
      'falar com alguém',
      'atendente',
      'humano',
      'gerente',
      'dona',
      'dono',
      'responsável',
    ]

    const lowerMessage = message.toLowerCase()
    if (escalationKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return true
    }

    // Auto-escalate for emergencies and complaints
    if (intent === 'emergencia' || intent === 'reclamacao') {
      return true
    }

    return false
  }
}

// Singleton instance
export const minimax = new MiniMaxClient()