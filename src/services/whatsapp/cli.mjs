/**
 * CLI for WhatsApp Service (ESM)
 * Run with: node src/services/whatsapp/cli.mjs
 */
/* eslint-disable no-console */

import { chromium } from 'playwright'
import QRCode from 'qrcode-terminal'
import { EventEmitter } from 'events'

class WhatsAppService extends EventEmitter {
  constructor(sessionPath = './.whatsapp-session') {
    super()
    this.sessionPath = sessionPath
    this.browser = null
    this.context = null
    this.page = null
    this.isConnected = false
  }

  async initialize() {
    const headless = process.env.WHATSAPP_HEADLESS === 'true'

    console.log('🚀 Launching browser...')

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

    const pages = this.context.pages()
    this.page = pages.length > 0 ? pages[0] : await this.context.newPage()

    console.log('📱 Navigating to WhatsApp Web...')
    await this.page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle' })

    // Check if already logged in
    const chatList = await this.page.$('[data-testid="chat-list"]')

    if (chatList) {
      this.isConnected = true
      console.log('✅ WhatsApp already connected!')
      this.emit('connected')
    } else {
      await this.waitForQRCode()
    }

    this.startMessageListener()
  }

  async waitForQRCode() {
    console.log('📱 Waiting for QR code...')

    try {
      await this.page.waitForSelector('canvas', { timeout: 30000 })

      const qrCanvas = await this.page.$('canvas')
      if (qrCanvas) {
        // Get QR code as base64
        const qrDataUrl = await qrCanvas.evaluate((canvas) => {
          return canvas.toDataURL()
        })

        // Save QR code to file
        const fs = await import('fs')
        const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, '')
        fs.writeFileSync('whatsapp-qr.png', base64Data, 'base64')

        console.log('\n📱 QR Code saved to whatsapp-qr.png')
        console.log('📂 Open this file to scan with your WhatsApp app!')
        console.log('⏳ Waiting for you to scan...\n')

        this.emit('qrcode', qrDataUrl)
      }

      // Wait for chat list (indicates successful login)
      console.log('⏳ Waiting for connection...')
      await this.page.waitForSelector('[data-testid="chat-list"]', { timeout: 180000 })
      this.isConnected = true
      this.emit('connected')
      console.log('✅ WhatsApp connected successfully!')
    } catch (error) {
      this.emit('error', error)
      throw new Error('Timeout waiting for QR code scan (3 minutes)')
    }
  }

  startMessageListener() {
    console.log('👂 Listening for messages...')

    setInterval(async () => {
      if (!this.page || !this.isConnected) return

      try {
        // Check for unread indicators
        const unreadChats = await this.page.$$('[data-testid="chat-list"] [aria-label*="unread"]')

        for (const chat of unreadChats) {
          console.log('📨 New message detected!')
          this.emit('message', { timestamp: new Date() })
        }
      } catch (error) {
        // Ignore polling errors
      }
    }, 3000)
  }

  async sendMessage(to, message) {
    if (!this.page || !this.isConnected) {
      return { success: false, error: 'Not connected' }
    }

    try {
      // Search for contact
      const searchInput = await this.page.$('[data-testid="chat-list-search"]')
      if (!searchInput) {
        throw new Error('Search input not found')
      }

      await searchInput.fill(to)
      await this.page.waitForTimeout(1000)

      // Click on contact or create new chat
      await this.page.keyboard.press('Enter')
      await this.page.waitForTimeout(500)

      // Wait for chat input
      await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 5000 })

      const messageInput = await this.page.$('[data-testid="conversation-compose-box-input"]')
      if (!messageInput) {
        throw new Error('Message input not found')
      }

      await messageInput.fill(message)
      await this.page.waitForTimeout(300)
      await this.page.keyboard.press('Enter')

      console.log(`✅ Message sent to ${to}`)
      return { success: true }
    } catch (error) {
      console.error('Error sending message:', error.message)
      return { success: false, error: error.message }
    }
  }

  async disconnect() {
    if (this.context) {
      await this.context.close()
    }
    this.isConnected = false
    this.emit('disconnected')
  }
}

// CLI execution
const whatsapp = new WhatsAppService(process.env.WHATSAPP_SESSION_PATH)

whatsapp.on('qrcode', () => {
  console.log('\n📱 QR Code displayed above. Scan with your phone!\n')
})

whatsapp.on('connected', () => {
  console.log('\n🎉 Ready! You can now send messages via the API.')
  console.log('📡 API endpoint: http://localhost:3000/api/whatsapp/send')
})

whatsapp.on('message', (msg) => {
  console.log('📨 Incoming message:', msg)
})

whatsapp.on('error', (error) => {
  console.error('❌ Error:', error.message)
})

console.log('🚀 Starting WhatsApp Web service...\n')

whatsapp.initialize().catch((error) => {
  console.error('Failed to initialize:', error)
  process.exit(1)
})

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...')
  await whatsapp.disconnect()
  process.exit(0)
})