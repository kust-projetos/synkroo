/**
 * Tests for Evolution API Service
 * Tests WhatsApp message sending and event processing
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

global.fetch = jest.fn()

import { EvolutionApiService } from '../evolution.service'

describe('Evolution API Service', () => {
  let service: EvolutionApiService

  beforeEach(() => {
    jest.clearAllMocks()
    service = new EvolutionApiService('http://localhost:8080', 'test-api-key', 'test-instance')
  })

  describe('constructor', () => {
    it('should strip trailing slash from baseUrl', () => {
      const svc = new EvolutionApiService('http://localhost:8080/', 'key', 'inst')
      expect((svc as any).baseUrl).toBe('http://localhost:8080')
    })
  })

  describe('sendTextMessage', () => {
    it('should send text message with formatted number', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ key: { id: 'msg-123' } }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await service.sendTextMessage('11999999999', 'Olá!')

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('msg-123')
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8080/message/sendText/test-instance',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"number":"5511999999999"'),
        })
      )
    })

    it('should not add 55 prefix if already present', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ key: { id: 'msg-456' } }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      await service.sendTextMessage('5511999999999', 'Olá!')

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(callBody.number).toBe('5511999999999')
    })

    it('should return error on API failure', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ message: 'Bad request' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await service.sendTextMessage('11999999999', 'test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Bad request')
    })

    it('should return error on network failure', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const result = await service.sendTextMessage('11999999999', 'test')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })
  })

  describe('sendMediaMessage', () => {
    it('should send media message with formatted number', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ key: { id: 'media-123' } }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await service.sendMediaMessage({
        number: '11999999999',
        media: 'https://example.com/image.jpg',
        mediatype: 'image',
        caption: 'Veja isso',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('media-123')
    })
  })

  describe('getConnectionState', () => {
    it('should return connection state', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          instance: { state: 'open', statusReason: 0 },
        }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const state = await service.getConnectionState()

      expect(state).toEqual({ state: 'open', statusReason: 0 })
      expect(service.getConnectionStatus()).toBe(true)
    })

    it('should return null on error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('fail'))

      const state = await service.getConnectionState()
      expect(state).toBeNull()
    })
  })

  describe('getQRCode', () => {
    it('should return QR code data', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: '321',
          base64: 'data:image/png;base64,abc',
        }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const qr = await service.getQRCode()

      expect(qr).toEqual({ code: '321', base64: 'data:image/png;base64,abc' })
    })

    it('should emit qrcode event', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          code: '321',
          base64: 'qr-data',
        }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const listener = jest.fn()
      service.on('qrcode', listener)
      await service.getQRCode()

      expect(listener).toHaveBeenCalledWith('qr-data')
    })
  })

  describe('processWebhookEvent', () => {
    it('should handle CONNECTION_UPDATE event', () => {
      const listener = jest.fn()
      service.on('connected', listener)

      service.processWebhookEvent({
        event: 'CONNECTION_UPDATE',
        instance: 'test-instance',
        data: { state: 'open', statusReason: 0 },
      })

      expect(listener).toHaveBeenCalled()
      expect(service.getConnectionStatus()).toBe(true)
    })

    it('should handle disconnection', () => {
      const listener = jest.fn()
      service.on('disconnected', listener)

      service.processWebhookEvent({
        event: 'CONNECTION_UPDATE',
        instance: 'test-instance',
        data: { state: 'close', statusReason: 403 },
      })

      expect(listener).toHaveBeenCalledWith({ state: 'close', statusReason: 403 })
      expect(service.getConnectionStatus()).toBe(false)
    })

    it('should handle MESSAGES_UPSERT event', () => {
      const listener = jest.fn()
      service.on('message', listener)

      service.processWebhookEvent({
        event: 'MESSAGES_UPSERT',
        instance: 'test-instance',
        data: {
          messages: [{
            key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'msg-1' },
            message: { conversation: 'Olá' },
            messageTimestamp: Math.floor(Date.now() / 1000),
          }],
        },
      })

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          body: 'Olá',
          isFromMe: false,
        })
      )
    })

    it('should ignore messages from me', () => {
      const listener = jest.fn()
      service.on('message', listener)

      service.processWebhookEvent({
        event: 'MESSAGES_UPSERT',
        instance: 'test-instance',
        data: {
          messages: [{
            key: { remoteJid: '5511@s.whatsapp.net', fromMe: true, id: 'msg-self' },
            message: { conversation: 'Auto reply' },
            messageTimestamp: Math.floor(Date.now() / 1000),
          }],
        },
      })

      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle MESSAGES_UPDATE event', () => {
      const listener = jest.fn()
      service.on('messageStatus', listener)

      service.processWebhookEvent({
        event: 'MESSAGES_UPDATE',
        instance: 'test-instance',
        data: {
          key: { id: 'msg-1', remoteJid: '5511@s.whatsapp.net' },
          status: 'delivered',
        },
      })

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          messageId: 'msg-1',
          status: 'delivered',
        })
      )
    })

    it('should handle QRCODE_UPDATED event', () => {
      const listener = jest.fn()
      service.on('qrcode', listener)

      service.processWebhookEvent({
        event: 'QRCODE_UPDATED',
        instance: 'test-instance',
        data: { qrcode: 'base64data' },
      })

      expect(listener).toHaveBeenCalledWith('base64data')
    })
  })

  describe('getInstanceName', () => {
    it('should return configured instance name', () => {
      expect(service.getInstanceName()).toBe('test-instance')
    })
  })

  describe('checkNumber', () => {
    it('should check if number exists on WhatsApp', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ exists: true, jid: '5511999999999@s.whatsapp.net' }),
      }
      ;(global.fetch as jest.Mock).mockResolvedValue(mockResponse)

      const result = await service.checkNumber('11999999999')
      expect(result.exists).toBe(true)
      expect(result.jid).toBeTruthy()
    })

    it('should return false on error', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('fail'))

      const result = await service.checkNumber('11999999999')
      expect(result.exists).toBe(false)
    })
  })
})
