import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getWhatsAppService } from '@/services/whatsapp'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'
import { whatsappSendSchema } from '@/lib/validations'
import { handleApiError } from '@/lib/errors'

/**
 * POST /api/whatsapp/send
 * Send message via WhatsApp
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    if (!hasRequiredRole(authResult.profile!, ['admin', 'owner'])) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const rawBody = await request.json()
    const { to, message } = whatsappSendSchema.parse(rawBody)

    if (!to || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: to, message' },
        { status: 400 }
      )
    }

    const whatsapp = getWhatsAppService()
    const result = await whatsapp.sendMessage(to, message)

    return NextResponse.json(result)
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/whatsapp/send
 * Get WhatsApp session status
 */
export async function GET() {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    if (!hasRequiredRole(authResult.profile!, ['admin', 'owner'])) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const whatsapp = getWhatsAppService()
    const session = whatsapp.getSession()

    return NextResponse.json(session)
  } catch (error) {
    return handleApiError(error)
  }
}