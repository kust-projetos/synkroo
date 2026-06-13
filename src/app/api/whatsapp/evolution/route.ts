import { NextRequest, NextResponse } from 'next/server'
import { eq, and, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, whatsappInstances, conversations, messages, appointments } from '@/lib/db/schema'
import { channelType } from '@/lib/db/schema/enums'
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

        // Process the button action directly using Drizzle
        const db = getDb()
        const clinicIdForButton = await getClinicByInstance(db, instance || EVOLUTION_INSTANCE)

        if (clinicIdForButton) {
          // Find appointment with patient info
          const appointmentRows = await db
            .select({
              id: appointments.id,
              status: appointments.status,
              patientName: appointments.patientId,
            })
            .from(appointments)
            .where(and(
              eq(appointments.id, appointmentId),
              eq(appointments.clinicId, clinicIdForButton)
            ))
            .limit(1)

          const appointment = appointmentRows[0]

          if (appointment) {
            const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled'
            await db
              .update(appointments)
              .set({
                status: newStatus as any,
                notes: action === 'confirm'
                  ? 'Confirmado via WhatsApp (botão interativo)'
                  : 'Cancelado pelo paciente via WhatsApp (botão interativo)',
              } as any)
              .where(eq(appointments.id, appointmentId))

            const responseMsg = action === 'confirm'
              ? `✅ Confirmado! Sua presença foi registrada. Até lá!`
              : `✅ Entendido. Sua consulta foi cancelada. Se quiser reagendar, é só me avisar!`

            await sendWhatsAppMessage(phone, responseMsg)
            lastResponseTime.set(phone, Date.now())

            whatsappLogger.info(`Appointment ${action}ed via interactive button`, { appointmentId, phone })
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

    // Process the message through the agent pipeline using Drizzle
    const db = getDb()

    // Find clinic by instance name
    const clinicId = await getClinicByInstance(db, instance || EVOLUTION_INSTANCE)

    if (!clinicId) {
      whatsappLogger.warn('No clinic found for instance', { instance })
      return NextResponse.json({ status: 'ignored', reason: 'No clinic' })
    }

    // Get or create conversation
    const existingConvs = await db
      .select()
      .from(conversations)
      .where(and(
        eq(conversations.clinicId, clinicId),
        eq(conversations.channel, 'whatsapp' as any),
        eq(conversations.externalId, phone)
      ))
      .limit(1)

    let conversation = existingConvs[0] || null

    if (!conversation) {
      const newConvs = await db
        .insert(conversations)
        .values({
          clinicId,
          channel: 'whatsapp' as any,
          externalId: phone,
          status: 'active',
        } as any)
        .returning()
      conversation = newConvs[0] || null
    }

    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Store inbound message
    const savedMessages = await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        direction: 'inbound' as any,
        content,
        messageType: messageType as any,
        metadata: {
          whatsapp_message_id: key.id,
          instance,
          timestamp: data.messageTimestamp,
        } as any,
        isAi: false,
      } as any)
      .returning()

    // Check for confirmation/cancellation response first
    const confirmationResult = await processConfirmationResponse(clinicId, phone, content)

    if (confirmationResult.processed && confirmationResult.responseMessage) {
      await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          direction: 'outbound' as any,
          content: confirmationResult.responseMessage,
          messageType: 'text' as any,
          intent: confirmationResult.action === 'confirmed' ? 'confirmacao' : 'cancelamento',
          isAi: false,
        } as any)

      await sendWhatsAppMessage(phone, confirmationResult.responseMessage)
      lastResponseTime.set(phone, Date.now())
      return NextResponse.json({ success: true, processed: true, action: 'confirmation' })
    }

    // Check for waitlist confirmation
    const waitlistResult = await processWaitlistConfirmation(clinicId, phone, content)

    if (waitlistResult.processed && waitlistResult.responseMessage) {
      await db
        .insert(messages)
        .values({
          conversationId: conversation.id,
          direction: 'outbound' as any,
          content: waitlistResult.responseMessage,
          messageType: 'text' as any,
          intent: 'agendamento',
          isAi: false,
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
    if (savedMessages[0]) {
      await db
        .update(messages)
        .set({
          intent,
          entities: entities as any,
          confidence: confidence ? String(confidence) : null,
        } as any)
        .where(eq(messages.id, savedMessages[0].id))
    }

    // Check escalation
    const shouldEscalate = await llm.shouldEscalate(content, intent)

    if (shouldEscalate) {
      await db
        .update(conversations)
        .set({ status: 'escalated' } as any)
        .where(eq(conversations.id, conversation.id))

      await sendWhatsAppMessage(phone,
        'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.')

      return NextResponse.json({ success: true, processed: true, action: 'escalated' })
    }

    // Get conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(asc(messages.createdAt))
      .limit(10)

    const conversationHistory = history.map((msg) => ({
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
    await db
      .insert(messages)
      .values({
        conversationId: conversation.id,
        direction: 'outbound' as any,
        content: aiResponse,
        messageType: 'text' as any,
        intent,
        entities: entities as any,
        confidence: confidence ? String(confidence) : null,
        isAi: true,
      } as any)

    // Send response via WhatsApp
    const sendResult = await sendWhatsAppMessage(phone, aiResponse)
    whatsappLogger.info('WhatsApp send result', { phone, success: sendResult })

    // Mark rate limit for this number
    lastResponseTime.set(phone, Date.now())

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() } as any)
      .where(eq(conversations.id, conversation.id))

    return NextResponse.json({ success: true, processed: true, action: 'responded' })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Get clinic ID by Evolution instance name
 * Queries whatsapp_instances table to find the clinic associated with the instance
 */
async function getClinicByInstance(
  db: ReturnType<typeof getDb>,
  instanceName: string
): Promise<string | null> {
  // Try to find clinic by instance_name in whatsapp_instances
  const instanceRows = await db
    .select({ clinicId: whatsappInstances.clinicId })
    .from(whatsappInstances)
    .where(eq(whatsappInstances.evolutionInstanceName, instanceName))
    .limit(1)

  if (instanceRows[0]) {
    return instanceRows[0].clinicId
  }

  // Fallback: single-clinic MVP (log warning)
  whatsappLogger.warn('No clinic found for instance, using single-clinic fallback', { instanceName })
  const clinicRows = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.subscriptionStatus, 'active'))
    .limit(1)

  return clinicRows[0]?.id || null
}