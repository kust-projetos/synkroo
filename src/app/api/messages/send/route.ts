import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, createClient } from '@/lib/supabase/server'
import type { Message } from '@/lib/supabase/database.types'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

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

    // Rate limiting check
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
    const serverClient = await createClient()

    let conversation: any = null
    const { data: existingConv, error: convError } = await serverClient
      .from('conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('channel', channel)
      .eq('external_id', to)
      .single()
    conversation = existingConv

    if (!conversation) {
      // Create new conversation
      const { data: newConv, error: createError } = await serverClient
        .from('conversations')
        .insert({
          clinic_id: clinicId,
          channel,
          external_id: to,
          status: 'active',
        })
        .select()
        .single()

      if (createError) throw createError
      conversation = newConv
    }

    if (!conversation) {
      throw new Error('Failed to create conversation')
    }

    // Store outbound message
    const { data: savedMessage, error: msgError } = await serverClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        content: message,
        message_type: 'text',
        is_ai: true,
      })
      .select()
      .single()

    if (msgError) throw msgError

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
      await serverClient
        .from('messages')
        .update({
          metadata: {
            delivery_status: deliveryStatus,
            delivery_error: deliveryError,
            delivered_at: deliveryStatus === 'sent' ? new Date().toISOString() : null,
          },
        })
        .eq('id', savedMessage?.id)
    }

    // Update conversation last_message_at
    await serverClient
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation?.id)

    return NextResponse.json({
      success: true,
      message: savedMessage,
      deliveryStatus,
      deliveryError,
    })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}