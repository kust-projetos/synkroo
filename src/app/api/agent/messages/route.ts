import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateConversation, storeMessage } from '@/lib/supabase/admin'
import { agent } from '@/services/agent/agent.service'
import { dbLogger } from '@/lib/logger'
import type { ChannelType } from '@/lib/supabase/database.types'

/**
 * POST /api/agent/messages
 * Entry point for all multi-agent messages
 * Receives message from any channel (widget/whatsapp/instagram)
 * and returns AI response with intent classification
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { clinic_id, visitor_id, message, conversation_id, channel } = body

    // Validate required fields
    if (!clinic_id || !visitor_id || !message) {
      return NextResponse.json(
        {
          error: 'error',
          message: 'Missing required fields: clinic_id, visitor_id, and message are required',
          conversation_id: conversation_id || null,
        },
        { status: 400 }
      )
    }

    // Validate channel
    const validChannels: ChannelType[] = ['whatsapp', 'instagram', 'web']
    const channelMap: Record<string, ChannelType> = {
      widget: 'web',
      whatsapp: 'whatsapp',
      instagram: 'instagram',
    }
    const dbChannel = channelMap[channel] || channel
    if (!validChannels.includes(dbChannel as ChannelType)) {
      return NextResponse.json(
        {
          error: 'error',
          message: `Invalid channel: ${channel}. Must be one of: widget, whatsapp, instagram`,
          conversation_id: conversation_id || null,
        },
        { status: 400 }
      )
    }

    // Build external ID based on channel and visitor
    const externalId = `${channel}_${visitor_id}`

    // Get or create conversation
    let convId: string
    try {
      convId = await getOrCreateConversation(clinic_id, dbChannel as ChannelType, externalId)
    } catch (error) {
      dbLogger.error('Failed to get or create conversation', error)
      return NextResponse.json(
        {
          error: 'error',
          message: 'Failed to create conversation',
          conversation_id: conversation_id || null,
        },
        { status: 500 }
      )
    }

    // Store inbound message
    try {
      await storeMessage(convId, 'inbound', message)
    } catch (error) {
      dbLogger.error('Failed to store inbound message', error)
      // Continue processing even if storing fails
    }

    // Process message with AI agent
    let response
    try {
      response = await agent.processMessage(convId, message, {
        channel: dbChannel,
        visitor_id,
      })
    } catch (error) {
      dbLogger.error('Agent processing failed', error)
      const errorType = error instanceof Error && error.message.includes('timeout')
        ? 'timeout'
        : 'error'
      return NextResponse.json(
        {
          error: errorType,
          message: error instanceof Error ? error.message : 'Internal processing error',
          conversation_id: convId,
        },
        { status: 500 }
      )
    }

    // Store outbound message
    try {
      await agent.storeMessage(convId, 'outbound', response.message, {
        intent: response.intent,
        entities: response.entities,
        confidence: response.confidence,
        isAi: true,
      })
    } catch (error) {
      dbLogger.error('Failed to store outbound message', error)
      // Continue even if storing fails
    }

    const durationMs = Date.now() - startTime

    // Determine agent type based on action
    const agentType = response.shouldEscalate ? 'escalation' : mapIntentToAgent(response.intent)

    dbLogger.info('Agent message processed', {
      conversationId: convId,
      intent: response.intent,
      action: response.action,
      durationMs,
    })

    return NextResponse.json({
      conversation_id: convId,
      message: response.message,
      intent: response.intent.toUpperCase(),
      agent: agentType,
      confidence: response.confidence,
    })
  } catch (error) {
    dbLogger.error('Unexpected error in agent messages route', error)
    return NextResponse.json(
      {
        error: 'error',
        message: error instanceof Error ? error.message : 'Internal server error',
        conversation_id: null,
      },
      { status: 500 }
    )
  }
}

/**
 * Map intent string to agent type
 */
function mapIntentToAgent(intent: string): string {
  const intentLower = intent.toLowerCase()
  if (intentLower.includes('agend') || intentLower.includes('schedule')) {
    return 'scheduler'
  }
  if (intentLower.includes('orc') || intentLower.includes('budget') || intentLower.includes('price')) {
    return 'sales'
  }
  if (intentLower.includes('medical') || intentLower.includes('info')) {
    return 'generalist'
  }
  return 'generalist'
}
