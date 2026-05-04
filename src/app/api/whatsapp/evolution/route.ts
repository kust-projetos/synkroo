import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServerClient } from '@/lib/supabase'
import { handleApiError } from '@/lib/errors'
import { whatsappLogger } from '@/lib/logger'
import { sendWhatsAppMessage } from '@/services/whatsapp'
import { getLLMProvider } from '@/lib/llm'
import { captureLeadFromWhatsApp } from '@/services/leads/leads.service'
import {
  processConfirmationResponse,
  processWaitlistConfirmation,
} from '@/services/appointments/confirmation-handler.service'

/**
 * Evolution API Webhook
 * Handles incoming WhatsApp messages via Evolution API
 *
 * Expected payload format from Evolution API:
 * {
 *   "event": "messages.upsert",
 *   "instance": "synkroo",
 *   "data": { ...message data... }
 * }
 */

const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'synkroo'

// Deduplication: track processed message IDs (in-memory, resets on server restart)
const processedMessageIds = new Map<string, number>()
const DEDUP_TTL_MS = 5 * 60 * 1000 // 5 min TTL for dedup cache

// Rate limiting: 1 response per number per 30 seconds
const lastResponseTime = new Map<string, number>()
const RATE_LIMIT_MS = 30_000

/**
 * POST /api/whatsapp/evolution/webhook
 * Receives events from Evolution API
 */
export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const apiKey = request.headers.get('apikey')
    if (apiKey && apiKey !== EVOLUTION_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
    }

    const body = await request.json()
    const { event, instance, data } = body

    whatsappLogger.info('Evolution webhook received', { event, instance })

    // Only process message events
    if (event !== 'messages.upsert') {
      return NextResponse.json({ status: 'ignored', event })
    }

    if (!data) {
      return NextResponse.json({ error: 'No data' }, { status: 400 })
    }

    // Extract message info from Evolution format
    const key = data.key
    if (!key || !key.remoteJid) {
      return NextResponse.json({ status: 'ignored', reason: 'No key/remoteJid' })
    }

    const remoteJid = key.remoteJid as string
    const remoteJidAlt = (key as any).remoteJidAlt as string | undefined
    const fromMe = key.fromMe as boolean

    // Skip messages sent by us
    if (fromMe) {
      return NextResponse.json({ status: 'ignored', reason: 'Own message' })
    }

    // Extract phone number from remoteJid
    // Evolution API v2.3.7+ uses LID format: 125842558599202@lid (phone is in remoteJidAlt)
    // Legacy format: 5511999999999@s.whatsapp.net
    let phone: string
    if (remoteJid.endsWith('@lid') && remoteJidAlt) {
      phone = remoteJidAlt.split('@')[0]
    } else {
      phone = remoteJid.split('@')[0]
    }
    if (!phone || phone.length < 10) {
      return NextResponse.json({ status: 'ignored', reason: 'Invalid phone', phone })
    }

    // Extract message content
    let content = ''
    let messageType: 'text' | 'image' | 'audio' | 'document' = 'text'

    if (data.message?.conversation) {
      content = data.message.conversation
    } else if (data.message?.extendedTextMessage?.text) {
      content = data.message.extendedTextMessage.text
    } else if (data.message?.imageMessage) {
      content = data.message.imageMessage.caption || '[Image]'
      messageType = 'image'
    } else if (data.message?.audioMessage) {
      content = '[Audio message]'
      messageType = 'audio'
    } else if (data.message?.documentMessage) {
      content = data.message.documentMessage.fileName || '[Document]'
      messageType = 'document'
    } else if (data.message?.buttonsResponseMessage) {
      content = data.message.buttonsResponseMessage.selectedDisplayText
        || data.message.buttonsResponseMessage.selectedId
        || ''
      messageType = 'text'

      // Process interactive button response (confirm/cancel appointment)
      const selectedButtonId = data.message.buttonsResponseMessage.selectedId as string
      if (selectedButtonId && (selectedButtonId.startsWith('confirm_') || selectedButtonId.startsWith('cancel_'))) {
        const action = selectedButtonId.startsWith('confirm_') ? 'confirm' : 'cancel'
        const appointmentId = selectedButtonId.split('_').slice(1).join('_')

        whatsappLogger.info('Interactive button response received', { phone, action, appointmentId })

        // Process the button action directly
        const serverClient = createServerClient() as any
        const clinicIdForButton = await getClinicByInstance(serverClient, instance || EVOLUTION_INSTANCE)

        if (clinicIdForButton) {
          const { data: appointment } = await serverClient
            .from('appointments')
            .select('id, status, patients (name)')
            .eq('id', appointmentId)
            .eq('clinic_id', clinicIdForButton)
            .single()

          if (appointment) {
            const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
            const { error: updateError } = await serverClient
              .from('appointments')
              .update({
                status: newStatus,
                notes: action === 'confirm'
                  ? 'Confirmado via WhatsApp (botão interativo)'
                  : 'Cancelado pelo paciente via WhatsApp (botão interativo)',
              })
              .eq('id', appointmentId)

            if (!updateError) {
              const patientName = (appointment as any).patients?.name || 'Paciente'
              const responseMsg = action === 'confirm'
                ? `✅ Confirmado, ${patientName}! Sua presença foi registrada. Até lá!`
                : `✅ Entendido, ${patientName}. Sua consulta foi cancelada. Se quiser reagendar, é só me avisar!`

              await sendWhatsAppMessage(phone, responseMsg)
              lastResponseTime.set(phone, Date.now())

              whatsappLogger.info(`Appointment ${action}ed via interactive button`, { appointmentId, phone })
            }
          }
        }

        return NextResponse.json({ success: true, processed: true, action: `button_${action}` })
      }
    } else {
      return NextResponse.json({ status: 'ignored', reason: 'Unsupported message type' })
    }

    if (!content) {
      return NextResponse.json({ status: 'ignored', reason: 'Empty content' })
    }

    whatsappLogger.info('Message received', { phone, content: content.substring(0, 50) })

    // Deduplicate: skip if we already processed this message ID
    const messageId = key.id as string
    if (messageId) {
      const now = Date.now()
      const lastProcessed = processedMessageIds.get(messageId)
      if (lastProcessed && (now - lastProcessed) < DEDUP_TTL_MS) {
        whatsappLogger.info('Duplicate message ignored', { messageId })
        return NextResponse.json({ status: 'ignored', reason: 'Duplicate' })
      }
      processedMessageIds.set(messageId, now)

      // Cleanup old entries every 100 messages
      if (processedMessageIds.size > 100) {
        for (const [id, ts] of processedMessageIds) {
          if (now - ts > DEDUP_TTL_MS) processedMessageIds.delete(id)
        }
      }
    }

    // Rate limit: skip if we responded to this number in the last 30s
    const now = Date.now()
    const lastResponse = lastResponseTime.get(phone)
    if (lastResponse && (now - lastResponse) < RATE_LIMIT_MS) {
      whatsappLogger.info('Rate limited - skipping response', { phone })
      return NextResponse.json({ status: 'ignored', reason: 'Rate limited' })
    }

    // Process the message through the agent pipeline
    const serverClient = createServerClient() as any

    // Find clinic by instance name
    const clinicId = await getClinicByInstance(serverClient, instance || EVOLUTION_INSTANCE)

    if (!clinicId) {
      whatsappLogger.warn('No clinic found for instance', { instance })
      return NextResponse.json({ status: 'ignored', reason: 'No clinic' })
    }

    // Get or create conversation
    let conversation: any = null
    const { data: existingConv } = await serverClient
      .from('conversations')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('channel', 'whatsapp')
      .eq('external_id', phone)
      .single()
    conversation = existingConv

    if (!conversation) {
      const { data: newConv } = await serverClient
        .from('conversations')
        .insert({
          clinic_id: clinicId,
          channel: 'whatsapp',
          external_id: phone,
          status: 'active',
        } as any)
        .select()
        .single()
      conversation = newConv
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Store inbound message
    const { data: savedMessage } = await serverClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'inbound',
        content,
        message_type: messageType,
        metadata: {
          whatsapp_message_id: key.id,
          instance,
          timestamp: data.messageTimestamp,
        },
        is_ai: false,
      } as any)
      .select()
      .single()

    // Check for confirmation/cancellation response first
    const confirmationResult = await processConfirmationResponse(clinicId, phone, content)

    if (confirmationResult.processed && confirmationResult.responseMessage) {
      await serverClient
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          direction: 'outbound',
          content: confirmationResult.responseMessage,
          message_type: 'text',
          intent: confirmationResult.action === 'confirmed' ? 'confirmacao' : 'cancelamento',
          is_ai: false,
        } as any)

      await sendWhatsAppMessage(phone, confirmationResult.responseMessage)
      lastResponseTime.set(phone, Date.now())
      return NextResponse.json({ success: true, processed: true, action: 'confirmation' })
    }

    // Check for waitlist confirmation
    const waitlistResult = await processWaitlistConfirmation(clinicId, phone, content)

    if (waitlistResult.processed && waitlistResult.responseMessage) {
      await serverClient
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          direction: 'outbound',
          content: waitlistResult.responseMessage,
          message_type: 'text',
          intent: 'agendamento',
          is_ai: false,
        } as any)

      await sendWhatsAppMessage(phone, waitlistResult.responseMessage)
      lastResponseTime.set(phone, Date.now())
      return NextResponse.json({ success: true, processed: true, action: 'waitlist' })
    }

    // Capture lead from WhatsApp message (automatic lead creation)
    const leadCaptureResult = await captureLeadFromWhatsApp(phone, content, clinicId)
    if (leadCaptureResult.created) {
      whatsappLogger.info('Lead created from WhatsApp', {
        leadId: leadCaptureResult.leadId,
        score: leadCaptureResult.score,
        phone,
      })
    }

    // Process with AI agent
    const llm = getLLMProvider()
    const { intent, confidence, entities } = await llm.classifyIntent(content)

    // Update message with intent
    await serverClient
      .from('messages')
      .update({
        intent,
        entities,
        confidence,
      } as any)
      .eq('id', savedMessage?.id)

    // Check escalation
    const shouldEscalate = await llm.shouldEscalate(content, intent)

    if (shouldEscalate) {
      await serverClient
        .from('conversations')
        .update({ status: 'escalated' } as any)
        .eq('id', conversation.id)

      await sendWhatsAppMessage(phone,
        'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.')

      return NextResponse.json({ success: true, processed: true, action: 'escalated' })
    }

    // Get conversation history
    const { data: history } = await serverClient
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .limit(10)

    const conversationHistory = (history || []).map((msg: { direction: string; content: string }) => ({
      role: (msg.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    }))

    // Generate AI response
    const aiResponse = await llm.generateResponse(content, {
      intent,
      entities,
      conversationHistory,
    })

    // Store AI response
    await serverClient
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        direction: 'outbound',
        content: aiResponse,
        message_type: 'text',
        intent,
        entities,
        confidence,
        is_ai: true,
      } as any)

    // Send response via WhatsApp
    const sendResult = await sendWhatsAppMessage(phone, aiResponse)
    whatsappLogger.info('WhatsApp send result', { phone, success: sendResult.success, error: sendResult.error })

    // Mark rate limit for this number
    lastResponseTime.set(phone, Date.now())

    // Update conversation timestamp
    await serverClient
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() } as any)
      .eq('id', conversation.id)

    return NextResponse.json({ success: true, processed: true, action: 'responded' })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/whatsapp/evolution/webhook
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'synkroo-evolution-webhook',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Get clinic ID by Evolution instance name
 * Queries whatsapp_instances table to find the clinic associated with the instance
 */
async function getClinicByInstance(
  client: ReturnType<typeof createServerClient>,
  instanceName: string
): Promise<string | null> {
  // Try to find clinic by instance_name in whatsapp_instances
  const { data: instance } = await client
    .from('whatsapp_instances')
    .select('clinic_id')
    .eq('instance_name', instanceName)
    .single()

  if (instance) {
    return (instance as any).clinic_id || null
  }

  // Fallback: if no instance_name match, check if clinic_settings has the instance configured
  // This handles the case where instance_name column was just added and not yet populated
  const { data: settings } = await client
    .from('clinic_settings')
    .select('clinic_id, settings')
    .limit(10)

  if (settings) {
    for (const row of settings as any[]) {
      if (row.settings?.evolution_instance_name === instanceName) {
        return row.clinic_id
      }
    }
  }

  // Last resort: single-clinic MVP fallback (log warning)
  whatsappLogger.warn('No clinic found for instance, using single-clinic fallback', { instanceName })
  const { data: clinic } = await client
    .from('clinics')
    .select('id')
    .eq('subscription_status', 'active')
    .limit(1)
    .single()

  return (clinic as any)?.id || null
}
