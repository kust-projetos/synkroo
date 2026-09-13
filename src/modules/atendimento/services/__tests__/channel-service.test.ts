/**
 * Unit Test Suite for channel-service.ts (src/modules/atendimento/services/channel-service.ts)
 *
 * Covers:
 * 1. Provider detection & sendWhatsAppMessage facade (Evolution, Playwright sidecar, Business-API, fail-closed)
 * 2. sendByChannel dispatching (whatsapp, instagram, web)
 * 3. sendWhatsApp error handling (null evolution, Error throw, string throw)
 * 4. sendInstagram validation & network flow (missing envs, success, HTTP failure, network rejection)
 * 5. WhatsAppService client lifecycle & HTTP calls (initialize, status, sendMessage with Bearer auth, error handling, fail-closed)
 * 6. getQRCode authenticated sidecar fetch
 * 7. getWhatsAppService singleton instance caching
 */

import {
  sendWhatsAppMessage,
  sendByChannel,
  sendWhatsApp,
  sendInstagram,
  WhatsAppService,
  getWhatsAppService,
} from '../channel-service';
import { getEvolutionService } from '../evolution-service';
import { dbLogger } from '@/lib/logger';

// ─── Mocks ─────────────────────────────────────────────────────

jest.mock('../evolution-service', () => ({
  getEvolutionService: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const mockEvolution = getEvolutionService as jest.MockedFunction<typeof getEvolutionService>;

describe('channel-service unit tests', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    delete process.env.WHATSAPP_API_URL;
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.INSTAGRAM_ACCOUNT_ID;
    delete process.env.INSTAGRAM_ACCESS_TOKEN;
    delete process.env.WHATSAPP_SESSION_PATH;
    delete process.env.WHATSAPP_HEADLESS;
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  describe('sendWhatsAppMessage facade & provider detection', () => {
    it('uses evolution provider when EVOLUTION_API_URL and KEY are set', async () => {
      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'secret-key';

      const mockSend = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-123' });
      mockEvolution.mockReturnValue({
        sendTextMessage: mockSend,
      } as any);

      const res = await sendWhatsAppMessage('5511999999999', 'Olá via Evolution');
      expect(res).toEqual({ success: true, messageId: 'evo-123' });
      expect(mockSend).toHaveBeenCalledWith('5511999999999', 'Olá via Evolution');
    });

    it('falls back to the sidecar when Evolution reports a failed send', async () => {
      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'secret-key';
      process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
      process.env.WHATSAPP_FALLBACK_SECRET = 'secret-sidecar';

      mockEvolution.mockReturnValue({
        sendTextMessage: jest.fn().mockResolvedValue({ success: false, error: 'Evolution unavailable' }),
      } as any);
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, messageId: 'sidecar-123' }),
      } as Response);

      await expect(sendWhatsAppMessage('5511999999999', 'Olá via fallback')).resolves.toEqual({
        success: true,
        messageId: 'sidecar-123',
      });
    });

    it('falls back to the sidecar when Evolution throws', async () => {
      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'secret-key';
      process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
      process.env.WHATSAPP_FALLBACK_SECRET = 'secret-sidecar';

      mockEvolution.mockReturnValue({
        sendTextMessage: jest.fn().mockRejectedValue(new Error('Evolution timed out')),
      } as any);
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, messageId: 'sidecar-456' }),
      } as Response);

      await expect(sendWhatsAppMessage('5511999999999', 'Olá via fallback')).resolves.toEqual({
        success: true,
        messageId: 'sidecar-456',
      });
    });

    it('returns error when evolution provider is configured but getEvolutionService returns null', async () => {
      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'secret-key';
      mockEvolution.mockReturnValue(null);

      const res = await sendWhatsAppMessage('5511999999999', 'Olá');
      expect(res).toEqual({ success: false, error: 'No WhatsApp provider available' });
    });

    it('returns fallback error when business-api provider is detected', async () => {
      process.env.WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
      process.env.WHATSAPP_TOKEN = 'token-123';

      const res = await sendWhatsAppMessage('5511999999999', 'Olá via Business API');
      expect(res).toEqual({ success: false, error: 'No WhatsApp provider available' });
    });

    it('uses playwright sidecar provider when no API env vars are set and sidecar URL is configured', async () => {
      process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
      process.env.WHATSAPP_FALLBACK_SECRET = 'secret-sidecar';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, messageId: 'sidecar-123' }),
      } as Response);

      const res = await sendWhatsAppMessage('5511999999999', 'Olá via Sidecar');
      expect(res).toEqual({ success: true, messageId: 'sidecar-123' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://whatsapp-sidecar.example.com/api/v1/messages/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-sidecar',
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ phone: '5511999999999', message: 'Olá via Sidecar' }),
        }),
      );
    });

    it('returns config error when playwright provider is default and sidecar is not configured', async () => {
      const service = getWhatsAppService();
      (service as any)._isConnected = false;

      const res = await sendWhatsAppMessage('5511999999999', 'Olá');
      expect(res).toEqual({
        success: false,
        error: 'WhatsApp fallback not configured: missing WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET',
      });
      expect(res.messageId).toBeUndefined();
    });

    it('never returns simulated messageId when sidecar config is missing even if instance reports connected', async () => {
      const service = getWhatsAppService();
      (service as any)._isConnected = true;

      const res = await sendWhatsAppMessage('5511999999999', 'Olá fail-closed');
      expect(res.success).toBe(false);
      expect(res.messageId).toBeUndefined();
      expect(res.error).toMatch(/not configured/i);
      (service as any)._isConnected = false;
    });
  });

  describe('sendByChannel', () => {
    it('dispatches to whatsapp channel', async () => {
      const mockSend = jest.fn().mockResolvedValue({ success: true, messageId: 'msg-wa' });
      mockEvolution.mockReturnValue({ sendTextMessage: mockSend } as any);

      const res = await sendByChannel('whatsapp', '11999999999', 'Msg WhatsApp');
      expect(res.success).toBe(true);
      expect(res.messageId).toBe('msg-wa');
    });

    it('dispatches to instagram channel', async () => {
      process.env.INSTAGRAM_ACCOUNT_ID = 'ig-acc-1';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'ig-token-1';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message_id: 'ig-msg-777' }),
      } as Response);

      const res = await sendByChannel('instagram', 'ig-user-1', 'Msg Insta');
      expect(res.success).toBe(true);
      expect(res.messageId).toBe('ig-msg-777');
    });

    it('returns error for web channel (receive-only)', async () => {
      const res = await sendByChannel('web', 'web-user', 'Msg Web');
      expect(res).toEqual({ success: false, error: 'Web widget is receive-only' });
    });
  });

  describe('sendWhatsApp error handling', () => {
    it('returns error when Evolution service is null', async () => {
      mockEvolution.mockReturnValue(null);
      const res = await sendWhatsApp('11999999999', 'Texto');
      expect(res).toEqual({ success: false, error: 'Evolution service not available' });
    });

    it('handles Error instance thrown by evolution service', async () => {
      mockEvolution.mockReturnValue({
        sendTextMessage: jest.fn().mockRejectedValue(new Error('Connection timed out')),
      } as any);

      const res = await sendWhatsApp('11999999999', 'Texto');
      expect(res).toEqual({ success: false, error: 'Connection timed out' });
      expect(dbLogger.error).toHaveBeenCalledWith(
        'channel-service: evolution send failed',
        expect.any(Error),
      );
    });

    it('handles non-Error thrown by evolution service', async () => {
      mockEvolution.mockReturnValue({
        sendTextMessage: jest.fn().mockRejectedValue('Fatal string error'),
      } as any);

      const res = await sendWhatsApp('11999999999', 'Texto');
      expect(res).toEqual({ success: false, error: 'Fatal string error' });
      expect(dbLogger.error).toHaveBeenCalledWith(
        'channel-service: evolution send failed',
        'Fatal string error',
      );
    });
  });

  describe('sendInstagram', () => {
    it('returns error when INSTAGRAM_ACCOUNT_ID is missing', async () => {
      process.env.INSTAGRAM_ACCESS_TOKEN = 'token-only';
      const res = await sendInstagram('user-1', 'Ola');
      expect(res).toEqual({ success: false, error: 'Instagram provider not configured' });
    });

    it('returns error when INSTAGRAM_ACCESS_TOKEN is missing', async () => {
      process.env.INSTAGRAM_ACCOUNT_ID = 'acc-only';
      const res = await sendInstagram('user-1', 'Ola');
      expect(res).toEqual({ success: false, error: 'Instagram provider not configured' });
    });

    it('returns success with messageId on 200 response', async () => {
      process.env.INSTAGRAM_ACCOUNT_ID = 'acc-123';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'tok-456';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message_id: 'ig-mid-999' }),
      } as Response);

      const res = await sendInstagram('recipient-1', 'Mensagem Instagram');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v18.0/acc-123/messages',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Authorization: 'Bearer tok-456',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: 'recipient-1' },
            message: { text: 'Mensagem Instagram' },
          }),
        }),
      );
      expect(res).toEqual({ success: true, messageId: 'ig-mid-999' });
    });

    it('returns failure when response is not ok (e.g. HTTP 400)', async () => {
      process.env.INSTAGRAM_ACCOUNT_ID = 'acc-123';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'tok-456';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      const res = await sendInstagram('recipient-1', 'Mensagem');
      expect(res).toEqual({ success: false, error: 'Instagram provider request failed' });
    });

    it('returns failure when fetch throws network error', async () => {
      process.env.INSTAGRAM_ACCOUNT_ID = 'acc-123';
      process.env.INSTAGRAM_ACCESS_TOKEN = 'tok-456';

      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Fetch DNS resolution failed'));

      const res = await sendInstagram('recipient-1', 'Mensagem');
      expect(res).toEqual({ success: false, error: 'Instagram provider request failed' });
      expect(dbLogger.error).toHaveBeenCalledWith(
        'channel-service: instagram send failed',
        expect.any(Error),
      );
    });
  });

  describe('WhatsAppService client methods & HTTP sidecar integration', () => {
    it('initializes with default session path and returns initial session state', async () => {
      const service = new WhatsAppService();
      expect(service.isConnected).toBe(false);
      expect(await service.getQRCode()).toBeNull();

      const session = service.getSession();
      expect(session.isConnected).toBe(false);
      expect(session.phoneNumber).toBeNull();
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('initializes with custom session path', () => {
      const service = new WhatsAppService('/custom/session/path');
      expect((service as any).sessionPath).toBe('/custom/session/path');
    });

    it('disconnects and emits disconnected', async () => {
      const service = new WhatsAppService();
      (service as any)._isConnected = true;

      const disconnectedListener = jest.fn();
      service.on('disconnected', disconnectedListener);

      await service.disconnect();

      expect(service.isConnected).toBe(false);
      expect(disconnectedListener).toHaveBeenCalledTimes(1);
    });

    describe('initialize lifecycle via sidecar', () => {
      it('returns early when WHATSAPP_FALLBACK_URL is not set (fail-closed)', async () => {
        const service = new WhatsAppService();
        await service.initialize();
        expect(service.isConnected).toBe(false);
        expect(dbLogger.warn).toHaveBeenCalledWith(
          'channel-service: WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET not configured',
        );
      });

      it('returns early when WHATSAPP_FALLBACK_SECRET is missing (fail-closed)', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        const service = new WhatsAppService();
        await service.initialize();
        expect(service.isConnected).toBe(false);
        expect(dbLogger.warn).toHaveBeenCalledWith(
          'channel-service: WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET not configured',
        );
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('connects to sidecar and updates status when sidecar reports connected', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'secret-123';

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ isConnected: true, phoneNumber: '+5511999990000' }),
        } as Response);

        const service = new WhatsAppService();
        const connectedListener = jest.fn();
        service.on('connected', connectedListener);

        await service.initialize();

        expect(service.isConnected).toBe(true);
        expect(service.getSession().phoneNumber).toBe('+5511999990000');
        expect(connectedListener).toHaveBeenCalled();
        expect(dbLogger.info).toHaveBeenCalledWith('channel-service: WhatsApp sidecar connected');
        expect(global.fetch).toHaveBeenCalledWith(
          'https://whatsapp-sidecar.example.com/api/v1/session/status',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: 'Bearer secret-123',
            }),
          }),
        );
      });

      it('emits error and logs when sidecar request throws', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'secret-123';
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Connection refused'));

        const service = new WhatsAppService();
        const errorListener = jest.fn();
        service.on('error', errorListener);

        await service.initialize();

        expect(service.isConnected).toBe(false);
        expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
        expect(dbLogger.error).toHaveBeenCalledWith('channel-service: failed to connect to WhatsApp sidecar', expect.any(Error));
      });
    });

    describe('sendMessage via sidecar (fail-closed)', () => {
      it('returns config error when fallback URL is not configured', async () => {
        const service = new WhatsAppService();
        const res = await service.sendMessage('11999999999', 'Oi');
        expect(res).toEqual({
          success: false,
          error: 'WhatsApp fallback not configured: missing WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET',
        });
        expect(res.messageId).toBeUndefined();
      });

      it('returns config error when fallback SECRET is missing (fail-closed)', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        const service = new WhatsAppService();
        // even if marked connected, must not simulate success
        (service as any)._isConnected = true;
        const res = await service.sendMessage('11999999999', 'Oi');
        expect(res).toEqual({
          success: false,
          error: 'WhatsApp fallback not configured: missing WHATSAPP_FALLBACK_URL or WHATSAPP_FALLBACK_SECRET',
        });
        expect(res.messageId).toBeUndefined();
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('returns config error when both URL and secret missing and does not simulate messageId', async () => {
        const service = new WhatsAppService();
        (service as any)._isConnected = true;
        const res = await service.sendMessage('11999999999', 'Oi fail-closed');
        expect(res.success).toBe(false);
        expect(res.messageId).toBeUndefined();
        expect(res.error).toMatch(/not configured/i);
      });

      it('returns success when sidecar returns 200', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'token-abc';

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, messageId: 'msg-999' }),
        } as Response);

        const service = new WhatsAppService();
        const res = await service.sendMessage('11999999999', 'Mensagem teste');

        expect(res).toEqual({ success: true, messageId: 'msg-999' });
        expect(global.fetch).toHaveBeenCalledWith(
          'https://whatsapp-sidecar.example.com/api/v1/messages/send',
          expect.objectContaining({
            method: 'POST',
            headers: {
              Authorization: 'Bearer token-abc',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: '11999999999', message: 'Mensagem teste' }),
          }),
        );
      });

      it('returns sidecar error when sidecar returns HTTP error (e.g. 503)', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'secret-123';

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: async () => ({ success: false, error: 'WhatsApp session disconnected' }),
        } as Response);

        const service = new WhatsAppService();
        const res = await service.sendMessage('11999999999', 'Oi');

        expect(res).toEqual({ success: false, error: 'WhatsApp session disconnected' });
      });

      it('returns error when fetch throws network exception', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'secret-123';
        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network timeout'));

        const service = new WhatsAppService();
        const res = await service.sendMessage('11999999999', 'Oi');

        // A2: POST sem retry; falha de transporte vira erro estruturado.
        expect(res.success).toBe(false);
        expect(res.error).toMatch(/External request/);
        expect(dbLogger.error).toHaveBeenCalledWith('channel-service: sidecar sendMessage failed', expect.any(Error));
      });
    });

    describe('getQRCode via authenticated sidecar', () => {
      it('returns null when fallback URL/secret not configured (fail-closed)', async () => {
        const service = new WhatsAppService();
        const qr = await service.getQRCode();
        expect(qr).toBeNull();
        expect(global.fetch).not.toHaveBeenCalled();
      });

      it('returns null when secret missing even if URL present', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        const service = new WhatsAppService();
        const qr = await service.getQRCode();
        expect(qr).toBeNull();
      });

      it('fetches QR code from authenticated sidecar endpoint', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'qr-secret-123';

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: true,
          json: async () => ({ qrcode: 'data:image/png;base64,QR123', qrcode_available: true }),
        } as Response);

        const service = new WhatsAppService();
        const qr = await service.getQRCode();

        expect(qr).toBe('data:image/png;base64,QR123');
        expect(global.fetch).toHaveBeenCalledWith(
          'https://whatsapp-sidecar.example.com/api/v1/session/qrcode',
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              Authorization: 'Bearer qr-secret-123',
            }),
          }),
        );
      });

      it('returns null when sidecar returns non-ok status', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'qr-secret-123';

        global.fetch = jest.fn().mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ error: 'Unauthorized' }),
        } as Response);

        const service = new WhatsAppService();
        const qr = await service.getQRCode();
        expect(qr).toBeNull();
      });

      it('returns null when fetch throws', async () => {
        process.env.WHATSAPP_FALLBACK_URL = 'https://whatsapp-sidecar.example.com';
        process.env.WHATSAPP_FALLBACK_SECRET = 'qr-secret-123';

        global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network failure'));

        const service = new WhatsAppService();
        const qr = await service.getQRCode();
        expect(qr).toBeNull();
      });
    });
  });

  describe('getWhatsAppService singleton', () => {
    it('returns the same WhatsAppService instance across calls', () => {
      const s1 = getWhatsAppService();
      const s2 = getWhatsAppService();
      expect(s1).toBeInstanceOf(WhatsAppService);
      expect(s1).toBe(s2);
    });
  });
});
