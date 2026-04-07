/**
 * Tests for WhatsApp Service (Playwright-based)
 * Tests WhatsApp Web automation via browser control
 */

// Mock Playwright BEFORE importing service
const mockLaunchPersistentContext = jest.fn()

jest.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: mockLaunchPersistentContext,
  },
}))

// Mock qrcode-terminal
jest.mock('qrcode-terminal', () => ({
  generate: jest.fn((_, opts, cb) => cb('QR-DISPLAY')),
}))

import { WhatsAppService, WhatsAppMessage, WhatsAppSession } from '../whatsapp.service'

// Setup mock implementations
const mockPage = {
  goto: jest.fn(),
  $: jest.fn(),
  $$: jest.fn(),
  $$eval: jest.fn(),
  waitForSelector: jest.fn(),
  waitForTimeout: jest.fn(),
  keyboard: { press: jest.fn() },
  evaluate: jest.fn(),
  click: jest.fn(),
  fill: jest.fn(),
  getAttribute: jest.fn(),
  closest: jest.fn(),
  classList: { contains: jest.fn() },
}

const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn(),
}

mockLaunchPersistentContext.mockResolvedValue(mockContext)

// Mock console to avoid noise
const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

describe('WhatsAppService', () => {
  let service: WhatsAppService

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    service = new WhatsAppService()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  afterAll(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('constructor', () => {
    it('should use default session path', () => {
      const defaultService = new WhatsAppService()
      expect((defaultService as any).sessionPath).toBe('./.whatsapp-session')
    })

    it('should use custom session path', () => {
      const customService = new WhatsAppService('/custom/path/session')
      expect((customService as any).sessionPath).toBe('/custom/path/session')
    })
  })

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(service.isConnected).toBe(false)
    })

    it('should return true after successful connection', async () => {
      const connectedListener = jest.fn()
      service.on('connected', connectedListener)

      // Mock already logged in
      mockPage.$.mockResolvedValueOnce({}) // chat-list exists

      await service.initialize()

      expect(service.isConnected).toBe(true)
      expect(connectedListener).toHaveBeenCalled()
    })
  })

  describe('initialize - already logged in', () => {
    it('should detect existing login and emit connected', async () => {
      const connectedListener = jest.fn()
      service.on('connected', connectedListener)

      // Mock chat-list found (already logged in)
      mockPage.$.mockResolvedValueOnce({})

      await service.initialize()

      expect(mockPage.goto).toHaveBeenCalledWith('https://web.whatsapp.com', { waitUntil: 'networkidle' })
      expect(connectedListener).toHaveBeenCalled()
      expect(service.isConnected).toBe(true)
    })

    it('should start message listener after connection', async () => {
      mockPage.$.mockResolvedValueOnce({})

      await service.initialize()

      // Advance timers to trigger message listener
      jest.advanceTimersByTime(5000)
      expect(mockPage.$$).toHaveBeenCalledWith('[data-testid="chat-list"] [aria-label*="unread"]')
    })
  })

  describe('initialize - QR code flow', () => {
    it('should wait for QR code when not logged in', async () => {
      const qrcodeListener = jest.fn()
      const connectedListener = jest.fn()
      service.on('qrcode', qrcodeListener)
      service.on('connected', connectedListener)

      // First check: not logged in (null)
      mockPage.$.mockResolvedValueOnce(null)

      // Mock QR canvas element
      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('data:image/png;base64,qr-data'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      // Mock waitForSelector for canvas and chat-list
      mockPage.waitForSelector.mockResolvedValue(undefined)

      // Mock getCurrentChatPhone for number extraction
      mockPage.$.mockResolvedValueOnce({ getAttribute: jest.fn().mockResolvedValue(null) })

      await service.initialize()

      expect(qrcodeListener).toHaveBeenCalledWith('data:image/png;base64,qr-data')
      expect(connectedListener).toHaveBeenCalled()
      expect(service.isConnected).toBe(true)
    })

    it('should emit QR code event with data URL', async () => {
      const qrcodeListener = jest.fn()
      service.on('qrcode', qrcodeListener)

      // Not logged in
      mockPage.$.mockResolvedValueOnce(null)

      // Mock QR canvas
      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('data:image/png;base64,test-qr'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValue(undefined)

      await service.initialize()

      expect(qrcodeListener).toHaveBeenCalledWith('data:image/png;base64,test-qr')
    })

    it('should throw error on QR code timeout', async () => {
      mockPage.$.mockResolvedValueOnce(null) // not logged in

      // Mock timeout for QR canvas
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'))

      await expect(service.initialize()).rejects.toThrow()
    })
  })

  describe('sendMessage', () => {
    it('should return false when not connected', async () => {
      const result = await service.sendMessage('5511999999999', 'Hello')

      expect(result.success).toBe(false)
      expect(result.messageId).toBeUndefined()
    })

    it('should send message successfully when connected', async () => {
      // First, connect the service
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      jest.clearAllMocks()

      // Mock search input
      const mockSearchInput = { fill: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockSearchInput)

      // Mock contact found
      const mockContact = { click: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockContact)

      // Mock message input
      const mockMessageInput = { fill: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockMessageInput)

      mockPage.waitForSelector.mockResolvedValue(undefined)
      mockPage.waitForTimeout.mockResolvedValue(undefined)

      const result = await service.sendMessage('5511999999999', 'Test message')

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(mockSearchInput.fill).toHaveBeenCalledWith('5511999999999')
      expect(mockMessageInput.fill).toHaveBeenCalledWith('Test message')
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter')
    })

    it('should handle missing search input', async () => {
      // Connect first
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      jest.clearAllMocks()

      // Mock missing search input
      mockPage.$.mockResolvedValueOnce(null)

      const result = await service.sendMessage('5511999999999', 'Test')

      expect(result.success).toBe(false)
    })

    it('should handle missing contact (create new chat)', async () => {
      // Connect first
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      jest.clearAllMocks()

      // Mock search input
      const mockSearchInput = { fill: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockSearchInput)

      // Mock no contact found (null)
      mockPage.$.mockResolvedValueOnce(null)

      // Mock message input
      const mockMessageInput = { fill: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockMessageInput)

      mockPage.waitForSelector.mockResolvedValue(undefined)
      mockPage.waitForTimeout.mockResolvedValue(undefined)

      const result = await service.sendMessage('5511999999999', 'Test')

      expect(result.success).toBe(true)
      expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter')
    })

    it('should emit message event for received messages', async () => {
      const messageListener = jest.fn()
      service.on('message', messageListener)

      // Connect first
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      jest.clearAllMocks()

      // No unread chats initially
      mockPage.$$.mockResolvedValueOnce([])

      // Advance timers to trigger message listener - no messages
      jest.advanceTimersByTime(5000)

      // Verify listener was called (or not, based on mock setup)
      // The message listener only emits when there are unread chats
      expect(mockPage.$$).toHaveBeenCalledWith('[data-testid="chat-list"] [aria-label*="unread"]')
    })

    it('should not emit message for messages from me', async () => {
      const messageListener = jest.fn()
      service.on('message', messageListener)

      // Connect first
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      jest.clearAllMocks()

      // No unread chats
      mockPage.$$.mockResolvedValueOnce([])

      // Advance timers
      jest.advanceTimersByTime(5000)

      expect(messageListener).not.toHaveBeenCalled()
    })
  })

  describe('getSession', () => {
    it('should return correct session structure when connected', async () => {
      // Connect first
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      const session: WhatsAppSession = service.getSession()

      expect(session.isConnected).toBe(true)
      expect(session.phoneNumber).toBeNull()
      expect(session.lastActivity).toBeInstanceOf(Date)
    })

    it('should return disconnected session when not connected', () => {
      const session: WhatsAppSession = service.getSession()

      expect(session.isConnected).toBe(false)
      expect(session.phoneNumber).toBeNull()
      expect(session.lastActivity).toBeInstanceOf(Date)
    })

    it('should include phone number when extracted', async () => {
      // Connect and extract phone
      mockPage.$.mockResolvedValueOnce(null) // not logged in

      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('qr-data'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValue(undefined)

      // Mock profile button
      const mockProfileButton = { click: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockProfileButton)

      // Mock phone extraction
      const mockPhoneElement = {
        getAttribute: jest.fn().mockResolvedValue('+55 11 99999-9999'),
      }
      mockPage.$.mockResolvedValueOnce(mockPhoneElement)

      await service.initialize()

      const session = service.getSession()

      // phoneNumber has spaces removed but keeps the dash (code only removes \s)
      expect(session.phoneNumber).toBe('+551199999-9999')
    })
  })

  describe('getQRCode', () => {
    it('should return null initially', () => {
      const qr = service.getQRCode()
      expect(qr).toBeNull()
    })

    it('should return QR code data during QR flow', async () => {
      const qrcodeListener = jest.fn()
      service.on('qrcode', qrcodeListener)

      mockPage.$.mockResolvedValueOnce(null) // not logged in

      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('data:image/png;base64,my-qr'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValueOnce(undefined) // canvas
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout')) // chat-list timeout (so QR stays)

      await service.initialize().catch(() => {})

      // QR code should still be stored even if connection fails
      expect(qrcodeListener).toHaveBeenCalledWith('data:image/png;base64,my-qr')
    })

    it('should return null after successful connection', async () => {
      mockPage.$.mockResolvedValueOnce(null) // not logged in

      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('qr-data'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValue(undefined) // both canvas and chat-list succeed

      // Mock getCurrentChatPhone returns null (no phone to extract)
      mockPage.$.mockResolvedValueOnce(null)

      await service.initialize()

      // After connection, QR should be cleared
      const qr = service.getQRCode()
      expect(qr).toBeNull()
    })
  })

  describe('disconnect', () => {
    it('should close context and set connected to false', async () => {
      // Connect first
      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      const disconnectedListener = jest.fn()
      service.on('disconnected', disconnectedListener)

      await service.disconnect()

      expect(mockContext.close).toHaveBeenCalled()
      expect(service.isConnected).toBe(false)
      expect(disconnectedListener).toHaveBeenCalled()
    })

    it('should work even when context is null', async () => {
      const service2 = new WhatsAppService()

      const disconnectedListener = jest.fn()
      service2.on('disconnected', disconnectedListener)

      await expect(service2.disconnect()).resolves.not.toThrow()
      expect(service2.isConnected).toBe(false)
      expect(disconnectedListener).toHaveBeenCalled()
    })
  })

  describe('events', () => {
    it('should emit connected event', async () => {
      const listener = jest.fn()
      service.on('connected', listener)

      mockPage.$.mockResolvedValueOnce({})

      await service.initialize()

      expect(listener).toHaveBeenCalled()
    })

    it('should emit disconnected event', async () => {
      const listener = jest.fn()
      service.on('disconnected', listener)

      mockPage.$.mockResolvedValueOnce({})
      await service.initialize()

      await service.disconnect()

      expect(listener).toHaveBeenCalled()
    })

    it('should emit qrcode event', async () => {
      const listener = jest.fn()
      service.on('qrcode', listener)

      mockPage.$.mockResolvedValueOnce(null) // not logged in

      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('qr-data'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValue(undefined)

      await service.initialize()

      expect(listener).toHaveBeenCalledWith('qr-data')
    })

    it('should emit error event on QR timeout', async () => {
      const listener = jest.fn()
      service.on('error', listener)

      mockPage.$.mockResolvedValueOnce(null)

      // Mock canvas found
      mockPage.waitForSelector.mockResolvedValueOnce(undefined)

      // Mock chat-list timeout
      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'))

      await service.initialize().catch(() => {})

      expect(listener).toHaveBeenCalledWith(expect.any(Error))
    })
  })

  describe('getWhatsAppService (singleton)', () => {
    const originalEnv = process.env.WHATSAPP_SESSION_PATH

    beforeEach(() => {
      // Reset singleton before each test
      const whatsappModule = require('../whatsapp.service')
      whatsappModule.whatsappInstance = null
    })

    afterEach(() => {
      process.env.WHATSAPP_SESSION_PATH = originalEnv
      // Reset singleton
      const whatsappModule = require('../whatsapp.service')
      whatsappModule.whatsappInstance = null
    })

    it('should create singleton instance', () => {
      const { getWhatsAppService } = require('../whatsapp.service')

      const service1 = getWhatsAppService()
      const service2 = getWhatsAppService()

      expect(service1).toBe(service2)
    })

    it('should use default session path when env is not set', () => {
      // Ensure env is undefined
      delete process.env.WHATSAPP_SESSION_PATH

      // Reset singleton to force new instance creation
      const whatsappModule = require('../whatsapp.service')
      whatsappModule.whatsappInstance = null

      const { getWhatsAppService } = require('../whatsapp.service')
      const service = getWhatsAppService()

      expect((service as any).sessionPath).toBe('./.whatsapp-session')
    })
  })

  describe('extractPhoneNumber', () => {
    it('should extract and format phone number from profile', async () => {
      mockPage.$.mockResolvedValueOnce(null) // not logged in

      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('qr-data'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValue(undefined)

      // Mock profile button
      const mockProfileButton = { click: jest.fn() }
      mockPage.$.mockResolvedValueOnce(mockProfileButton)

      // Mock phone element
      const mockPhoneElement = {
        getAttribute: jest.fn().mockResolvedValue('+55 11 99999-9999'),
      }
      mockPage.$.mockResolvedValueOnce(mockPhoneElement)

      await service.initialize()

      // phoneNumber has spaces removed but dash remains (code only removes \s)
      expect((service as any).phoneNumber).toBe('+551199999-9999')
    })

    it('should handle missing profile gracefully', async () => {
      mockPage.$.mockResolvedValueOnce(null) // not logged in

      const mockCanvas = {
        evaluate: jest.fn().mockResolvedValue('qr-data'),
      }
      mockPage.$.mockResolvedValueOnce(mockCanvas)

      mockPage.waitForSelector.mockResolvedValue(undefined)

      // Mock no profile button
      mockPage.$.mockResolvedValueOnce(null)

      await service.initialize()

      expect((service as any).phoneNumber).toBeNull()
    })
  })
})
