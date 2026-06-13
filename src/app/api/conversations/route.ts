import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import * as conversationRepo from '@/repositories/conversations'

/**
 * GET /api/conversations
 * List conversations with filters + last message enrichment
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, rateLimitPresets.messages)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const channel = searchParams.get('channel')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const rows = await conversationRepo.findByClinic(clinicId, {
      status: status ?? undefined,
      channel: channel ?? undefined,
      limit,
      offset,
    })

    // Enrich each conversation with last message
    const withLastMessage = await Promise.all(
      rows.map(async (conv) => {
        const lastMsg = await conversationRepo.getLastMessage(conv.id)
        return {
          id: conv.id,
          channel: conv.channel,
          status: conv.status,
          external_id: conv.externalId,
          last_message_at: conv.lastMessageAt,
          message_count: conv.messageCount,
          created_at: conv.createdAt,
          updated_at: conv.updatedAt,
          patients: conv.patient,
          assigned_user: conv.assignedUser,
          last_message: lastMsg
            ? { content: lastMsg.content, direction: lastMsg.direction, intent: lastMsg.intent, created_at: lastMsg.createdAt }
            : null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      conversations: withLastMessage,
      total: withLastMessage.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}