import { NextRequest, NextResponse } from 'next/server'
import { getLLMProvider } from '@/lib/llm'
import { aiLogger } from '@/lib/logger'
import { validateApiAuth } from '@/lib/supabase/server'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

/**
 * POST /api/agent/classify
 * Classify intent and extract entities from a message
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.messages,
      keyPrefix: 'agent-classify',
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
            ...createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime, rateLimitPresets.messages.maxRequests),
          },
        }
      )
    }

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }

    const body = await request.json()
    const { message, extractEntities = true } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Missing required field: message' },
        { status: 400 }
      )
    }

    const llm = getLLMProvider()

    // Classify intent
    const classification = await llm.classifyIntent(message)

    // Extract entities if requested
    let entities: Record<string, string | null> = classification.entities
    if (extractEntities) {
      const extracted = await llm.extractEntities(message)
      // Filter out null values
      const filteredExtracted: Record<string, string> = {}
      for (const [key, value] of Object.entries(extracted)) {
        if (value !== null) {
          filteredExtracted[key] = value
        }
      }
      entities = { ...entities, ...filteredExtracted }
    }

    // Check for escalation
    const shouldEscalate = await llm.shouldEscalate(message, classification.intent)

    return NextResponse.json({
      success: true,
      intent: classification.intent,
      confidence: classification.confidence,
      entities,
      shouldEscalate,
    })
  } catch (error) {
    aiLogger.error('Error classifying message', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'Failed to classify message', details: errorMessage },
      { status: 500 }
    )
  }
}