/**
 * LLM Provider Interface
 * Provider-agnostic interface for LLM capabilities.
 * All providers use OpenAI-compatible format (compatibility mode).
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface IntentResult {
  intent: string
  confidence: number
  entities: Record<string, string | null>
}

export interface ConversationContext {
  intent: string
  entities: Record<string, string | null>
  conversationHistory: ChatMessage[]
  clinicInfo?: {
    name: string
    procedures: string[]
  }
  ragContext?: string
}

export interface LLMProvider {
  /** Provider name for logging */
  readonly name: string

  /** Send a chat completion request */
  chat(
    messages: ChatMessage[],
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string>

  /** Classify intent from a message */
  classifyIntent(message: string): Promise<IntentResult>

  /** Extract entities from a message */
  extractEntities(message: string): Promise<Record<string, string | null>>

  /** Generate a contextual response */
  generateResponse(
    message: string,
    context: ConversationContext
  ): Promise<string>

  /** Check if escalation to human is needed */
  shouldEscalate(message: string, intent: string): Promise<boolean>
}
