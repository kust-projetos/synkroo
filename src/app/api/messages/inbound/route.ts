import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
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
 * Generic inbound message webhook.
 *
 * Legacy agent removed — AI processing disabled.
 * TODO(W5.3): reconnect to new agent.
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

    // AI response disabled — legacy agent removed
    // TODO(W5.3): reconnect to new agent
    console.warn('[messages/inbound] Message stored (AI disabled)', {
      clinicId,
      from,
      conversationId,
      reason: 'legacy_agent_removed',
    })

    return NextResponse.json({
      success: true,
      ai_enabled: false,
      reason: 'legacy_agent_removed',
      todo: 'TODO(W5.3): reconnect to new agent',
      message: {
        id: savedMessage.id,
        conversation_id: savedMessage.conversationId,
        direction: savedMessage.direction,
        content: savedMessage.content,
        created_at: savedMessage.createdAt,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
