/**
 * WhatsApp Web Service using Playwright
 * Provides automated WhatsApp messaging via browser automation
 */
/* eslint-disable no-console */

import { chromium, Browser, Page, BrowserContext } from 'playwright'
import QRCode from 'qrcode-terminal'
import { EventEmitter } from 'events'

export interface WhatsAppMessage {
  id: string
  from: string
  to: string
  body: string
  timestamp: Date
  type: 'text' | 'image' | 'audio' | 'document'
  isFromMe: boolean
}

export interface WhatsAppSession {
  isConnected: boolean
  phoneNumber: string | null
  lastActivity: Date | null
}

export class WhatsAppService extends EventEmitter {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private page: Page | null = null
  private _isConnected: boolean = false
  private sessionPath: string
  private messageQueue: WhatsAppMessage[] = []
  private currentQRCode: string | null = null
  private phoneNumber: string | null = null

  constructor(sessionPath: string = './.whatsapp-session') {
    super()
    this.sessionPath = sessionPath
  }

  get isConnected(): boolean {
    return this._isConnected
  }

  /**
   * Initialize WhatsApp Web and wait for QR code scan
   */
  async initialize(): Promise<void> {
    const headless = process.env.WHATSAPP_HEADLESS === 'true'

    // Launch browser with persistent context
    this.context = await chromium.launchPersistentContext(this.sessionPath, {
      headless,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    })

    this.page = await this.context.newPage()

    // Navigate to WhatsApp Web
    await this.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle' })

    // Check if already logged in
    const isLoggedIn = await this.checkLoginStatus()

    if (!isLoggedIn) {
      // Wait for QR code and display it
      await this.waitForQRCode()
    } else {
      this._isConnected = true
      this.emit('connected')
      console.log('✅ WhatsApp already connected')
    }

    // Start message listener
    this.startMessageListener()
  }

  /**
   * Check if user is logged in
   */
  private async checkLoginStatus(): Promise<boolean> {
    if (!this.page) return false

    try {
      // Check for chat list (indicates logged in)
      const chatList = await this.page.$('[data-testid="chat-list"]')
      return chatList !== null
    } catch {
      return false
    }
  }

  /**
   * Wait for QR code scan
   */
  private async waitForQRCode(): Promise<void> {
    if (!this.page) return

    console.log('📱 Waiting for QR code scan...')

    // Wait for QR code element
    await this.page.waitForSelector('canvas[alt="Scan this QR code to link a device!"]', {
      timeout: 30000,
    })

    // Get QR code data URL
    const qrCanvas = await this.page.$('canvas[alt="Scan this QR code to link a device!"]')
    if (qrCanvas) {
      const qrDataUrl = await qrCanvas.evaluate((canvas: HTMLCanvasElement) => {
        return canvas.toDataURL()
      })

      // Display QR code in terminal
      QRCode.generate(qrDataUrl, { small: true }, (qr) => {
        console.log('\n📱 Scan this QR code with your WhatsApp app:\n')
        console.log(qr)
      })

      // Store QR code for API access
      this.currentQRCode = qrDataUrl

      // Also emit for UI
      this.emit('qrcode', qrDataUrl)
    }

    // Wait for connection (chat list appears)
    try {
      await this.page.waitForSelector('[data-testid="chat-list"]', { timeout: 120000 })
      this._isConnected = true
      this.currentQRCode = null // Clear QR code after successful connection

      // Extract phone number from profile
      await this.extractPhoneNumber()

      this.emit('connected')
      console.log('✅ WhatsApp connected successfully!')
    } catch (error) {
      this.emit('error', new Error('QR code scan timeout'))
      throw new Error('Timeout waiting for QR code scan')
    }
  }

  /**
   * Start listening for incoming messages
   */
  private startMessageListener(): void {
    if (!this.page) return

    // Poll for new messages
    setInterval(async () => {
      if (!this.page || !this._isConnected) return

      try {
        // Check for unread messages
        const unreadChats = await this.page.$$('[data-testid="chat-list"] [aria-label*="unread"]')

        for (const chat of unreadChats) {
          // Click on chat to read
          await chat.click()

          // Wait for messages to load
          await this.page.waitForTimeout(500)

          // Get latest messages
          const messages = await this.page.$$eval(
            '[data-testid="msg-container"]',
            (elements) => {
              return elements.slice(-5).map((el) => ({
                id: el.getAttribute('data-id') || '',
                body: el.textContent || '',
                isFromMe: el.closest('[data-testid="msg-container"]')?.classList.contains('message-out') || false,
              }))
            }
          )

          // Emit new messages
          for (const msg of messages) {
            if (!msg.isFromMe) {
              this.emit('message', {
                id: msg.id,
                from: await this.getCurrentChatPhone(),
                to: 'me',
                body: msg.body,
                timestamp: new Date(),
                type: 'text',
                isFromMe: false,
              } as WhatsAppMessage)
            }
          }
        }
      } catch (error) {
        console.error('Error checking messages:', error)
      }
    }, 5000)
  }

  /**
   * Get phone number from current chat
   */
  private async getCurrentChatPhone(): Promise<string> {
    if (!this.page) return ''

    try {
      const phoneElement = await this.page.$('[data-testid="header"] span[title]')
      const title = await phoneElement?.getAttribute('title')
      return title || ''
    } catch {
      return ''
    }
  }

  /**
   * Send a message to a phone number
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.page || !this._isConnected) {
      return { success: false }
    }

    try {
      // Search for contact
      const searchInput = await this.page.$('[data-testid="chat-list-search"]')
      if (!searchInput) {
        throw new Error('Search input not found')
      }

      // Clear and type phone number
      await searchInput.fill(to)
      await this.page.waitForTimeout(1000)

      // Click on the contact
      const contactResult = await this.page.$(`[title="${to}"]`)
      if (!contactResult) {
        // Try to create new chat
        await this.page.keyboard.press('Enter')
        await this.page.waitForTimeout(500)
      } else {
        await contactResult.click()
      }

      // Wait for chat to open
      await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 5000 })

      // Type message
      const messageInput = await this.page.$('[data-testid="conversation-compose-box-input"]')
      if (!messageInput) {
        throw new Error('Message input not found')
      }

      await messageInput.fill(message)
      await this.page.waitForTimeout(300)

      // Send message
      await this.page.keyboard.press('Enter')

      return { success: true, messageId: Date.now().toString() }
    } catch (error) {
      console.error('Error sending message:', error)
      return { success: false }
    }
  }

  /**
   * Extract phone number from WhatsApp profile
   */
  private async extractPhoneNumber(): Promise<void> {
    if (!this.page) return

    try {
      // Click on profile menu
      const profileButton = await this.page.$('[data-testid="menu-bar"] button[aria-label]')
      if (profileButton) {
        await profileButton.click()
        await this.page.waitForTimeout(500)

        // Look for phone number in profile
        const phoneElement = await this.page.$('span[title*="+"]')
        if (phoneElement) {
          const title = await phoneElement.getAttribute('title')
          if (title) {
            // Extract phone number from title (format: "+55 11 99999-9999")
            this.phoneNumber = title.replace(/\s/g, '')
          }
        }

        // Close profile menu
        await this.page.keyboard.press('Escape')
      }
    } catch (error) {
      console.error('Error extracting phone number:', error)
      // Don't throw - phone number extraction is not critical
    }
  }

  /**
   * Get session status
   */
  getSession(): WhatsAppSession {
    return {
      isConnected: this._isConnected,
      phoneNumber: this.phoneNumber,
      lastActivity: new Date(),
    }
  }

  /**
   * Get current QR code (if available)
   */
  getQRCode(): string | null {
    return this.currentQRCode
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (this.context) {
      await this.context.close()
    }
    this._isConnected = false
    this.emit('disconnected')
  }
}

// Singleton instance
let whatsappInstance: WhatsAppService | null = null

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappInstance) {
    whatsappInstance = new WhatsAppService(process.env.WHATSAPP_SESSION_PATH)
  }
  return whatsappInstance
}