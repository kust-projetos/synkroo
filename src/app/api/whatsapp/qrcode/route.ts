import { NextResponse } from 'next/server'
import { getWhatsAppService } from '@/services/whatsapp'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'

/**
 * GET /api/whatsapp/qrcode
 * Get current QR code for WhatsApp connection
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
    const qrCode = whatsapp.getQRCode()

    // If connected, return success status
    if (session.isConnected) {
      return NextResponse.json({
        connected: true,
        phoneNumber: session.phoneNumber,
        message: 'WhatsApp is connected',
      })
    }

    // If QR code is available, return it
    if (qrCode) {
      return NextResponse.json({
        connected: false,
        qrCode: qrCode,
        message: 'Scan the QR code to connect',
      })
    }

    // No QR code yet - service may still be initializing
    return NextResponse.json({
      connected: false,
      qrCode: null,
      message: 'Waiting for QR code. Please try again in a moment.',
    })
  } catch (error) {
    console.error('Error getting WhatsApp status:', error)
    return NextResponse.json(
      { error: 'Failed to get WhatsApp status' },
      { status: 500 }
    )
  }
}