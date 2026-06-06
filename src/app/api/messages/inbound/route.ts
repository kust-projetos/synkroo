import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerClient } from '@/lib/supabase'
import { getLLMProvider } from '@/lib/llm'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import type { Message } from '@/lib/supabase/database.types'

/**
 * Verify webhook secret using timing-safe comparison
 */
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
    // Rate limit by webhook source IP or clinic
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.webhook,
      maxRequests: 120, // Higher limit for inbound webhooks
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    // Verify webhook secret
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

    const serverClient = createServerClient() as any

    // Get or create conversation
    let conversation: any = null
    const { data: existingConv } = await serverClient
      .from('conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('channel', channel)
      .eq('external_id', from)
      .single()
    conversation = existingConv

    if (!conversation) {
      const { data: newConv } = await serverClient
        .from('conversations')
        .insert({
          clinic_id: clinicId,
          channel,
          external_id: from,
          status: 'active',
        })
        .select()
        .single()
      conversation = newConv
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Store inbound message
    const { data: savedMessage } = await serverClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'inbound',
        content: message,
        message_type: 'text',
        metadata,
        is_ai: false,
      })
      .select()
      .single()

    // Capture lead from WhatsApp (best-effort, does not block message flow)
    try {
      const { captureLeadFromWhatsApp } = await import('@/services/leads/leads.service')
      await captureLeadFromWhatsApp(from, message, clinicId)
    } catch (leadError) {
      console.error('Lead capture failed:', leadError)
    }

    // Process message with AI
    const llm = getLLMProvider()
    // 1. Classify intent
    const { intent, confidence, entities } = await llm.classifyIntent(message)

    // 2. Extract entities
    const extractedEntities = await llm.extractEntities(message)

    // 3. Update message with intent and entities
    await serverClient
      .from('messages')
      .update({
        intent,
        entities: { ...entities, ...extractedEntities },
        confidence,
      })
      .eq('id', savedMessage?.id)

    // 4. Check if escalation needed
    const shouldEscalate = await llm.shouldEscalate(message, intent)

    if (shouldEscalate) {
      // Update conversation status
      await serverClient
        .from('conversations')
        .update({ status: 'escalated' })
        .eq('id', conversation.id)

      // Return escalation response
      return NextResponse.json({
        success: true,
        message: savedMessage,
        intent,
        confidence,
        entities: extractedEntities,
        action: 'escalate',
        response: 'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.',
      })
    }

    // 5. Get conversation history for context
    const { data: history } = await serverClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10)

    const conversationHistory = (history || []).map((msg: { direction: string; content: string }) => ({
      role: msg.direction === 'inbound' ? 'user' : 'assistant',
      content: msg.content,
    })) as { role: 'user' | 'assistant'; content: string }[]

    // 6. Generate AI response
    const aiResponse = await llm.generateResponse(message, {
      intent,
      entities: extractedEntities,
      conversationHistory,
    })

    // 7. Store AI response
    const { data: responseMessage } = await serverClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        content: aiResponse,
        message_type: 'text',
        intent,
        entities: extractedEntities,
        confidence,
        is_ai: true,
      })
      .select()
      .single()

    // 8. Update conversation
    await serverClient
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id)

    return NextResponse.json({
      success: true,
      message: savedMessage,
      intent,
      confidence,
      entities: extractedEntities,
      action: 'respond',
      response: aiResponse,
      responseMessage,
    })
  } catch (error) {
    return handleApiError(error)
  }
}