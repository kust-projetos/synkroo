import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { eq, and, asc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, conversations, messages } from '@/lib/db/schema'
import { channelType, messageDirection, messageType } from '@/lib/db/schema/enums'
import { getLLMProvider } from '@/lib/llm'
import { handleApiError } from '@/lib/errors'
import { whatsappLogger } from '@/lib/logger'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit'
import {
  processConfirmationResponse,
  processWaitlistConfirmation,
} from '@/services/appointments/confirmation-handler.service'

/**
 * WhatsApp Business API Webhook
 *
 * Handles:
 * 1. Webhook verification (GET) - Meta challenge
 * 2. Message reception (POST) - Inbound messages
 */

// Webhook verification token (configured in Meta Developer Portal)
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const APP_SECRET = process.env.WHATSAPP_APP_SECRET

/**
 * GET /api/whatsapp/webhook
 * Webhook verification endpoint for Meta
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Verify the webhook
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.warn('✅ WhatsApp webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('❌ WhatsApp webhook verification failed')
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST /api/whatsapp/webhook
 * Receive messages from WhatsApp Business API
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.webhook,
      keyPrefix: 'wa-webhook',
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfter),
            ...createRateLimitHeaders(rateLimit.remaining, rateLimit.resetTime, rateLimitPresets.webhook.maxRequests),
          },
        }
      )
    }

    // Verify X-Hub-Signature-256 for security
    const signature = request.headers.get('x-hub-signature-256')
    const body = await request.text()

    if (!verifySignature(body, signature)) {
      console.error('❌ Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const payload = JSON.parse(body)

    // Handle different webhook events
    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' })
    }

    const entries = payload.entry || []
    const db = getDb()
    const processedMessages: Array<{ from: string; message: string }> = []

    for (const entry of entries) {
      const changes = entry.changes || []

      for (const change of changes) {
        const value = change.value

        // Handle incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            const from = msg.from // Phone number
            const msgId = msg.id
            const timestamp = msg.timestamp
            const type = msg.type

            // Extract message content based on type
            let content = ''
            let msgMessageType: typeof messageType.enumName = 'text'

            if (type === 'text' && msg.text) {
              content = msg.text.body
            } else if (type === 'image' && msg.image) {
              content = msg.image.caption || '[Image]'
              msgMessageType = 'image'
            } else if (type === 'audio' && msg.audio) {
              content = '[Audio message]'
              msgMessageType = 'audio'
            } else if (type === 'document' && msg.document) {
              content = msg.document.caption || '[Document]'
              msgMessageType = 'document'
            } else {
              // Skip unsupported message types
              continue
            }

            // Get metadata to identify clinic
            const phoneNumberId = value.metadata?.phone_number_id
            const clinicId = await getClinicIdByPhoneNumber(db, phoneNumberId)

            if (!clinicId) {
              console.error(`Clinic not found for phone number ID: ${phoneNumberId}`)
              continue
            }

            // Get or create conversation
            const existingConvs = await db
              .select()
              .from(conversations)
              .where(and(
                eq(conversations.clinicId, clinicId),
                eq(conversations.channel, 'whatsapp' as any),
                eq(conversations.externalId, from)
              ))
              .limit(1)

            let conversation = existingConvs[0] || null

            if (!conversation) {
              const newConvs = await db
                .insert(conversations)
                .values({
                  clinicId,
                  channel: 'whatsapp' as any,
                  externalId: from,
                  status: 'active',
                } as any)
                .returning()
              conversation = newConvs[0] || null
            }

            if (!conversation) {
              console.error('Failed to create conversation')
              continue
            }

            // Store inbound message
            const savedMessages = await db
              .insert(messages)
              .values({
                conversationId: conversation.id,
                direction: 'inbound' as any,
                content,
                messageType: msgMessageType as any,
                metadata: {
                  whatsapp_message_id: msgId,
                  timestamp,
                  phone_number_id: phoneNumberId,
                },
                isAi: false,
              } as any)
              .returning()

            // Check for confirmation/cancellation response first
            const confirmationResult = await processConfirmationResponse(
              clinicId,
              from,
              content
            )

            if (confirmationResult.processed && confirmationResult.responseMessage) {
              // Store confirmation response
              await db
                .insert(messages)
                .values({
                  conversationId: conversation.id,
                  direction: 'outbound' as any,
                  content: confirmationResult.responseMessage,
                  messageType: 'text',
                  intent: confirmationResult.action === 'confirmed' ? 'confirmacao' : 'cancelamento',
                  isAi: false,
                } as any)

              // Send confirmation response
              await sendWhatsAppMessage(phoneNumberId, from, confirmationResult.responseMessage)

              processedMessages.push({ from, message: content })
              continue // Skip AI processing for confirmation messages
            }

            // Check for waitlist confirmation
            const waitlistResult = await processWaitlistConfirmation(
              clinicId,
              from,
              content
            )

            if (waitlistResult.processed && waitlistResult.responseMessage) {
              // Store waitlist confirmation response
              await db
                .insert(messages)
                .values({
                  conversationId: conversation.id,
                  direction: 'outbound' as any,
                  content: waitlistResult.responseMessage,
                  messageType: 'text',
                  intent: 'agendamento',
                  isAi: false,
                } as any)

              // Send response
              await sendWhatsAppMessage(phoneNumberId, from, waitlistResult.responseMessage)

              processedMessages.push({ from, message: content })
              continue
            }

            // Process message with AI
            const llm = getLLMProvider()
            const { intent, confidence, entities } = await llm.classifyIntent(content)
            const extractedEntities = await llm.extractEntities(content)

            // Update message with intent and entities
            if (savedMessages[0]) {
              await db
                .update(messages)
                .set({
                  intent,
                  entities: { ...entities, ...extractedEntities },
                  confidence: confidence ? String(confidence) : null,
                } as any)
                .where(eq(messages.id, savedMessages[0].id))
            }

            // Check if escalation needed
            const shouldEscalate = await llm.shouldEscalate(content, intent)

            if (shouldEscalate) {
              await db
                .update(conversations)
                .set({ status: 'escalated' } as any)
                .where(eq(conversations.id, conversation.id))

              // Send escalation message
              await sendWhatsAppMessage(phoneNumberId, from,
                'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.')
            } else {
              // Get conversation history for context
              const history = await db
                .select()
                .from(messages)
                .where(eq(messages.conversationId, conversation.id))
                .orderBy(asc(messages.createdAt))
                .limit(10)

              const conversationHistory = history.map((msg) => ({
                role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
                content: msg.content,
              }))

              // Generate AI response
              const aiResponse = await llm.generateResponse(content, {
                intent,
                entities: extractedEntities,
                conversationHistory,
              })

              // Store AI response
              await db
                .insert(messages)
                .values({
                  conversationId: conversation.id,
                  direction: 'outbound' as any,
                  content: aiResponse,
                  messageType: 'text',
                  intent,
                  entities: extractedEntities,
                  confidence: confidence ? String(confidence) : null,
                  isAi: true,
                } as any)

              // Send response via WhatsApp
              await sendWhatsAppMessage(phoneNumberId, from, aiResponse)

              // Update conversation
              await db
                .update(conversations)
                .set({ lastMessageAt: new Date() } as any)
                .where(eq(conversations.id, conversation.id))
            }

            processedMessages.push({ from, message: content })
          }
        }

        // Handle message status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            const msgId = status.id
            const statusType = status.status
            const statusTimestamp = status.timestamp

            // Update message status in database
            await updateMessageStatusByWhatsappId(db, msgId, statusType, statusTimestamp)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedMessages.length,
      messages: processedMessages,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Verify webhook signature (fail-closed)
 */
function verifySignature(body: string, signature: string | null): boolean {
  if (!VERIFY_TOKEN || !APP_SECRET) {
    // Fail closed: no token/secret = no access
    if (process.env.NODE_ENV !== 'development') return false
    // In dev mode, skip verification but warn
    whatsappLogger.warn('Webhook signature verification skipped - no APP_SECRET configured')
    return true
  }

  if (!signature) return false

  const expectedSignature = 'sha256=' +
    createHmac('sha256', APP_SECRET).update(body).digest('hex')

  return signature === expectedSignature
}

/**
 * Get clinic ID by WhatsApp phone number ID
 */
async function getClinicIdByPhoneNumber(
  db: ReturnType<typeof getDb>,
  phoneNumberId: string | undefined
): Promise<string | null> {
  if (!phoneNumberId) return null

  // Query clinics where settings->'whatsapp_phone_number_id' = phoneNumberId
  // Use raw SQL for JSONB contains query
  const clinicResult = await db.execute(
    sql`SELECT id FROM clinics WHERE settings->>'whatsapp_phone_number_id' = ${phoneNumberId} LIMIT 1`
  )

  const rows = clinicResult.rows as Array<{ id: string }>
  return rows[0]?.id || null
}

/**
 * Send message via WhatsApp Business API
 */
async function sendWhatsAppMessage(
  phoneNumberId: string,
  to: string,
  message: string
): Promise<boolean> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const apiUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('WhatsApp send error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error)
    return false
  }
}

/**
 * Update message status in database by WhatsApp message ID
 */
async function updateMessageStatusByWhatsappId(
  db: ReturnType<typeof getDb>,
  whatsappMessageId: string,
  status: string,
  timestamp: string
): Promise<void> {
  const statusMap: Record<string, string> = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  }

  await db
    .update(messages)
    .set({
      metadata: {
        delivery_status: statusMap[status] || status,
        status_updated_at: new Date(parseInt(timestamp) * 1000).toISOString(),
      },
    } as any)
    .where(eq(messages.id, whatsappMessageId))
}