import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, createClient } from '@/lib/supabase/server'

/**
 * GET /api/conversations/[id]
 * Get conversation details with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const serverClient = await createClient()

    // Get conversation WITH clinic scoping
    const { data: conversation, error: convError } = await serverClient
      .from('conversations')
      .select(`
        id,
        clinic_id,
        channel,
        status,
        external_id,
        last_message_at,
        message_count,
        created_at,
        updated_at,
        patient:patients(id, name, phone, email),
        assigned_user:users(id, name)
      `)
      .eq('id', id)
      .eq('clinic_id', clinicId)
      .single()

    if (convError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    // Get messages
    const { data: messages, error: msgError } = await serverClient
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (msgError) {
      console.error('Error fetching messages:', msgError)
    }

    return NextResponse.json({
      success: true,
      conversation: {
        ...conversation,
        messages: messages || [],
      },
    })
  } catch (error) {
    console.error('Error in conversation details API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
