// WhatsApp Provider Types
export type WhatsAppProvider = 'evolution' | 'playwright' | 'business-api'

export interface WhatsAppConfig {
  provider: WhatsAppProvider
  evolution?: {
    baseUrl: string
    apiKey: string
    instanceName: string
  }
  businessApi?: {
    apiUrl: string
    token: string
  }
  playwright?: {
    sessionPath: string
    headless: boolean
  }
}

// Import services for local use
import { WhatsAppService, getWhatsAppService } from './whatsapp.service'
import { EvolutionApiService, getEvolutionService } from './evolution.service'

// Re-export services
export { WhatsAppService, getWhatsAppService } from './whatsapp.service'
export { EvolutionApiService, getEvolutionService } from './evolution.service'

// Re-export types
export type { WhatsAppMessage, WhatsAppSession } from './whatsapp.service'
export type { EvolutionMessage, EvolutionQRCode, EvolutionWebhookEvent } from './evolution.service'

/**
 * Detect which WhatsApp provider to use based on environment
 */
export function detectProvider(): WhatsAppProvider {
  // Priority: Evolution API > Business API > Playwright

  if (process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY) {
    return 'evolution'
  }

  if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_TOKEN) {
    return 'business-api'
  }

  return 'playwright'
}

/**
 * Get the active WhatsApp service instance
 */
export function getActiveService(): {
  provider: WhatsAppProvider
  evolution: ReturnType<typeof getEvolutionService>
  playwright: ReturnType<typeof getWhatsAppService>
} {
  const provider = detectProvider()

  return {
    provider,
    evolution: getEvolutionService(),
    playwright: getWhatsAppService(),
  }
}

/**
 * Send a WhatsApp message using the configured provider
 * Priority: Evolution API > Business API > Playwright
 */
export async function sendWhatsAppMessage(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const provider = detectProvider()

  // 1. Try Evolution API (recommended)
  if (provider === 'evolution') {
    const evolutionService = getEvolutionService()
    if (evolutionService) {
      const result = await evolutionService.sendTextMessage(phone, message)
      if (result.success) {
        return result
      }
      // Log error but try fallback
      console.warn('Evolution API failed, trying fallback:', result.error)
    }
  }

  // 2. Try WhatsApp Business API (official)
  const whatsappApiUrl = process.env.WHATSAPP_API_URL
  const whatsappToken = process.env.WHATSAPP_TOKEN

  if (whatsappApiUrl && whatsappToken) {
    try {
      let formattedPhone = phone.replace(/\D/g, '')
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone
      }

      const response = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'text',
          text: { body: message },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          messageId: data.messages?.[0]?.id,
        }
      }

      console.warn('Business API failed:', data.error?.message)
    } catch (error) {
      console.warn('Business API error:', error)
    }
  }

  // 3. Fallback to WhatsApp Web (Playwright)
  try {
    const { getWhatsAppService } = await import('./whatsapp.service')
    const service = getWhatsAppService()

    if (!service.isConnected) {
      return {
        success: false,
        error: 'WhatsApp not connected (no provider available)',
      }
    }

    return await service.sendMessage(phone, message)
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Send media message (image, video, document)
 */
export async function sendWhatsAppMedia(
  phone: string,
  mediaUrl: string,
  mediaType: 'image' | 'video' | 'document' | 'audio',
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const provider = detectProvider()

  // Evolution API
  if (provider === 'evolution') {
    const evolutionService = getEvolutionService()
    if (evolutionService) {
      return await evolutionService.sendMediaMessage({
        number: phone,
        media: mediaUrl,
        mediatype: mediaType,
        caption,
      })
    }
  }

  // Business API
  const whatsappApiUrl = process.env.WHATSAPP_API_URL
  const whatsappToken = process.env.WHATSAPP_TOKEN

  if (whatsappApiUrl && whatsappToken) {
    try {
      let formattedPhone = phone.replace(/\D/g, '')
      if (!formattedPhone.startsWith('55')) {
        formattedPhone = '55' + formattedPhone
      }

      const response = await fetch(whatsappApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: mediaType,
          [mediaType]: {
            link: mediaUrl,
            caption,
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        return {
          success: true,
          messageId: data.messages?.[0]?.id,
        }
      }
    } catch (error) {
      // Fall through to error
    }
  }

  return {
    success: false,
    error: 'Media sending not available with current provider',
  }
}

/**
 * Send buttons/interactive message
 */
export async function sendWhatsAppButtons(
  phone: string,
  title: string,
  description: string,
  buttons: Array<{ text: string; id: string }>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const evolutionService = getEvolutionService()

  if (evolutionService) {
    const mappedButtons = buttons.map((b) => ({
      buttonText: b.text,
      buttonId: b.id,
    }))
    return await evolutionService.sendButtonsMessage(phone, title, description, mappedButtons)
  }

  return {
    success: false,
    error: 'Interactive messages require Evolution API',
  }
}

/**
 * Check if a number exists on WhatsApp
 */
export async function checkWhatsAppNumber(
  phone: string
): Promise<{ exists: boolean; jid?: string }> {
  const evolutionService = getEvolutionService()

  if (evolutionService) {
    return await evolutionService.checkNumber(phone)
  }

  return { exists: false }
}

/**
 * Get connection status
 */
export function getConnectionStatus(): {
  provider: WhatsAppProvider
  connected: boolean
} {
  const provider = detectProvider()

  if (provider === 'evolution') {
    const service = getEvolutionService()
    return {
      provider,
      connected: service?.getConnectionStatus() ?? false,
    }
  }

  if (provider === 'playwright') {
    const service = getWhatsAppService()
    return {
      provider,
      connected: service.isConnected,
    }
  }

  return {
    provider: 'business-api',
    connected: true, // Assume connected if configured
  }
}