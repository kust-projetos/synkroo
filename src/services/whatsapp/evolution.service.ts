/**
 * Evolution API Service
 * WhatsApp integration via Evolution API (unofficial WhatsApp API)
 * Docs: https://doc.evolution-api.com/
 */

import { EventEmitter } from 'events'
import { dbLogger, whatsappLogger } from '@/lib/logger'

export interface EvolutionInstance {
  instance: {
    instanceName: string
    instanceId: string
    status: string
    serverUrl: string
    apikey: string
  }
  hash?: string
}

export interface EvolutionQRCode {
  code: string
  base64: string
}

export interface EvolutionMessage {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: {
    conversation?: string
    extendedTextMessage?: {
      text: string
      contextInfo?: {
        quotedMessage?: any
      }
    }
    imageMessage?: {
      url: string
      mimetype: string
      caption?: string
    }
  }
  messageTimestamp: number
  status: string
}

export interface EvolutionWebhookEvent {
  event: string
  instance: string
  data: any
}

export interface SendTextMessageInput {
  number: string
  options?: {
    delay?: number
    presence?: 'composing' | 'recording'
    linkPreview?: boolean
  }
}

export interface SendMediaMessageInput {
  number: string
  media: string // URL or base64
  mediatype: 'image' | 'video' | 'document' | 'audio'
  caption?: string
  fileName?: string
}

export class EvolutionApiService extends EventEmitter {
  private baseUrl: string
  private apiKey: string
  private instanceName: string
  private isConnected: boolean = false
  private instanceId: string | null = null

  constructor(baseUrl: string, apiKey: string, instanceName: string = 'synkroo') {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.instanceName = instanceName
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey,
    }
  }

  /**
   * Make API request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const url = `${this.baseUrl}${endpoint}`

      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      })

      const data = await response.json()

      if (!response.ok) {
        whatsappLogger.error('Evolution API error', null, {
          status: response.status,
          data
        })
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`
        }
      }

      return { success: true, data }
    } catch (error) {
      whatsappLogger.error('Evolution API request failed', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Create a new instance
   */
  async createInstance(): Promise<EvolutionInstance | null> {
    const result = await this.request<EvolutionInstance>('POST', '/instance/create', {
      instanceName: this.instanceName,
      qrcode: true,
      webhook: process.env.EVOLUTION_WEBHOOK_URL || undefined,
      webhook_by_events: true,
      events: [
        'APPLICATION_STARTUP',
        'QRCODE_UPDATED',
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'SEND_MESSAGE',
        'CONNECTION_UPDATE',
      ],
    })

    if (result.success && result.data) {
      this.instanceId = result.data.instance?.instanceId || null
      whatsappLogger.info('Evolution instance created', {
        instanceName: this.instanceName
      })
      return result.data
    }

    return null
  }

  /**
   * Connect to existing instance
   */
  async connect(): Promise<boolean> {
    // Check if instance exists
    const result = await this.request<{ instance: EvolutionInstance['instance'] }>(
      'GET',
      `/instance/fetchInstances?instanceName=${this.instanceName}`
    )

    if (result.success && result.data?.instance) {
      this.instanceId = result.data.instance.instanceId
      this.isConnected = result.data.instance.status === 'open'

      if (this.isConnected) {
        this.emit('connected')
        whatsappLogger.info('Evolution instance connected', {
          status: result.data.instance.status,
        })
      }

      return true
    }

    // Instance doesn't exist, create it
    const newInstance = await this.createInstance()
    return newInstance !== null
  }

  /**
   * Get connection state
   */
  async getConnectionState(): Promise<{
    state: string;
    statusReason?: number
  } | null> {
    const result = await this.request<{ instance: { state: string; statusReason?: number } }>(
      'GET',
      `/instance/connectionState/${this.instanceName}`
    )

    if (result.success && result.data) {
      this.isConnected = result.data.instance?.state === 'open'
      return result.data.instance
    }

    return null
  }

  /**
   * Get QR Code for connection
   */
  async getQRCode(): Promise<EvolutionQRCode | null> {
    const result = await this.request<{ code: string; base64: string }>(
      'GET',
      `/instance/qrcode/${this.instanceName}`
    )

    if (result.success && result.data) {
      this.emit('qrcode', result.data.base64)
      return {
        code: result.data.code,
        base64: result.data.base64,
      }
    }

    return null
  }

  /**
   * Logout from instance
   */
  async logout(): Promise<boolean> {
    const result = await this.request('DELETE', `/instance/logout/${this.instanceName}`)
    this.isConnected = false
    return result.success
  }

  /**
   * Delete instance
   */
  async deleteInstance(): Promise<boolean> {
    const result = await this.request('DELETE', `/instance/delete/${this.instanceName}`)
    this.instanceId = null
    this.isConnected = false
    return result.success
  }

  /**
   * Send text message
   */
  async sendTextMessage(
    number: string,
    text: string,
    options?: SendTextMessageInput['options']
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Format number (add 55 if needed, remove non-digits)
    let formattedNumber = number.replace(/\D/g, '')
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber
    }

    // Evolution API v2.3.7: "text" is a top-level field (not inside textMessage)
    const result = await this.request<{ key: { id: string } }>(
      'POST',
      `/message/sendText/${this.instanceName}`,
      {
        number: formattedNumber,
        text,
        options: options || {},
      }
    )

    if (result.success && result.data) {
      return {
        success: true,
        messageId: result.data.key?.id,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Send media message (image, video, document, audio)
   */
  async sendMediaMessage(
    input: SendMediaMessageInput
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let formattedNumber = input.number.replace(/\D/g, '')
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber
    }

    const result = await this.request<{ key: { id: string } }>(
      'POST',
      `/message/sendMedia/${this.instanceName}`,
      {
        number: formattedNumber,
        mediaMessage: {
          mediatype: input.mediatype,
          media: input.media,
          caption: input.caption,
          fileName: input.fileName,
        },
      }
    )

    if (result.success && result.data) {
      return {
        success: true,
        messageId: result.data.key?.id,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Send buttons/template message
   */
  async sendButtonsMessage(
    number: string,
    title: string,
    description: string,
    buttons: Array<{ buttonText: string; buttonId: string }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let formattedNumber = number.replace(/\D/g, '')
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber
    }

    const result = await this.request<{ key: { id: string } }>(
      'POST',
      `/message/sendButtons/${this.instanceName}`,
      {
        number: formattedNumber,
        buttonsMessage: {
          title,
          description,
          type: 'buttons',
          buttons: buttons.map((btn, index) => ({
            buttonId: btn.buttonId || `btn_${index}`,
            buttonText: { displayText: btn.buttonText },
            type: 1,
          })),
        },
      }
    )

    if (result.success && result.data) {
      return {
        success: true,
        messageId: result.data.key?.id,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Send template message (for starting conversations)
   */
  async sendTemplateMessage(
    number: string,
    templateName: string,
    language: string = 'pt_BR'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let formattedNumber = number.replace(/\D/g, '')
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber
    }

    const result = await this.request<{ key: { id: string } }>(
      'POST',
      `/message/sendTemplate/${this.instanceName}`,
      {
        number: formattedNumber,
        templateMessage: {
          name: templateName,
          language,
        },
      }
    )

    if (result.success && result.data) {
      return {
        success: true,
        messageId: result.data.key?.id,
      }
    }

    return {
      success: false,
      error: result.error,
    }
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string, remoteJid: string): Promise<boolean> {
    const result = await this.request(
      'POST',
      `/chat/markMessageAsRead/${this.instanceName}`,
      {
        readMessages: [
          {
            id: messageId,
            remoteJid,
            fromMe: false,
          },
        ],
      }
    )

    return result.success
  }

  /**
   * Get messages from chat
   */
  async getMessages(
    remoteJid: string,
    options?: {
      count?: number
      index?: number
      direction?: 'before' | 'after'
    }
  ): Promise<EvolutionMessage[]> {
    const result = await this.request<{ messages: EvolutionMessage[] }>(
      'POST',
      `/chat/findMessages/${this.instanceName}`,
      {
        where: {
          key: {
            remoteJid,
          },
        },
        limit: options?.count || 50,
      }
    )

    return result.success ? result.data?.messages || [] : []
  }

  /**
   * Get all chats
   */
  async getChats(): Promise<any[]> {
    const result = await this.request<any[]>('GET', `/chat/findChats/${this.instanceName}`)
    return result.success ? result.data || [] : []
  }

  /**
   * Check if a number exists on WhatsApp
   */
  async checkNumber(number: string): Promise<{ exists: boolean; jid?: string }> {
    let formattedNumber = number.replace(/\D/g, '')
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber
    }

    const result = await this.request<{ exists: boolean; jid: string }>(
      'POST',
      `/chat/whatsappNumbers/${this.instanceName}`,
      {
        numbers: [formattedNumber],
      }
    )

    if (result.success && result.data) {
      return {
        exists: result.data.exists ?? false,
        jid: result.data.jid,
      }
    }

    return { exists: false }
  }

  /**
   * Get profile picture
   */
  async getProfilePicture(number: string): Promise<string | null> {
    let formattedNumber = number.replace(/\D/g, '')
    if (!formattedNumber.startsWith('55')) {
      formattedNumber = '55' + formattedNumber
    }

    const result = await this.request<{ wuid: string; profilePicture: string }>(
      'POST',
      `/chat/fetchProfilePicture/${this.instanceName}`,
      {
        number: formattedNumber,
      }
    )

    return result.success ? result.data?.profilePicture || null : null
  }

  /**
   * Process webhook event
   */
  processWebhookEvent(event: EvolutionWebhookEvent): void {
    switch (event.event) {
      case 'CONNECTION_UPDATE':
        this.handleConnectionUpdate(event.data)
        break
      case 'QRCODE_UPDATED':
        this.handleQRCodeUpdate(event.data)
        break
      case 'MESSAGES_UPSERT':
        this.handleMessageUpsert(event.data)
        break
      case 'MESSAGES_UPDATE':
        this.handleMessageUpdate(event.data)
        break
      default:
        dbLogger.debug('Unhandled webhook event', { event: event.event })
    }
  }

  /**
   * Handle connection update event
   */
  private handleConnectionUpdate(data: any): void {
    const { state, statusReason } = data
    this.isConnected = state === 'open'

    if (this.isConnected) {
      this.emit('connected')
      whatsappLogger.info('WhatsApp connected via Evolution API')
    } else {
      this.emit('disconnected', { state, statusReason })
      whatsappLogger.warn('WhatsApp disconnected', { state, statusReason })
    }
  }

  /**
   * Handle QR code update event
   */
  private handleQRCodeUpdate(data: any): void {
    const { qrcode } = data
    if (qrcode) {
      this.emit('qrcode', qrcode)
      whatsappLogger.info('QR code received')
    }
  }

  /**
   * Handle message upsert event
   */
  private handleMessageUpsert(data: any): void {
    const { messages } = data

    if (messages && Array.isArray(messages)) {
      for (const msg of messages) {
        if (!msg.key.fromMe) {
          this.emit('message', {
            id: msg.key.id,
            from: msg.key.remoteJid,
            to: 'me',
            body: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
            timestamp: new Date(msg.messageTimestamp * 1000),
            type: msg.message?.imageMessage ? 'image' : 'text',
            isFromMe: false,
          })
        }
      }
    }
  }

  /**
   * Handle message update event
   */
  private handleMessageUpdate(data: any): void {
    const { key, status } = data
    this.emit('messageStatus', {
      messageId: key.id,
      status,
      timestamp: new Date(),
    })
  }

  /**
   * Get instance name
   */
  getInstanceName(): string {
    return this.instanceName
  }

  /**
   * Check if connected
   */
  getConnectionStatus(): boolean {
    return this.isConnected
  }
}

// Singleton instance
let evolutionInstance: EvolutionApiService | null = null

export function getEvolutionService(): EvolutionApiService | null {
  const baseUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'synkroo'

  if (!baseUrl || !apiKey) {
    return null
  }

  if (!evolutionInstance) {
    evolutionInstance = new EvolutionApiService(baseUrl, apiKey, instanceName)
  }

  return evolutionInstance
}