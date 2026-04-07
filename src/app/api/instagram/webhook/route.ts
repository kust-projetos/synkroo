import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createServerClient } from '@/lib/supabase'
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
    const serverClient = createServerClient()
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
        let messageType: 'text' | 'image' | 'audio' | 'document' = 'text'

        if (message.text) {
          content = message.text
        } else if (message.attachments) {
          const attachment = message.attachments[0]
          if (attachment.type === 'image') {
            content = '[Image]'
            messageType = 'image'
          } else if (attachment.type === 'audio') {
            content = '[Audio]'
            messageType = 'audio'
          } else if (attachment.type === 'video') {
            content = '[Video]'
          } else {
            content = '[Attachment]'
          }
        } else {
          continue
        }

        // Get clinic ID from Instagram account
        const clinicId = await getClinicIdByInstagramAccount(serverClient, recipientId)

        if (!clinicId) {
          console.error(`Clinic not found for Instagram account: ${recipientId}`)
          continue
        }

        // Get or create conversation
        let conversation: any = null
        const { data: existingConv } = await serverClient
          .from('conversations')
          .select('*')
          .eq('clinic_id', clinicId)
          .eq('channel', 'instagram')
          .eq('external_id', senderId)
          .single()
        conversation = existingConv

        if (!conversation) {
          const { data: newConv } = await serverClient
            .from('conversations')
            .insert({
              clinic_id: clinicId,
              channel: 'instagram',
              external_id: senderId,
              status: 'active',
            } as never)
            .select()
            .single()
          conversation = newConv
        }

        if (!conversation) {
          console.error('Failed to create or find conversation')
          continue
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
              instagram_message_id: message.mid,
              instagram_sender_id: senderId,
              timestamp,
            },
            is_ai: false,
          } as never)
          .select()
          .single()

        if (!savedMessage) {
          console.error('Failed to save message')
          continue
        }

        // Process message with AI
        const llm = getLLMProvider()
        const { intent, confidence, entities } = await llm.classifyIntent(content)
        const extractedEntities = await llm.extractEntities(content)

        // Update message with intent and entities
        await serverClient
          .from('messages')
          .update({
            intent,
            entities: { ...entities, ...extractedEntities },
            confidence,
          } as never)
          .eq('id', (savedMessage as any).id)

        // Check if escalation needed
        const shouldEscalate = await llm.shouldEscalate(content, intent)

        if (shouldEscalate) {
          await serverClient
            .from('conversations')
            .update({ status: 'escalated' } as never)
            .eq('id', conversation.id)

          await sendInstagramMessage(recipientId, senderId,
            'Entendi! Vou transferir você para um atendente humano. Aguarde um momento, por favor.')
        } else {
          // Get conversation history
          const { data: history } = await serverClient
            .from('messages')
            .select('*')
            .eq('conversation_id', conversation.id)
            .order('created_at', { ascending: true })
            .limit(10)

          const conversationHistory = (history || []).map((msg: any) => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.content,
          })) as Array<{ role: 'user' | 'assistant'; content: string }>

          // Generate AI response
          const aiResponse = await llm.generateResponse(content, {
            intent,
            entities: extractedEntities,
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
              entities: extractedEntities,
              confidence,
              is_ai: true,
            } as never)

          // Send response via Instagram
          await sendInstagramMessage(recipientId, senderId, aiResponse)

          // Update conversation
          await serverClient
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() } as never)
            .eq('id', conversation.id)
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
  client: ReturnType<typeof createServerClient>,
  instagramAccountId: string | undefined
): Promise<string | null> {
  if (!instagramAccountId) return null

  const { data } = await client
    .from('clinics')
    .select('id')
    .contains('settings', { instagram_account_id: instagramAccountId })
    .single()

  return (data as any)?.id || null
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