import { NextRequest, NextResponse } from 'next/server'
import { eq, and, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, whatsappInstances, conversations, messages, appointments } from '@/lib/db/schema'
import { handleApiError } from '@/lib/errors'
import { whatsappLogger } from '@/lib/logger'
import { sendWhatsAppMessage } from '@/services/whatsapp'
import { captureLeadFromWhatsApp } from '@/services/leads/leads.service'
import {
  processConfirmationResponse,
  processWaitlistConfirmation,
} from '@/services/appointments/confirmation-handler.service'

/**
 * Evolution API Webhook
 *
 * Legacy agent removed — AI processing disabled.
 * TODO(W5.3): reconnect to new agent.
 *
 * Handles incoming WhatsApp messages via Evolution API.
 * Interactive button responses (confirm/cancel) are preserved — no LLM needed.
 */

// Deduplication: track processed message IDs (in-memory, resets on server restart)
const processedMessageIds = new Map<string, number>()
const DEDUP_TTL_MS = 5 * 60 * 1000 // 5 min TTL for dedup cache

// Rate limiting: 1 response per number per 30 seconds
const lastResponseTime = new Map<string, number>()
const RATE_LIMIT_MS = 30_000

/**
 * POST /api/whatsapp/evolution/webhook
 * Receives events from Evolution API.
 * AI response disabled — legacy agent removed.
 * TODO(W5.3): reconnect to new agent.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event, instance, data } = body

    whatsappLogger.info('[evolution/webhook] Event received', { event, instance })

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

      // Process interactive button response (confirm/cancel appointment) — no LLM needed
      const selectedButtonId = data.message.buttonsResponseMessage.selectedId as string
      if (selectedButtonId && (selectedButtonId.startsWith('confirm_') || selectedButtonId.startsWith('cancel_'))) {
        const action = selectedButtonId.startsWith('confirm_') ? 'confirm' : 'cancel'
        const appointmentId = selectedButtonId.split('_').slice(1).join('_')

        whatsappLogger.info('[evolution/webhook] Button response', { phone, action, appointmentId })

        const db = getDb()
        const clinicIdForButton = await getClinicByInstance(db, instance || 'synkroo')

        if (clinicIdForButton) {
          const appointmentRows = await db
            .select({ id: appointments.id })
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

    whatsappLogger.info('[evolution/webhook] Message received', { phone, content: content.substring(0, 50) })

    // Deduplicate: skip if we already processed this message ID
    const messageId = key.id as string
    if (messageId) {
      const now = Date.now()
      const lastProcessed = processedMessageIds.get(messageId)
      if (lastProcessed && (now - lastProcessed) < DEDUP_TTL_MS) {
        whatsappLogger.info('[evolution/webhook] Duplicate ignored', { messageId })
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
      whatsappLogger.info('[evolution/webhook] Rate limited', { phone })
      return NextResponse.json({ status: 'ignored', reason: 'Rate limited' })
    }

    const db = getDb()

    // Find clinic by instance name
    const clinicId = await getClinicByInstance(db, instance || 'synkroo')

    if (!clinicId) {
      whatsappLogger.warn('[evolution/webhook] No clinic for instance', { instance })
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
    await db
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

    // Check for confirmation/cancellation response first (no LLM needed)
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

    // Check for waitlist confirmation (no LLM needed)
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

    // Capture lead from WhatsApp message (no LLM needed)
    try {
      const leadCaptureResult = await captureLeadFromWhatsApp(phone, content, clinicId)
      if (leadCaptureResult.created) {
        whatsappLogger.info('[evolution/webhook] Lead created', {
          leadId: leadCaptureResult.leadId,
          score: leadCaptureResult.score,
          phone,
        })
      }
    } catch (leadError) {
      whatsappLogger.warn('[evolution/webhook] Lead capture failed (non-fatal)', { error: String(leadError) })
    }

    // AI response disabled — legacy agent removed
    // TODO(W5.3): reconnect to new agent
    whatsappLogger.info('[evolution/webhook] Message stored (AI disabled)', {
      phone,
      reason: 'legacy_agent_removed',
    })

    // Update conversation timestamp
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date() } as any)
      .where(eq(conversations.id, conversation.id))

    return NextResponse.json({
      success: true,
      processed: true,
      action: 'stored_only',
      ai_enabled: false,
      reason: 'legacy_agent_removed',
      todo: 'TODO(W5.3): reconnect to new agent',
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Get clinic ID by Evolution instance name
 */
async function getClinicByInstance(
  db: ReturnType<typeof getDb>,
  instanceName: string
): Promise<string | null> {
  const instanceRows = await db
    .select({ clinicId: whatsappInstances.clinicId })
    .from(whatsappInstances)
    .where(eq(whatsappInstances.evolutionInstanceName, instanceName))
    .limit(1)

  if (instanceRows[0]) {
    return instanceRows[0].clinicId
  }

  // Fallback: single-clinic MVP
  whatsappLogger.warn('[evolution/webhook] No clinic for instance, using active fallback', { instanceName })
  const clinicRows = await db
    .select({ id: clinics.id })
    .from(clinics)
    .where(eq(clinics.subscriptionStatus, 'active'))
    .limit(1)

  return clinicRows[0]?.id || null
}
