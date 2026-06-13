import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, ValidationError } from '@/lib/errors'
import { dbLogger } from '@/lib/logger'
import * as conversationRepo from '@/repositories/conversations'
import * as messageRepo from '@/repositories/conversations'
import { getLLMProvider } from '@/lib/llm'

/**
 * GET /api/widget/messages
 * Get messages for a visitor (chat widget)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const clinicId = searchParams.get('clinic_id')
    const visitorId = searchParams.get('visitor_id')

    if (!clinicId || !visitorId) {
      return NextResponse.json(
        { error: 'Missing clinic_id or visitor_id' },
        { status: 400 }
      )
    }

    const externalId = `widget_${visitorId}`

    // Find existing conversation
    const existingConvs = await conversationRepo.findByExternalId(clinicId, 'web', externalId)
    let conversationId: string

    if (existingConvs.length > 0) {
      conversationId = existingConvs[0].id
    } else {
      // Create new conversation
      conversationId = await conversationRepo.getOrCreateConversation(clinicId, 'web', externalId)
    }

    // Get messages
    const msgs = await messageRepo.findMessagesByConversation(conversationId, { limit: 50 })

    return NextResponse.json({
      conversation_id: conversationId,
      messages: msgs.map(m => ({
        id: m.id,
        content: m.content,
        direction: m.direction,
        created_at: m.createdAt,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/widget/messages
 * Send a message from the widget and get AI response
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { clinic_id, visitor_id, message, conversation_id } = body

    if (!clinic_id || !visitor_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const externalId = `widget_${visitor_id}`
    let convId = conversation_id

    // Find or create conversation
    if (!convId) {
      const existingConvs = await conversationRepo.findByExternalId(clinic_id, 'web', externalId)
      if (existingConvs.length > 0) {
        convId = existingConvs[0].id
      } else {
        convId = await conversationRepo.getOrCreateConversation(clinic_id, 'web', externalId)
      }
    }

    // Store user message (Drizzle — no Supabase)
    const userMsg = await messageRepo.createMessage({
      conversationId: convId,
      direction: 'inbound',
      content: message,
      isAi: false,
    })

    // Update conversation metadata
    await conversationRepo.updateConversation(convId, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    })

    // Generate AI response via LLM directly (no Supabase dependency)
    const llm = getLLMProvider()
    const { intent, confidence, entities } = await llm.classifyIntent(message)
    const context = await conversationRepo.getConversationContext(convId, 10)
    const responseText = await llm.generateResponse(message, {
      intent,
      entities,
      conversationHistory: context.map(c => ({
        role: c.role as 'user' | 'assistant',
        content: c.content,
      })),
    })

    // Store bot response (Drizzle — no Supabase)
    const botMsg = await messageRepo.createMessage({
      conversationId: convId,
      direction: 'outbound',
      content: responseText,
      intent,
      entities,
      confidence: String(confidence),
      isAi: true,
    })

    return NextResponse.json({
      conversation_id: convId,
      user_message: { id: userMsg.id, content: message },
      bot_response: {
        id: botMsg.id,
        content: responseText,
        intent,
        confidence,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}