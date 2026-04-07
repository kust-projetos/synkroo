/**
 * OpenAI-Compatible Provider
 * Generic provider that works with any OpenAI-compatible API.
 * Supports: MiniMax, OpenAI, OpenRouter, Groq, Together, any OpenAI-format endpoint.
 *
 * This is the "compatibility mode" approach — avoids vendor-specific SDKs
 * and their bugs (e.g. Anthropic SDK 'ClaudeContentBlockToolResult' issues).
 */

import { withRetry, CircuitBreaker } from '@/lib/retry'
import { aiLogger } from '@/lib/logger'
import type { LLMProvider, ChatMessage, IntentResult, ConversationContext } from './provider'

function extractFirstJson(text: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escape) { escape = false; continue }
    if (char === '\\') { escape = true; continue }
    if (char === '"') { inString = !inString; continue }

    if (!inString) {
      if (char === '{') { if (start === -1) start = i; depth++ }
      else if (char === '}') {
        depth--
        if (depth === 0 && start !== -1) return text.substring(start, i + 1)
      }
    }
  }
  return null
}

function stripThinkingBlocks(content: string): string {
  let result = content.replace(/<think[\s\S]*?<\/think>/g, '')
  result = result.replace(/<think[\s\S]*?(?=\{|\[|$)/g, '')
  result = result.replace(/<think >/g, '')
  result = result.replace(/<\/think>/g, '')
  return result.trim()
}

function safeParseJson(raw: string): Record<string, unknown> | null {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const jsonStr = extractFirstJson(cleaned)
  if (!jsonStr) return null

  try {
    return JSON.parse(jsonStr)
  } catch {
    try {
      const fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']').replace(/'/g, '"')
      return JSON.parse(fixed)
    } catch {
      return null
    }
  }
}

export interface OpenAICompatConfig {
  apiUrl: string
  apiKey: string
  model: string
  /** Optional extra headers (e.g. HTTP-Referer for OpenRouter) */
  extraHeaders?: Record<string, string>
}

export class OpenAICompatProvider implements LLMProvider {
  readonly name: string
  private apiUrl: string
  private apiKey: string
  private model: string
  private extraHeaders: Record<string, string>
  private circuitBreaker: CircuitBreaker

  constructor(name: string, config: OpenAICompatConfig) {
    this.name = name
    this.apiUrl = config.apiUrl
    this.apiKey = config.apiKey
    this.model = config.model
    this.extraHeaders = config.extraHeaders ?? {}
    this.circuitBreaker = new CircuitBreaker(5, 30000)
  }

  async chat(
    messages: ChatMessage[],
    options: { temperature?: number; maxTokens?: number } = {}
  ): Promise<string> {
    const body = {
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
              ...this.extraHeaders,
            },
            body: JSON.stringify(body),
          })

          const responseText = await response.text()

          let data: Record<string, unknown>
          try {
            data = JSON.parse(responseText)
          } catch {
            throw new Error(`Invalid JSON response from ${this.name}`)
          }

          // Handle MiniMax-style base_resp
          const baseResp = data.base_resp as { status_code?: number; status_msg?: string } | undefined
          if (baseResp && baseResp.status_code !== 0) {
            throw new Error(`${this.name} API error: ${baseResp.status_msg || 'Unknown error'}`)
          }

          if (!response.ok) {
            throw new Error(`${this.name} HTTP ${response.status}: ${responseText.substring(0, 200)}`)
          }

          // Extract content from OpenAI-compatible format
          const choices = data.choices as Array<{ message?: { content?: string } }> | undefined
          let content = choices?.[0]?.message?.content
            || (data.reply as string)
            || ''

          content = stripThinkingBlocks(content)
          return content
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (attempt, error) => {
            aiLogger.warn(`${this.name} retry`, { attempt, error: error.message })
          },
        }
      )
    })
  }

  async classifyIntent(message: string): Promise<IntentResult> {
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
2. duvida: Perguntas sobre SERVIÇOS, PREÇOS, PROCEDIMENTOS, HORÁRIOS
3. emergencia: DOR, URGÊNCIA, NECESSIDADE IMEDIATA - SEMPRE confidence > 0.9
4. confirmacao: CONFIRMANDO presença em consulta já agendada
5. reclamacao: RECLAMAÇÕES, INSATISFAÇÃO, PROBLEMAS
6. outros: Saudações, despedidas, mensagens genéricas

REGRAS: Emergências SEMPRE confidence > 0.9. Priorize: emergencia > reclamacao > agendamento > duvida > outros.
RETORNE APENAS O JSON.`

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ], { temperature: 0.3 })

      const parsed = safeParseJson(response)
      if (parsed) {
        return {
          intent: (parsed.intent as string) || 'outros',
          confidence: (parsed.confidence as number) || 0.5,
          entities: (parsed.entities as Record<string, string | null>) || {},
        }
      }

      return { intent: 'outros', confidence: 0.5, entities: {} }
    } catch (error) {
      aiLogger.error('Intent classification failed', error)
      return {
        intent: 'outros',
        confidence: 0.0,
        entities: { _error: (error instanceof Error ? error.message : String(error)).substring(0, 100) },
      }
    }
  }

  async extractEntities(message: string): Promise<Record<string, string | null>> {
    const today = new Date().toISOString().split('T')[0]
    const systemPrompt = `Você é um extrator de entidades para uma clínica odontológica brasileira.
Retorne APENAS um JSON válido. Data de referência: ${today}.

{
  "data": "data ISO (YYYY-MM-DD) ou null",
  "hora": "HH:MM ou null",
  "nome": "nome ou null",
  "telefone": "E.164 (+55...) ou null",
  "procedimento": "procedimento ou null"
}

Normalizar: "amanhã", "quinta" → ISO. "10h" → "10:00". Incluir +55 em telefone.
RETORNE APENAS O JSON.`

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ], { temperature: 0.2 })

      const parsed = safeParseJson(response)
      return (parsed as Record<string, string | null>) || {}
    } catch (error) {
      aiLogger.error('Entity extraction failed', error)
      return {}
    }
  }

  async generateResponse(
    message: string,
    context: ConversationContext
  ): Promise<string> {
    const clinicName = context.clinicInfo?.name || 'Clínica Odontológica'
    const procedures = context.clinicInfo?.procedures?.join(', ') || 'consultas, limpeza, clareamento, implantes'
    const ragPrompt = context.ragContext
      ? `\n\n### CONTEXTO RELEVANTE:\n${context.ragContext}`
      : ''

    const systemPrompt = `Você é a Mia, assistente virtual da ${clinicName}.
Você é simpática, profissional e prestativa.

INFORMAÇÕES CONTEXTO:
- Intenção detectada: ${context.intent}
- Entidades extraídas: ${JSON.stringify(context.entities)}
- Procedimentos disponíveis: ${procedures}

REGRAS:
1. Sempre cumprimente de forma amigável
2. Respostas concretas e concisas (máximo 3 frases)
3. Português brasileiro coloquial mas profissional
4. NÃO invente preços ou prometa horários sem verificar
5. Emergências com dor: demonstrar empatia${ragPrompt}`

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...context.conversationHistory.slice(-6),
      { role: 'user', content: message },
    ]

    return await this.chat(messages, { temperature: 0.8 })
  }

  async shouldEscalate(message: string, intent: string): Promise<boolean> {
    const keywords = ['falar com alguém', 'atendente', 'humano', 'gerente', 'responsável']
    const lowerMessage = message.toLowerCase()

    if (keywords.some(k => lowerMessage.includes(k))) return true
    if (intent === 'emergencia' || intent === 'reclamacao') return true

    return false
  }
}
