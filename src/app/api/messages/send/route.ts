import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import * as conversationRepo from '@/repositories/conversations'

interface SendMessageRequest {
  to: string
  message: string
  channel?: 'whatsapp' | 'instagram' | 'web'
}

/**
 * POST /api/messages/send
 * Send a message to a patient
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.messages,
      keyPrefix: 'msg-send',
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

    const body: SendMessageRequest = await request.json()
    const { to, message, channel = 'whatsapp' } = body

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      )
    }

    // Get or create conversation
    const conversationId = await conversationRepo.getOrCreateConversation(
      clinicId,
      channel,
      to,
    )

    // Store outbound message
    const savedMessage = await conversationRepo.createMessage({
      conversationId,
      direction: 'outbound',
      content: message,
      messageType: 'text',
      isAi: true,
    })

    // Send via WhatsApp service if channel is whatsapp
    let deliveryStatus = 'pending'
    let deliveryError: string | null = null

    if (channel === 'whatsapp') {
      try {
        const { getWhatsAppService } = await import('@/services/whatsapp')
        const whatsapp = getWhatsAppService()
        const session = whatsapp.getSession()

        if (session.isConnected) {
          const result = await whatsapp.sendMessage(to, message)
          deliveryStatus = result.success ? 'sent' : 'failed'
          if (!result.success) {
            deliveryError = 'Failed to send via WhatsApp'
          }
        } else {
          deliveryStatus = 'queued'
          deliveryError = 'WhatsApp not connected, message queued'
        }
      } catch (waError) {
        console.error('WhatsApp send error:', waError)
        deliveryStatus = 'failed'
        deliveryError = waError instanceof Error ? waError.message : 'Unknown WhatsApp error'
      }
    }

    // Update message with delivery status
    if (deliveryStatus !== 'pending') {
      await conversationRepo.updateMessage(savedMessage.id, {
        metadata: {
          delivery_status: deliveryStatus,
          delivery_error: deliveryError,
          delivered_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
        },
      })
    }

    // Update conversation last_message_at
    await conversationRepo.updateConversation(conversationId, { lastMessageAt: new Date() })

    return NextResponse.json({
      success: true,
      message: {
        id: savedMessage.id,
        conversation_id: savedMessage.conversationId,
        direction: savedMessage.direction,
        content: savedMessage.content,
        created_at: savedMessage.createdAt,
      },
      deliveryStatus,
      deliveryError,
    })
  } catch (error) {
    return handleApiError(error)
  }
}