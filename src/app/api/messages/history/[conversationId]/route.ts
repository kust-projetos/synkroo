import { NextRequest, NextResponse } from 'next/server'
import { handleApiError } from '@/lib/errors'
import * as conversationRepo from '@/repositories/conversations'

interface RouteParams {
  params: Promise<{ conversationId: string }>
}

/**
 * GET /api/messages/history/[conversationId]
 * Get message history for a conversation
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { conversationId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const rows = await conversationRepo.findMessagesByConversation(conversationId, { limit, offset })
    const total = await conversationRepo.countMessagesByConversation(conversationId)

    return NextResponse.json({
      messages: rows.map(m => ({
        id: m.id,
        conversation_id: m.conversationId,
        direction: m.direction,
        content: m.content,
        message_type: m.messageType,
        media_url: m.mediaUrl,
        metadata: m.metadata,
        intent: m.intent,
        entities: m.entities,
        confidence: m.confidence,
        is_ai: m.isAi,
        delivered_at: m.deliveredAt,
        read_at: m.readAt,
        created_at: m.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: total > offset + limit,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}