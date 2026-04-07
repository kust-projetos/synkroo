import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { agent } from '@/services/agent/agent.service'
import { handleApiError, DatabaseError } from '@/lib/errors'
import { dbLogger } from '@/lib/logger'

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

    const supabase = createServerClient() as any

    // Find or create conversation for this visitor
    const externalId = `widget_${visitorId}`

    let { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('external_id', externalId)
      .single()

    if (!conversation) {
      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from('conversations')
        .insert({
          clinic_id: clinicId,
          channel: 'web',
          external_id: externalId,
          status: 'active',
        })
        .select('id')
        .single()

      if (createError) {
        dbLogger.error('Error creating conversation', createError)
        return NextResponse.json({ messages: [] })
      }
      conversation = newConversation
    }

    // Get messages
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, direction, created_at')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (error) {
      dbLogger.error('Error fetching messages', error)
      return NextResponse.json({ messages: [] })
    }

    return NextResponse.json({
      conversation_id: conversation.id,
      messages: messages || [],
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

    const supabase = createServerClient() as any

    // Find or create conversation
    let convId = conversation_id
    const externalId = `widget_${visitor_id}`

    if (!convId) {
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('clinic_id', clinic_id)
        .eq('external_id', externalId)
        .single()

      if (existingConversation) {
        convId = existingConversation.id
      } else {
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert({
            clinic_id,
            channel: 'web',
            external_id: externalId,
            status: 'active',
          })
          .select('id')
          .single()

        if (createError) {
          return handleApiError(new DatabaseError('Failed to create conversation', createError))
        }
        convId = newConversation.id
      }
    }

    // Store user message
    const userMessage = await agent.storeMessage(convId, 'inbound', message, {
      isAi: false,
    })

    // Process with AI agent
    const response = await agent.processMessage(convId, message, {
      channel: 'web',
      visitor_id,
    })

    // Store bot response
    const botMessage = await agent.storeMessage(convId, 'outbound', response.message, {
      intent: response.intent,
      entities: response.entities,
      confidence: response.confidence,
      isAi: true,
    })

    return NextResponse.json({
      conversation_id: convId,
      user_message: {
        id: userMessage?.id,
        content: message,
      },
      bot_response: {
        id: botMessage?.id,
        content: response.message,
        intent: response.intent,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}