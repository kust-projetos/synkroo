/**
 * Unit Test Suite for channel-service.ts (src/modules/atendimento/services/channel-service.ts)
 *
 * Covers:
 * 1. Provider detection & sendWhatsAppMessage facade (Evolution, Playwright, Business-API, fallback)
 * 2. sendByChannel dispatching (whatsapp, instagram, web)
 * 3. sendWhatsApp error handling (null evolution, Error throw, string throw)
 * 4. sendInstagram validation & network flow (missing envs, success, HTTP failure, network rejection)
 * 5. WhatsAppService lifecycle (initialize logged in vs QR code, QR scan timeout, extract phone, message listener)
 * 6. WhatsAppService methods (constructor, isConnected, getSession, getQRCode, disconnect, sendMessage)
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
import QRCode from 'qrcode-terminal';

// ─── Mocks ─────────────────────────────────────────────────────

const mockLaunchPersistentContext = jest.fn();
jest.mock('playwright', () => ({
  chromium: {
    launchPersistentContext: (...args: any[]) => mockLaunchPersistentContext(...args),
  },
}));

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

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn((_url, _opts, cb) => {
    if (typeof cb === 'function') cb('mock-ascii-qr');
  }),
}));

const mockEvolution = getEvolutionService as jest.MockedFunction<typeof getEvolutionService>;

describe('channel-service unit tests', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const activeIntervals: NodeJS.Timeout[] = [];

  beforeAll(() => {
    const originalSetInterval = global.setInterval;
    jest.spyOn(global, 'setInterval').mockImplementation(((callback: any, ms?: number, ...args: any[]) => {
      const interval = originalSetInterval(callback, ms, ...args);
      activeIntervals.push(interval);
      return interval;
    }) as any);
  });

  afterAll(() => {
    (global.setInterval as unknown as jest.Mock).mockRestore();
  });

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
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    activeIntervals.forEach((id) => clearInterval(id));
    activeIntervals.length = 0;
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

    it('uses playwright provider when no API env vars are set and WhatsAppService is connected', async () => {
      const service = getWhatsAppService();
      (service as any)._isConnected = true;
      const sendSpy = jest.spyOn(service, 'sendMessage').mockResolvedValue({
        success: true,
        messageId: 'pw-123',
      });

      const res = await sendWhatsAppMessage('5511999999999', 'Olá via Playwright');
      expect(res).toEqual({ success: true, messageId: 'pw-123' });
      expect(sendSpy).toHaveBeenCalledWith('5511999999999', 'Olá via Playwright');
    });

    it('returns error when playwright provider is default but WhatsAppService is disconnected', async () => {
      const service = getWhatsAppService();
      (service as any)._isConnected = false;

      const res = await sendWhatsAppMessage('5511999999999', 'Olá');
      expect(res).toEqual({ success: false, error: 'No WhatsApp provider available' });
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
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer tok-456',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: 'recipient-1' },
            message: { text: 'Mensagem Instagram' },
          }),
        },
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

  describe('WhatsAppService class methods & browser automation', () => {
    it('initializes with default session path and returns initial session state', () => {
      const service = new WhatsAppService();
      expect(service.isConnected).toBe(false);
      expect(service.getQRCode()).toBeNull();

      const session = service.getSession();
      expect(session.isConnected).toBe(false);
      expect(session.phoneNumber).toBeNull();
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    it('initializes with custom session path', () => {
      const service = new WhatsAppService('/custom/session/path');
      expect((service as any).sessionPath).toBe('/custom/session/path');
    });

    it('disconnects and closes browser context if present, emitting disconnected', async () => {
      const service = new WhatsAppService();
      const mockContext = { close: jest.fn().mockResolvedValue(undefined) };
      (service as any).context = mockContext;
      (service as any)._isConnected = true;

      const disconnectedListener = jest.fn();
      service.on('disconnected', disconnectedListener);

      await service.disconnect();

      expect(mockContext.close).toHaveBeenCalledTimes(1);
      expect(service.isConnected).toBe(false);
      expect(disconnectedListener).toHaveBeenCalledTimes(1);
    });

    it('disconnects cleanly when context is null', async () => {
      const service = new WhatsAppService();
      (service as any).context = null;
      (service as any)._isConnected = true;

      await service.disconnect();
      expect(service.isConnected).toBe(false);
    });

    describe('initialize lifecycle', () => {
      it('initializes and detects already logged in status', async () => {
        const service = new WhatsAppService();
        const connectedListener = jest.fn();
        service.on('connected', connectedListener);

        const mockPage = {
          goto: jest.fn().mockResolvedValue(undefined),
          $: jest.fn().mockImplementation(async (sel: string) => {
            if (sel === '[data-testid="chat-list"]') return {};
            return null;
          }),
          $$: jest.fn().mockResolvedValue([]),
        };

        const mockContext = {
          newPage: jest.fn().mockResolvedValue(mockPage),
        };

        mockLaunchPersistentContext.mockResolvedValueOnce(mockContext);

        await service.initialize();

        expect(mockLaunchPersistentContext).toHaveBeenCalledWith(
          './.whatsapp-session',
          expect.objectContaining({ headless: false }),
        );
        expect(mockPage.goto).toHaveBeenCalledWith('https://web.whatsapp.com', { waitUntil: 'networkidle' });
        expect(service.isConnected).toBe(true);
        expect(connectedListener).toHaveBeenCalled();
        expect(dbLogger.info).toHaveBeenCalledWith('channel-service: WhatsApp already connected');
      });

      it('initializes with QR code scan flow when not initially logged in', async () => {
        process.env.WHATSAPP_HEADLESS = 'true';
        const service = new WhatsAppService('./custom-sess');
        const qrcodeListener = jest.fn();
        const connectedListener = jest.fn();
        service.on('qrcode', qrcodeListener);
        service.on('connected', connectedListener);

        let chatListFound = false;
        const mockCanvas = {
          evaluate: jest.fn().mockImplementation((fn: any) => {
            if (typeof fn === 'function') {
              return fn({ toDataURL: () => 'data:image/png;base64,mockqrdata' });
            }
            return 'data:image/png;base64,mockqrdata';
          }),
        };

        const mockProfileBtn = { click: jest.fn().mockResolvedValue(undefined) };
        const mockPhoneElem = { getAttribute: jest.fn().mockResolvedValue('+55 11 98888 7777') };

        const mockPage = {
          goto: jest.fn().mockResolvedValue(undefined),
          $: jest.fn().mockImplementation(async (sel: string) => {
            if (sel === '[data-testid="chat-list"]') return chatListFound ? {} : null;
            if (sel === 'canvas[alt="Scan this QR code to link a device!"]') return mockCanvas;
            if (sel === '[data-testid="menu-bar"] button[aria-label]') return mockProfileBtn;
            if (sel === 'span[title*="+"]') return mockPhoneElem;
            return null;
          }),
          $$: jest.fn().mockResolvedValue([]),
          waitForSelector: jest.fn().mockImplementation(async (sel: string) => {
            if (sel === '[data-testid="chat-list"]') {
              chatListFound = true;
            }
            return {};
          }),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
          keyboard: { press: jest.fn().mockResolvedValue(undefined) },
        };

        const mockContext = {
          newPage: jest.fn().mockResolvedValue(mockPage),
        };

        mockLaunchPersistentContext.mockResolvedValueOnce(mockContext);

        await service.initialize();

        expect(QRCode.generate).toHaveBeenCalledWith(
          'data:image/png;base64,mockqrdata',
          { small: true },
          expect.any(Function),
        );
        expect(qrcodeListener).toHaveBeenCalledWith('data:image/png;base64,mockqrdata');
        expect(service.isConnected).toBe(true);
        expect(service.getSession().phoneNumber).toBe('+5511988887777');
        expect(connectedListener).toHaveBeenCalled();
      });

      it('emits error and throws when QR code scan times out', async () => {
        const service = new WhatsAppService();
        const errorListener = jest.fn();
        service.on('error', errorListener);

        const mockPage = {
          goto: jest.fn().mockResolvedValue(undefined),
          $: jest.fn().mockResolvedValue(null),
          waitForSelector: jest.fn().mockImplementation(async (sel: string) => {
            if (sel === 'canvas[alt="Scan this QR code to link a device!"]') return {};
            if (sel === '[data-testid="chat-list"]') throw new Error('Timeout');
            return null;
          }),
          $$: jest.fn().mockResolvedValue([]),
        };

        const mockContext = {
          newPage: jest.fn().mockResolvedValue(mockPage),
        };

        mockLaunchPersistentContext.mockResolvedValueOnce(mockContext);

        await expect(service.initialize()).rejects.toThrow('Timeout waiting for QR code scan');
        expect(errorListener).toHaveBeenCalledWith(expect.any(Error));
      });
    });

    describe('private helper branch coverage', () => {
      it('checkLoginStatus returns false when page is null or throws', async () => {
        const service = new WhatsAppService();
        (service as any).page = null;
        expect(await (service as any).checkLoginStatus()).toBe(false);

        (service as any).page = {
          $: jest.fn().mockRejectedValue(new Error('Page crashed')),
        };
        expect(await (service as any).checkLoginStatus()).toBe(false);
      });

      it('waitForQRCode returns early when page is null', async () => {
        const service = new WhatsAppService();
        (service as any).page = null;
        await expect((service as any).waitForQRCode()).resolves.toBeUndefined();
      });

      it('getCurrentChatPhone handles missing page, title element, and exceptions', async () => {
        const service = new WhatsAppService();
        (service as any).page = null;
        expect(await (service as any).getCurrentChatPhone()).toBe('');

        (service as any).page = {
          $: jest.fn().mockResolvedValue({ getAttribute: jest.fn().mockResolvedValue('+5511999999999') }),
        };
        expect(await (service as any).getCurrentChatPhone()).toBe('+5511999999999');

        (service as any).page = {
          $: jest.fn().mockResolvedValue({ getAttribute: jest.fn().mockResolvedValue(null) }),
        };
        expect(await (service as any).getCurrentChatPhone()).toBe('');

        (service as any).page = {
          $: jest.fn().mockRejectedValue(new Error('Crash')),
        };
        expect(await (service as any).getCurrentChatPhone()).toBe('');
      });

      it('extractPhoneNumber handles null page, missing elements, and exceptions', async () => {
        const service = new WhatsAppService();
        (service as any).page = null;
        await (service as any).extractPhoneNumber();
        expect(service.getSession().phoneNumber).toBeNull();

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        (service as any).page = {
          $: jest.fn().mockRejectedValue(new Error('Crash')),
        };
        await (service as any).extractPhoneNumber();
        expect(consoleSpy).toHaveBeenCalledWith('Error extracting phone number:', expect.any(Error));

        consoleSpy.mockRestore();
      });

      it('startMessageListener returns early when page is null or service is disconnected', () => {
        const service = new WhatsAppService();
        (service as any).page = null;
        (service as any).startMessageListener();

        (service as any).page = {};
        (service as any)._isConnected = false;
        // Interval created but inside interval check returns early
        (service as any).startMessageListener();
      });

      it('startMessageListener processes messages and exercises element evaluation callback', async () => {
        jest.useFakeTimers();
        const service = new WhatsAppService();
        (service as any)._isConnected = true;

        const messageListener = jest.fn();
        service.on('message', messageListener);

        const mockChat = { click: jest.fn().mockResolvedValue(undefined) };
        const mockPage = {
          $$: jest.fn().mockResolvedValue([mockChat]),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
          $$eval: jest.fn().mockImplementation((_sel: string, callback: (elems: any[]) => any) => {
            const rawElems = [
              {
                getAttribute: (attr: string) => (attr === 'data-id' ? 'msg-in-1' : null),
                textContent: 'Olá Dr.',
                closest: () => ({ classList: { contains: (cls: string) => cls === 'message-out' && false } }),
              },
              {
                getAttribute: () => '',
                textContent: '',
                closest: () => null,
              },
              {
                getAttribute: (attr: string) => (attr === 'data-id' ? 'msg-out-2' : null),
                textContent: 'Resposta Dr.',
                closest: () => ({ classList: { contains: (cls: string) => cls === 'message-out' } }),
              },
            ];
            return callback(rawElems);
          }),
          $: jest.fn().mockResolvedValue({
            getAttribute: jest.fn().mockResolvedValue('+5511988880000'),
          }),
        };

        (service as any).page = mockPage;
        (service as any).startMessageListener();

        // Advance timer to trigger interval
        await jest.advanceTimersByTimeAsync(5000);

        expect(mockChat.click).toHaveBeenCalled();
        expect(messageListener).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'msg-in-1',
            from: '+5511988880000',
            to: 'me',
            body: 'Olá Dr.',
            isFromMe: false,
          }),
        );
        // Outgoing message should not be emitted, but elements with isFromMe=false are emitted
        expect(messageListener).toHaveBeenCalledTimes(2);

        // Test branch where _isConnected becomes false during interval
        (service as any)._isConnected = false;
        await jest.advanceTimersByTimeAsync(5000);
        // Count should remain 2
        expect(messageListener).toHaveBeenCalledTimes(2);

        jest.useRealTimers();
      });

      it('startMessageListener logs error when checking messages throws', async () => {
        jest.useFakeTimers();
        const service = new WhatsAppService();
        (service as any)._isConnected = true;

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const mockPage = {
          $$: jest.fn().mockRejectedValue(new Error('DOM query failed')),
        };

        (service as any).page = mockPage;
        (service as any).startMessageListener();

        await jest.advanceTimersByTimeAsync(5000);

        expect(consoleSpy).toHaveBeenCalledWith('Error checking messages:', expect.any(Error));
        consoleSpy.mockRestore();
        jest.useRealTimers();
      });
    });

    describe('sendMessage', () => {
      it('returns { success: false } when page or isConnected is false', async () => {
        const service = new WhatsAppService();
        (service as any).page = null;
        (service as any)._isConnected = false;

        const res1 = await service.sendMessage('11999999999', 'Oi');
        expect(res1).toEqual({ success: false });

        (service as any).page = {};
        (service as any)._isConnected = false;
        const res2 = await service.sendMessage('11999999999', 'Oi');
        expect(res2).toEqual({ success: false });
      });

      it('successfully sends message when contactResult is found', async () => {
        const service = new WhatsAppService();
        (service as any)._isConnected = true;

        const mockSearchInput = { fill: jest.fn().mockResolvedValue(undefined) };
        const mockContactResult = { click: jest.fn().mockResolvedValue(undefined) };
        const mockMessageInput = { fill: jest.fn().mockResolvedValue(undefined) };

        const mockPage = {
          $: jest.fn().mockImplementation(async (selector: string) => {
            if (selector === '[data-testid="chat-list-search"]') return mockSearchInput;
            if (selector === '[title="11999999999"]') return mockContactResult;
            if (selector === '[data-testid="conversation-compose-box-input"]') return mockMessageInput;
            return null;
          }),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
          waitForSelector: jest.fn().mockResolvedValue(undefined),
          keyboard: { press: jest.fn().mockResolvedValue(undefined) },
        };

        (service as any).page = mockPage;

        const res = await service.sendMessage('11999999999', 'Mensagem enviada com sucesso');

        expect(mockSearchInput.fill).toHaveBeenCalledWith('11999999999');
        expect(mockContactResult.click).toHaveBeenCalled();
        expect(mockMessageInput.fill).toHaveBeenCalledWith('Mensagem enviada com sucesso');
        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
        expect(res.success).toBe(true);
        expect(res.messageId).toBeDefined();
      });

      it('successfully sends message pressing Enter when contactResult is not found in search', async () => {
        const service = new WhatsAppService();
        (service as any)._isConnected = true;

        const mockSearchInput = { fill: jest.fn().mockResolvedValue(undefined) };
        const mockMessageInput = { fill: jest.fn().mockResolvedValue(undefined) };

        const mockPage = {
          $: jest.fn().mockImplementation(async (selector: string) => {
            if (selector === '[data-testid="chat-list-search"]') return mockSearchInput;
            if (selector === '[title="11999999999"]') return null; // not found
            if (selector === '[data-testid="conversation-compose-box-input"]') return mockMessageInput;
            return null;
          }),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
          waitForSelector: jest.fn().mockResolvedValue(undefined),
          keyboard: { press: jest.fn().mockResolvedValue(undefined) },
        };

        (service as any).page = mockPage;

        const res = await service.sendMessage('11999999999', 'Mensagem sem contato prévio');

        expect(mockPage.keyboard.press).toHaveBeenCalledWith('Enter');
        expect(res.success).toBe(true);
      });

      it('returns { success: false } when search input is not found', async () => {
        const service = new WhatsAppService();
        (service as any)._isConnected = true;

        const mockPage = {
          $: jest.fn().mockResolvedValue(null),
          waitForTimeout: jest.fn(),
          waitForSelector: jest.fn(),
          keyboard: { press: jest.fn() },
        };

        (service as any).page = mockPage;
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await service.sendMessage('11999999999', 'Oi');
        expect(res).toEqual({ success: false });
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it('returns { success: false } when message input is not found', async () => {
        const service = new WhatsAppService();
        (service as any)._isConnected = true;

        const mockSearchInput = { fill: jest.fn().mockResolvedValue(undefined) };

        const mockPage = {
          $: jest.fn().mockImplementation(async (selector: string) => {
            if (selector === '[data-testid="chat-list-search"]') return mockSearchInput;
            return null; // message input is null
          }),
          waitForTimeout: jest.fn().mockResolvedValue(undefined),
          waitForSelector: jest.fn().mockResolvedValue(undefined),
          keyboard: { press: jest.fn().mockResolvedValue(undefined) },
        };

        (service as any).page = mockPage;
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        const res = await service.sendMessage('11999999999', 'Oi');
        expect(res).toEqual({ success: false });
        consoleSpy.mockRestore();
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
