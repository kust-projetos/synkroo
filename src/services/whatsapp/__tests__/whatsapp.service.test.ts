/**
 * Tests for WhatsAppService
 * Mocks: Playwright (chromium), EventEmitter, QRCode
 */

import { EventEmitter } from 'events'

// Mock playwright before importing the service
jest.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: jest.fn(),
  },
}))

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn(),
}))

import { WhatsAppService } from '../whatsapp.service'
import { chromium } from 'playwright'

describe('WhatsAppService', () => {
  let service: WhatsAppService
  let mockContext: any
  let mockPage: any

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockPage = {
      goto: jest.fn(),
      $: jest.fn(),
      waitForSelector: jest.fn(),
      waitForTimeout: jest.fn(),
      fill: jest.fn(),
      click: jest.fn(),
      keyboard: { press: jest.fn() },
      evaluate: jest.fn(),
    }
    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn(),
    };
    (chromium.launchPersistentContext as jest.Mock).mockResolvedValue(mockContext)
    service = new WhatsAppService('./.test-whatsapp-session')
  })

  afterEach(() => {
    service.removeAllListeners()
    jest.useRealTimers()
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  afterAll(() => {
    jest.clearAllMocks()
  })

  describe('constructor', () => {
    it('should extend EventEmitter', () => {
      expect(service).toBeInstanceOf(EventEmitter)
    })

    it('should default isConnected to false before initialize', () => {
      expect(service.isConnected).toBe(false)
    })
  })

  describe('initialize()', () => {
    it('should call chromium.launchPersistentContext', async () => {
      // Mock already logged in
      mockPage.$ = jest.fn().mockResolvedValue({}) // chat list found

      await service.initialize()

      expect(chromium.launchPersistentContext).toHaveBeenCalledWith(
        './.test-whatsapp-session',
        expect.objectContaining({
          headless: expect.any(Boolean),
          viewport: { width: 1280, height: 800 },
        })
      )
    })

    it('should emit connected when already logged in', async () => {
      const connectedHandler = jest.fn()
      service.on('connected', connectedHandler)
      mockPage.$ = jest.fn().mockResolvedValue({}) // chat list found

      await service.initialize()

      expect(connectedHandler).toHaveBeenCalled()
    })
  })

  describe('sendMessage()', () => {
    it('should return error if not connected', async () => {
      const result = await service.sendMessage('11999999999', 'Hello')
      expect(result.success).toBe(false)
    })

    it('should return error if page is null', async () => {
      // Manually set connected state but no page
      const service2 = new WhatsAppService('./.test-whatsapp-session')
      ;(service2 as any)._isConnected = true
      ;(service2 as any).page = null

      const result = await service2.sendMessage('11999999999', 'Hello')
      expect(result.success).toBe(false)
      service2.removeAllListeners()
    })
  })

  describe('events', () => {
    it('should be an EventEmitter instance', () => {
      service.on('qrcode', jest.fn())
      const emitted = jest.fn()
      service.on('qrcode', emitted)
      service.emit('qrcode', 'data:image/png;base64,abc123')
      expect(emitted).toHaveBeenCalledWith('data:image/png;base64,abc123')
    })
  })
})