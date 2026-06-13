import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { eq, and, asc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, conversations, messages } from '@/lib/db/schema'
import { channelType, messageDirection, messageType } from '@/lib/db/schema/enums'
import { getLLMProvider } from '@/lib/llm'
import { handleApiError } from '@/lib/errors'
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitPresets,
  createRateLimitHeaders,
} from '@/lib/rate-limit'

/**
 * Instagram Graph API Webhook
 *
 * Handles:
 * 1. Webhook verification (GET) - Meta challenge
 * 2. DM reception (POST) - Inbound messages
 */

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN
const INSTAGRAM_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN || ''
const INSTAGRAM_ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID || ''
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET || ''

/**
 * GET /api/instagram/webhook
 * Webhook verification endpoint for Meta
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('❌ Instagram webhook verification failed')
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST /api/instagram/webhook
 * Receive messages from Instagram Graph API
 */
export async function POST(request: NextRequest) {
  try {
    // Verify X-Hub-Signature-256 for security
    const signature = request.headers.get('x-hub-signature-256')
    const body = await request.text()

    if (!verifyInstagramSignature(body, signature)) {
      console.error('❌ Invalid Instagram webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }

    const payload = JSON.parse(body)

    // Rate limiting check
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.webhook,
      keyPrefix: 'ig-webhook',
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

    if (payload.object !== 'instagram') {
      return NextResponse.json({ status: 'ignored' })
    }

    const entries = payload.entry || []
    const db = getDb()
    const processedMessages: Array<{ from: string; message: string }> = []

    for (const entry of entries) {
      // Handle messaging events (DMs)
      const messaging = entry.messaging || []

      for (const event of messaging) {
        const senderId = event.sender?.id
        const recipientId = event.recipient?.id
        const timestamp = event.timestamp
        const message = event.message

        if (!senderId || !message) continue

        // Check if within 24h window
        const messageTime = new Date(parseInt(timestamp))
        const now = new Date()
        const hoursSinceMessage = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60)

        if (hoursSinceMessage > 24) {
          console.warn('⏰ Message outside 24h window, skipping')
          continue
        }

        // Get message content
        let content = ''
        let msgMessageType: typeof messageType.enumName = 'text'

        if (message.text) {
          content = message.text
        } else if (message.attachments) {
          const attachment = message.attachments[0]
          if (attachment.type === 'image') {
            content = '[Image]'
            msgMessageType = 'image'
          } else if (attachment.type === 'audio') {
            content = '[Audio]'
            msgMessageType = 'audio'
          } else if (attachment.type === 'video') {
            content = '[Video]'
          } else {
            content = '[Attachment]'
          }
        } else {
          continue
        }

        // Get clinic ID from Instagram account
        const clinicId = await getClinicIdByInstagramAccount(db, recipientId)

        if (!clinicId) {
          console.error(`Clinic not found for Instagram account: ${recipientId}`)
          continue
        }

        // Get or create conversation
        const existingConvs = await db
          .select()
          .from(conversations)
          .where(and(
            eq(conversations.clinicId, clinicId),
            eq(conversations.channel, 'instagram' as any),
            eq(conversations.externalId, senderId)
          ))
          .limit(1)

        let conversation = existingConvs[0] || null

        if (!conversation) {
          const newConvs = await db
            .insert(conversations)
            .values({
              clinicId,
              channel: 'instagram' as any,
              externalId: senderId,
              status: 'active',
            } as any)
            .returning()
          conversation = newConvs[0] || null
        }

        if (!conversation) {
          console.error('Failed to create or find conversation')
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
              instagram_message_id: message.mid,
              instagram_sender_id: senderId,
              timestamp,
            },
            isAi: false,
          } as any)
          .returning()

        if (!savedMessages[0]) {
          console.error('Failed to save message')
          continue
        }

        // Process message with AI
        const llm = getLLMProvider()
        const { intent, confidence, entities } = await llm.classifyIntent(content)
        const extractedEntities = await llm.extractEntities(content)

        // Update message with intent and entities
        await db
          .update(messages)
          .set({
            intent,
            entities: { ...entities, ...extractedEntities },
            confidence: confidence ? String(confidence) : null,
          } as any)
          .where(eq(messages.id, savedMessages[0].id))

        // Check if escalation needed
        const shouldEscalate = await llm.shouldEscalate(content, intent)

        if (shouldEscalate) {
          await db
            .update(conversations)
            .set({ status: 'escalated' } as any)
            .where(eq(conversations.id, conversation.id))

          await sendInstagramMessage(recipientId, senderId,
            'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.')
        } else {
          // Get conversation history
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

          // Send response via Instagram
          await sendInstagramMessage(recipientId, senderId, aiResponse)

          // Update conversation
          await db
            .update(conversations)
            .set({ lastMessageAt: new Date() } as any)
            .where(eq(conversations.id, conversation.id))
        }

        processedMessages.push({ from: senderId, message: content })
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
 * Get clinic ID by Instagram account ID
 */
async function getClinicIdByInstagramAccount(
  db: ReturnType<typeof getDb>,
  instagramAccountId: string | undefined
): Promise<string | null> {
  if (!instagramAccountId) return null

  // Use raw SQL for JSONB contains query
  const clinicResult = await db.execute(
    sql`SELECT id FROM clinics WHERE settings->>'instagram_account_id' = ${instagramAccountId} LIMIT 1`
  )

  const rows = clinicResult.rows as Array<{ id: string }>
  return rows[0]?.id || null
}

/**
 * Send message via Instagram Graph API
 */
async function sendInstagramMessage(
  accountId: string,
  to: string,
  message: string
): Promise<boolean> {
  const apiUrl = `https://graph.facebook.com/v18.0/${accountId}/messages`

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: {
          id: to,
        },
        message: {
          text: message,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Instagram send error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to send Instagram message:', error)
    return false
  }
}

/**
 * Verify Instagram webhook signature (fail-closed)
 */
function verifyInstagramSignature(body: string, signature: string | null): boolean {
  if (!VERIFY_TOKEN || !APP_SECRET) {
    // Fail closed in production
    if (process.env.NODE_ENV !== 'development') return false
    console.warn('[IG] Webhook signature verification skipped - no APP_SECRET configured')
    return true
  }

  if (!signature) return false

  const expectedSignature = 'sha256=' +
    createHmac('sha256', APP_SECRET).update(body).digest('hex')

  return signature === expectedSignature
}