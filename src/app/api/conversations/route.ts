import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, createClient } from '@/lib/supabase/server'

/**
 * GET /api/conversations
 * List conversations with filters
 */
export async function GET(request: NextRequest) {
  try {
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

    const serverClient = await createClient()

    let query = serverClient
      .from('conversations')
      .select(`
        id,
        channel,
        status,
        external_id,
        last_message_at,
        message_count,
        created_at,
        updated_at,
        patient:patients(id, name, phone),
        assigned_user:users(id, name)
      `)
      .eq('clinic_id', clinicId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (channel) {
      query = query.eq('channel', channel)
    }

    const { data: conversations, error } = await query

    if (error) {
      console.error('Error fetching conversations:', error)
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      )
    }

    // Get last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        const { data: lastMessage } = await serverClient
          .from('messages')
          .select('content, direction, intent, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        return {
          ...conv,
          last_message: lastMessage || null,
        }
      })
    )

    return NextResponse.json({
      success: true,
      conversations: conversationsWithLastMessage,
      total: conversationsWithLastMessage.length,
    })
  } catch (error) {
    console.error('Error in conversations API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
