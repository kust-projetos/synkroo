/**
 * LLM Provider Layer - Barrel Export
 * Provider-agnostic LLM access via factory pattern.
 *
 * Usage:
 *   import { getLLMProvider } from '@/lib/llm'
 *   const llm = getLLMProvider()
 *   const result = await llm.classifyIntent("quero agendar")
 */

export { getLLMProvider, resetLLMProvider } from './factory'
export { OpenAICompatProvider } from './openai-compat'
export type { LLMProvider, ChatMessage, IntentResult, ConversationContext } from './provider'
