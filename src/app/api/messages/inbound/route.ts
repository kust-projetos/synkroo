import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDb } from '@/lib/db/client'
import { conversations, messages } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { getLLMProvider } from '@/lib/llm'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import * as conversationRepo from '@/repositories/conversations'

function verifyWebhookSecret(request: NextRequest): boolean {
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (!webhookSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[messages/inbound] WEBHOOK_SECRET not configured in production')
      return false
    }
    console.warn('[messages/inbound] WEBHOOK_SECRET not configured — allowing request in dev')
    return true
  }
  const provided = request.headers.get('X-Webhook-Secret') || ''
  if (provided.length !== webhookSecret.length ||
      !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(webhookSecret))) {
    return false
  }
  return true
}

interface InboundMessage {
  clinicId: string
  from: string
  message: string
  channel?: 'whatsapp' | 'instagram' | 'web'
  metadata?: Record<string, unknown>
}

/**
 * POST /api/messages/inbound
 * Receive an inbound message and process with AI
 */
export async function POST(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.webhook,
      maxRequests: 120,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    if (!verifyWebhookSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: InboundMessage = await request.json()
    const { clinicId, from, message, channel = 'whatsapp', metadata } = body

    if (!clinicId || !from || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: clinicId, from, message' },
        { status: 400 }
      )
    }

    // Get or create conversation
    const conversationId = await conversationRepo.getOrCreateConversation(
      clinicId,
      channel,
      from,
    )

    // Store inbound message
    const savedMessage = await conversationRepo.createMessage({
      conversationId,
      direction: 'inbound',
      content: message,
      messageType: 'text',
      metadata: metadata ?? {},
      isAi: false,
    })

    // Capture lead from WhatsApp (best-effort, does not block message flow)
    try {
      const { captureLeadFromWhatsApp } = await import('@/services/leads/leads.service')
      await captureLeadFromWhatsApp(from, message, clinicId)
    } catch (leadError) {
      console.error('Lead capture failed:', leadError)
    }

    const llm = getLLMProvider()

    // 1. Classify intent
    const { intent, confidence, entities } = await llm.classifyIntent(message)

    // 2. Extract entities
    const extractedEntities = await llm.extractEntities(message)

    // 3. Update message with intent and entities
    await conversationRepo.updateMessage(savedMessage.id, {
      intent,
      entities: { ...entities, ...extractedEntities },
      confidence: confidence != null ? String(confidence) : null,
    } as Record<string, unknown>)

    // 4. Check if escalation needed
    const shouldEscalate = await llm.shouldEscalate(message, intent)

    if (shouldEscalate) {
      await conversationRepo.updateConversation(conversationId, { status: 'escalated' })

      return NextResponse.json({
        success: true,
        message: { id: savedMessage.id, conversation_id: savedMessage.conversationId, direction: savedMessage.direction, content: savedMessage.content, created_at: savedMessage.createdAt },
        intent,
        confidence,
        entities: extractedEntities,
        action: 'escalate',
        response: 'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.',
      })
    }

    // 5. Get conversation history for context
    const historyRows = await conversationRepo.findMessagesByConversation(conversationId, { limit: 10 })
    const conversationHistory = historyRows.map(m => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    })) as { role: 'user' | 'assistant'; content: string }[]

    // 6. Generate AI response
    const aiResponse = await llm.generateResponse(message, {
      intent,
      entities: extractedEntities,
      conversationHistory,
    })

    // 7. Store AI response
    const responseMessage = await conversationRepo.createMessage({
      conversationId,
      direction: 'outbound',
      content: aiResponse,
      messageType: 'text',
      intent,
      entities: extractedEntities,
      confidence: confidence != null ? String(confidence) : null,
      isAi: true,
    })

    // 8. Update conversation last_message_at
    await conversationRepo.updateConversation(conversationId, { lastMessageAt: new Date() })

    return NextResponse.json({
      success: true,
      message: { id: savedMessage.id, conversation_id: savedMessage.conversationId, direction: savedMessage.direction, content: savedMessage.content, created_at: savedMessage.createdAt },
      intent,
      confidence,
      entities: extractedEntities,
      action: 'respond',
      response: aiResponse,
      responseMessage: { id: responseMessage.id, conversation_id: responseMessage.conversationId, direction: responseMessage.direction, content: responseMessage.content, created_at: responseMessage.createdAt },
    })
  } catch (error) {
    return handleApiError(error)
  }
}