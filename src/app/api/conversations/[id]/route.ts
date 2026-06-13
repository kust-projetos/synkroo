import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import * as conversationRepo from '@/repositories/conversations'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/conversations/[id]
 * Get conversation details with messages
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params

    const conversation = await conversationRepo.findByIdWithJoins(id, clinicId)

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const msgs = await conversationRepo.findMessagesByConversation(id, { limit: 200 })

    return NextResponse.json({
      success: true,
      conversation: {
        id: conversation.id,
        clinic_id: conversation.clinicId,
        channel: conversation.channel,
        status: conversation.status,
        external_id: conversation.externalId,
        last_message_at: conversation.lastMessageAt,
        message_count: conversation.messageCount,
        created_at: conversation.createdAt,
        updated_at: conversation.updatedAt,
        patients: conversation.patient,
        assigned_user: conversation.assignedUser,
        messages: msgs.map(m => ({
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
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}