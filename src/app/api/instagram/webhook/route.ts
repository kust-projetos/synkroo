import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { eq, and, asc, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, conversations, messages } from '@/lib/db/schema'
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
 * Legacy agent removed — AI processing disabled.
 * TODO(W5.3): reconnect to new agent.
 *
 * Handles:
 * 1. Webhook verification (GET) - Meta challenge
 * 2. DM reception (POST) - inbound messages stored
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

  console.error('[instagram/webhook] ❌ Verification failed')
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

/**
 * POST /api/instagram/webhook
 * Receive messages from Instagram Graph API.
 * AI response disabled — legacy agent removed.
 * TODO(W5.3): reconnect to new agent.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify X-Hub-Signature-256 for security
    const signature = request.headers.get('x-hub-signature-256')
    const body = await request.text()

    if (!verifyInstagramSignature(body, signature)) {
      console.error('[instagram/webhook] ❌ Invalid signature')
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
          console.warn('[instagram/webhook] ⏰ Message outside 24h window, skipping')
          continue
        }

        // Get message content
        let content = ''
        let msgMessageType: 'text' | 'image' | 'audio' = 'text'

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
          console.error(`[instagram/webhook] Clinic not found for Instagram account: ${recipientId}`)
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
          console.error('[instagram/webhook] Failed to create conversation')
          continue
        }

        // Store inbound message
        await db
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

        // AI response disabled — legacy agent removed
        // TODO(W5.3): reconnect to new agent
        console.warn('[instagram/webhook] Message stored (AI disabled)', {
          from: senderId,
          reason: 'legacy_agent_removed',
        })

        // Update conversation
        await db
          .update(conversations)
          .set({ lastMessageAt: new Date() } as any)
          .where(eq(conversations.id, conversation.id))

        processedMessages.push({ from: senderId, message: content })
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedMessages.length,
      messages: processedMessages,
      ai_enabled: false,
      reason: 'legacy_agent_removed',
      todo: 'TODO(W5.3): reconnect to new agent',
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
        recipient: { id: to },
        message: { text: message },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[instagram/webhook] Send error:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('[instagram/webhook] Failed to send:', error)
    return false
  }
}

/**
 * Verify Instagram webhook signature (fail-closed)
 */
function verifyInstagramSignature(body: string, signature: string | null): boolean {
  if (!VERIFY_TOKEN || !APP_SECRET) {
    if (process.env.NODE_ENV !== 'development') return false
    console.warn('[instagram/webhook] Signature verification skipped — no APP_SECRET configured')
    return true
  }

  if (!signature) return false

  const expectedSignature = 'sha256=' +
    createHmac('sha256', APP_SECRET).update(body).digest('hex')

  return signature === expectedSignature
}
