import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/messages/whatsapp?contact_id={id}&phone={phone}
 * Get WhatsApp message history for a contact
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contact_id')
    const phone = searchParams.get('phone')

    if (!contactId || !phone) {
      return NextResponse.json(
        { error: 'Missing required params: contact_id, phone' },
        { status: 400 }
      )
    }

    const serverClient = await createClient()

    // Find conversations for this phone number via WhatsApp channel
    const { data: conversations, error: convError } = await serverClient
      .from('conversations')
      .select('id')
      .eq('channel', 'whatsapp')
      .eq('external_id', phone)
      .limit(1)

    if (convError) throw convError

    const conversationIds = (conversations ?? []).map((c: any) => c.id)

    if (conversationIds.length === 0) {
      return NextResponse.json({ messages: [] })
    }

    // Fetch messages for the conversation
    const { data: messages, error: msgError } = await serverClient
      .from('messages')
      .select('id, direction, content, created_at, metadata')
      .in('conversation_id', conversationIds)
      .order('created_at', { ascending: true })

    if (msgError) throw msgError

    return NextResponse.json({ messages: messages ?? [] })
  } catch (error) {
    return handleApiError(error)
  }
}
