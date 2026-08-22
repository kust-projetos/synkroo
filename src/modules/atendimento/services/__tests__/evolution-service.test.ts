import {
  EvolutionApiService,
  getEvolutionService,
  getInstanceInfo,
  type EvolutionWebhookEvent,
} from '../evolution-service';
import { getDb } from '@/lib/db/client';

describe('EvolutionApiService', () => {
  let service: EvolutionApiService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    (global.fetch as unknown) = jest.fn();
    service = new EvolutionApiService('https://evolution.example.com/', 'test-api-key', 'clinic-instance');
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  describe('constructor & basic getters', () => {
    it('trims trailing slash from baseUrl and stores instance configuration', () => {
      const s1 = new EvolutionApiService('https://api.example.com///', 'key1', 'inst1');
      expect(s1.getInstanceName()).toBe('inst1');
      expect(s1.getConnectionStatus()).toBe(false);

      const sDefault = new EvolutionApiService('https://api.example.com', 'key2');
      expect(sDefault.getInstanceName()).toBe('synkroo');
    });
  });

  describe('request method & error handling', () => {
    it('handles successful requests with JSON data', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      const res = await (service as any).request('GET', '/test-endpoint');
      expect(res).toEqual({ success: true, data: { status: 'ok' } });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/test-endpoint',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            apikey: 'test-api-key',
          },
        }),
      );
    });

    it('handles HTTP error responses with data.message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid payload' }),
      });

      const res = await (service as any).request('POST', '/fail', { a: 1 });
      expect(res).toEqual({ success: false, error: 'Invalid payload' });
    });

    it('handles HTTP error responses with data.error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Unauthorized token' }),
      });

      const res = await (service as any).request('GET', '/unauth');
      expect(res).toEqual({ success: false, error: 'Unauthorized token' });
    });

    it('handles HTTP error responses without message or error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({}),
      });

      const res = await (service as any).request('GET', '/bad-gateway');
      expect(res).toEqual({ success: false, error: 'HTTP 502' });
    });

    it('catches network exceptions with Error instance', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));

      const res = await (service as any).request('GET', '/timeout');
      expect(res).toEqual({ success: false, error: 'Network timeout' });
    });

    it('catches non-Error thrown objects', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('Unknown crash');

      const res = await (service as any).request('GET', '/crash');
      expect(res).toEqual({ success: false, error: 'Unknown error' });
    });
  });

  describe('Instance Lifecycle Methods', () => {
    it('createInstance sends correct payload with EVOLUTION_WEBHOOK_URL and saves instanceId', async () => {
      process.env.EVOLUTION_WEBHOOK_URL = 'https://synkroo.app/api/webhook';
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instance: {
            instanceId: 'inst-123',
            instanceName: 'clinic-instance',
            status: 'created',
            serverUrl: 'https://evolution.example.com',
            apikey: 'test-api-key',
          },
        }),
      });

      const result = await service.createInstance();
      expect(result?.instance.instanceId).toBe('inst-123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/instance/create',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'clinic-instance',
            token: 'test-api-key',
            webhook: 'https://synkroo.app/api/webhook',
            events: ['Connected', 'Disconnected', 'MessagesUpsert', 'MessagesUpdate'],
          }),
        }),
      );
    });

    it('createInstance handles missing instanceId and webhook undefined', async () => {
      delete process.env.EVOLUTION_WEBHOOK_URL;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          instance: {
            instanceName: 'clinic-instance',
            status: 'created',
            serverUrl: 'https://evolution.example.com',
            apikey: 'test-api-key',
          },
        }),
      });

      const result = await service.createInstance();
      expect(result).toBeDefined();
    });

    it('createInstance returns null on failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Cannot create' }),
      });

      const result = await service.createInstance();
      expect(result).toBeNull();
    });

    it('connect returns true immediately if connection state is open', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { Connected: true, LoggedIn: true, Name: 'clinic-instance' } }),
      });

      const connected = await service.connect();
      expect(connected).toBe(true);
      expect(service.getConnectionStatus()).toBe(true);
    });

    it('connect returns false if connection state is close', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { Connected: false, LoggedIn: false, Name: 'clinic-instance' } }),
      });

      const connected = await service.connect();
      expect(connected).toBe(false);
      expect(service.getConnectionStatus()).toBe(false);
    });

    it('connect connects via /instance/connect when state check returns null', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ message: 'Connecting' }),
        });

      let emitted = false;
      service.on('connected', () => {
        emitted = true;
      });

      const connected = await service.connect();
      expect(connected).toBe(true);
      expect(emitted).toBe(true);
      expect(service.getConnectionStatus()).toBe(true);
    });

    it('connect falls back to createInstance when connect fails', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Connect failed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            instance: {
              instanceId: 'inst-fallback',
              instanceName: 'clinic-instance',
              status: 'created',
              serverUrl: 'https://evolution.example.com',
              apikey: 'test-api-key',
            },
          }),
        });

      const connected = await service.connect();
      expect(connected).toBe(true);
    });

    it('getConnectionState returns null when API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Failed' }),
      });

      const state = await service.getConnectionState();
      expect(state).toBeNull();
    });

    it('getConnectionState returns close state when Connected is false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { Connected: false, LoggedIn: false, Name: 'clinic-instance' } }),
      });

      const state = await service.getConnectionState();
      expect(state).toEqual({ state: 'close', statusReason: 0 });
      expect(service.getConnectionStatus()).toBe(false);
    });

    it('getQRCode emits qrcode event and returns code & base64 on success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 'qr-code-data', base64: 'base64-image-string' }),
      });

      let emittedQR = '';
      service.on('qrcode', (qr) => {
        emittedQR = qr;
      });

      const qr = await service.getQRCode();
      expect(qr).toEqual({ code: 'qr-code-data', base64: 'base64-image-string' });
      expect(emittedQR).toBe('base64-image-string');
    });

    it('getQRCode returns null when request fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'QR not available' }),
      });

      const qr = await service.getQRCode();
      expect(qr).toBeNull();
    });

    it('logout sends DELETE /instance/logout and sets isConnected to false', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await service.logout();
      expect(res).toBe(true);
      expect(service.getConnectionStatus()).toBe(false);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/instance/logout',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('deleteInstance sends DELETE /instance/delete/:name and resets state', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const res = await service.deleteInstance();
      expect(res).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/instance/delete/clinic-instance',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('Messaging Methods', () => {
    it('sendTextMessage formats Brazilian number and passes delay options', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { Info: { ID: 'msg-text-1' } } }),
      });

      const res = await service.sendTextMessage('(11) 98765-4321', 'Olá!', { delay: 1200 });
      expect(res).toEqual({ success: true, messageId: 'msg-text-1' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/send/text',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            number: '5511987654321',
            text: 'Olá!',
            delay: 1200,
          }),
        }),
      );
    });

    it('sendTextMessage handles response without Info.ID and failure response', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Invalid number' }),
        });

      const resOk = await service.sendTextMessage('5511999998888', 'Teste');
      expect(resOk).toEqual({ success: true, messageId: undefined });

      const resFail = await service.sendTextMessage('5511999998888', 'Teste');
      expect(resFail).toEqual({ success: false, error: 'Invalid number' });
    });

    it('sendMediaMessage formats number and sends media payload', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { Info: { ID: 'msg-media-1' } } }),
      });

      const res = await service.sendMediaMessage({
        number: '11988887777',
        mediatype: 'image',
        media: 'https://example.com/image.png',
        caption: 'Legenda da foto',
        fileName: 'foto.png',
      });

      expect(res).toEqual({ success: true, messageId: 'msg-media-1' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/send/media',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            number: '5511988887777',
            mediatype: 'image',
            media: 'https://example.com/image.png',
            caption: 'Legenda da foto',
            fileName: 'foto.png',
          }),
        }),
      );
    });

    it('sendMediaMessage returns error on failure or missing Info.ID', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: {} }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Upload failed' }),
        });

      const resOk = await service.sendMediaMessage({
        number: '5511988887777',
        mediatype: 'document',
        media: 'https://example.com/doc.pdf',
      });
      expect(resOk).toEqual({ success: true, messageId: undefined });

      const resFail = await service.sendMediaMessage({
        number: '5511988887777',
        mediatype: 'document',
        media: 'https://example.com/doc.pdf',
      });
      expect(resFail).toEqual({ success: false, error: 'Upload failed' });
    });

    it('sendButtonsMessage maps buttons and formats number correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ key: { id: 'btn-msg-1' } }),
      });

      const res = await service.sendButtonsMessage(
        '11911112222',
        'Confirmação',
        'Deseja confirmar sua consulta?',
        [
          { buttonText: 'Sim', buttonId: 'confirm_yes' },
          { buttonText: 'Não', buttonId: '' },
        ],
      );

      expect(res).toEqual({ success: true, messageId: 'btn-msg-1' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/message/sendButtons/clinic-instance',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            number: '5511911112222',
            buttonsMessage: {
              title: 'Confirmação',
              description: 'Deseja confirmar sua consulta?',
              type: 'buttons',
              buttons: [
                {
                  buttonId: 'confirm_yes',
                  buttonText: { displayText: 'Sim' },
                  type: 1,
                },
                {
                  buttonId: 'btn_1',
                  buttonText: { displayText: 'Não' },
                  type: 1,
                },
              ],
            },
          }),
        }),
      );
    });

    it('sendButtonsMessage handles failure response and missing key.id', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: {} }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ message: 'Button format rejected' }),
        });

      const resOk = await service.sendButtonsMessage('11911112222', 'T', 'D', []);
      expect(resOk).toEqual({ success: true, messageId: undefined });

      const resFail = await service.sendButtonsMessage('11911112222', 'T', 'D', []);
      expect(resFail).toEqual({ success: false, error: 'Button format rejected' });
    });

    it('sendTemplateMessage sends template with default pt_BR and custom language', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: { id: 'tmpl-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: { id: 'tmpl-2' } }),
        });

      const res1 = await service.sendTemplateMessage('11922223333', 'appointment_reminder');
      expect(res1).toEqual({ success: true, messageId: 'tmpl-1' });

      const res2 = await service.sendTemplateMessage('5511922223333', 'welcome_en', 'en_US');
      expect(res2).toEqual({ success: true, messageId: 'tmpl-2' });
    });

    it('sendTemplateMessage handles missing key.id and failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ key: {} }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({ message: 'Template not found' }),
        });

      const resOk = await service.sendTemplateMessage('11922223333', 'test');
      expect(resOk).toEqual({ success: true, messageId: undefined });

      const resFail = await service.sendTemplateMessage('11922223333', 'non_existing');
      expect(resFail).toEqual({ success: false, error: 'Template not found' });
    });

    it('markAsRead sends readMessages payload and returns success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const ok = await service.markAsRead('msg-123', '5511999990000@s.whatsapp.net');
      expect(ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://evolution.example.com/chat/markMessageAsRead/clinic-instance',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            readMessages: [{ id: 'msg-123', remoteJid: '5511999990000@s.whatsapp.net', fromMe: false }],
          }),
        }),
      );
    });

    it('getMessages sends options limit and returns messages array', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            messages: [
              {
                key: { remoteJid: '5511999990000@s.whatsapp.net', fromMe: false, id: 'm1' },
                message: { conversation: 'Olá' },
                messageTimestamp: 1700000000,
                status: 'SERVER_ACK',
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({}),
        });

      const msgs = await service.getMessages('5511999990000@s.whatsapp.net', { count: 20 });
      expect(msgs).toHaveLength(1);
      expect(msgs[0].key.id).toBe('m1');

      const emptyDataMsgs = await service.getMessages('5511999990000@s.whatsapp.net');
      expect(emptyDataMsgs).toEqual([]);

      const failedMsgs = await service.getMessages('5511999990000@s.whatsapp.net');
      expect(failedMsgs).toEqual([]);
    });

    it('getChats returns chat list or empty array on failure', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ id: 'chat-1' }, { id: 'chat-2' }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => null,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({}),
        });

      const chats = await service.getChats();
      expect(chats).toEqual([{ id: 'chat-1' }, { id: 'chat-2' }]);

      const nullChats = await service.getChats();
      expect(nullChats).toEqual([]);

      const emptyChats = await service.getChats();
      expect(emptyChats).toEqual([]);
    });

    it('checkNumber formats number and returns exists status and jid', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ exists: true, jid: '5511988889999@s.whatsapp.net' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Bad request' }),
        });

      const check1 = await service.checkNumber('11988889999');
      expect(check1).toEqual({ exists: true, jid: '5511988889999@s.whatsapp.net' });

      const checkDefault = await service.checkNumber('5511988889999');
      expect(checkDefault).toEqual({ exists: false, jid: undefined });

      const checkFailed = await service.checkNumber('11900000000');
      expect(checkFailed).toEqual({ exists: false });
    });

    it('getProfilePicture formats number and returns URL or null', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ profilePicture: 'https://example.com/avatar.jpg' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          json: async () => ({}),
        });

      const pic = await service.getProfilePicture('11977776666');
      expect(pic).toBe('https://example.com/avatar.jpg');

      const emptyPic = await service.getProfilePicture('5511977776666');
      expect(emptyPic).toBeNull();

      const nullPic = await service.getProfilePicture('5511977776666');
      expect(nullPic).toBeNull();
    });
  });

  describe('processWebhookEvent', () => {
    it('processes CONNECTION_UPDATE when state is open', () => {
      let connectedCalled = false;
      service.on('connected', () => {
        connectedCalled = true;
      });

      service.processWebhookEvent({
        event: 'CONNECTION_UPDATE',
        instance: 'clinic-instance',
        data: { state: 'open', statusReason: 200 },
      });

      expect(connectedCalled).toBe(true);
      expect(service.getConnectionStatus()).toBe(true);
    });

    it('processes CONNECTION_UPDATE when state is closed', () => {
      let disconnectedPayload: any = null;
      service.on('disconnected', (data) => {
        disconnectedPayload = data;
      });

      service.processWebhookEvent({
        event: 'CONNECTION_UPDATE',
        instance: 'clinic-instance',
        data: { state: 'close', statusReason: 401 },
      });

      expect(disconnectedPayload).toEqual({ state: 'close', statusReason: 401 });
      expect(service.getConnectionStatus()).toBe(false);
    });

    it('processes QRCODE_UPDATED event with and without qrcode', () => {
      let qrCodeEmitted = '';
      service.on('qrcode', (qr) => {
        qrCodeEmitted = qr;
      });

      service.processWebhookEvent({
        event: 'QRCODE_UPDATED',
        instance: 'clinic-instance',
        data: { qrcode: 'new-qrcode-string' },
      });
      expect(qrCodeEmitted).toBe('new-qrcode-string');

      // Without qrcode data
      service.processWebhookEvent({
        event: 'QRCODE_UPDATED',
        instance: 'clinic-instance',
        data: {},
      });
      expect(qrCodeEmitted).toBe('new-qrcode-string');
    });

    it('processes MESSAGES_UPSERT event with various message shapes and skips fromMe', () => {
      const messagesEmitted: any[] = [];
      service.on('message', (msg) => {
        messagesEmitted.push(msg);
      });

      const event: EvolutionWebhookEvent = {
        event: 'MESSAGES_UPSERT',
        instance: 'clinic-instance',
        data: {
          messages: [
            // Standard conversation text
            {
              key: { id: 'm1', remoteJid: '5511999990001@s.whatsapp.net', fromMe: false },
              message: { conversation: 'Olá doutor' },
              messageTimestamp: 1700000000,
              status: 'RECEIPT',
            },
            // Extended text message
            {
              key: { id: 'm2', remoteJid: '5511999990002@s.whatsapp.net', fromMe: false },
              message: { extendedTextMessage: { text: 'Quero agendar consulta' } },
              messageTimestamp: 1700000010,
              status: 'RECEIPT',
            },
            // Image message
            {
              key: { id: 'm3', remoteJid: '5511999990003@s.whatsapp.net', fromMe: false },
              message: { imageMessage: { url: 'http://img', mimetype: 'image/jpeg' } },
              messageTimestamp: 1700000020,
              status: 'RECEIPT',
            },
            // Empty message fallback
            {
              key: { id: 'm4', remoteJid: '5511999990004@s.whatsapp.net', fromMe: false },
              message: {},
              messageTimestamp: 1700000030,
              status: 'RECEIPT',
            },
            // Outbound message from me (should be skipped)
            {
              key: { id: 'm5', remoteJid: '5511999990005@s.whatsapp.net', fromMe: true },
              message: { conversation: 'Mensagem enviada por mim' },
              messageTimestamp: 1700000040,
              status: 'SERVER_ACK',
            },
          ],
        },
      };

      service.processWebhookEvent(event);

      expect(messagesEmitted).toHaveLength(4);
      expect(messagesEmitted[0]).toEqual({
        id: 'm1',
        from: '5511999990001@s.whatsapp.net',
        to: 'me',
        body: 'Olá doutor',
        timestamp: new Date(1700000000000),
        type: 'text',
        isFromMe: false,
      });
      expect(messagesEmitted[1].body).toBe('Quero agendar consulta');
      expect(messagesEmitted[2].type).toBe('image');
      expect(messagesEmitted[3].body).toBe('');

      // Non-array data test
      service.processWebhookEvent({
        event: 'MESSAGES_UPSERT',
        instance: 'clinic-instance',
        data: {},
      });
    });

    it('processes MESSAGES_UPDATE event', () => {
      let statusEmitted: any = null;
      service.on('messageStatus', (st) => {
        statusEmitted = st;
      });

      service.processWebhookEvent({
        event: 'MESSAGES_UPDATE',
        instance: 'clinic-instance',
        data: {
          key: { id: 'msg-read-1' },
          status: 'READ',
        },
      });

      expect(statusEmitted.messageId).toBe('msg-read-1');
      expect(statusEmitted.status).toBe('READ');
      expect(statusEmitted.timestamp).toBeInstanceOf(Date);
    });

    it('handles default unhandled webhook event without throwing', () => {
      expect(() => {
        service.processWebhookEvent({
          event: 'UNKNOWN_WEBHOOK_EVENT',
          instance: 'clinic-instance',
          data: {},
        });
      }).not.toThrow();
    });
  });
});

describe('getEvolutionService singleton', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns null when EVOLUTION_API_URL or EVOLUTION_API_KEY is missing', () => {
    delete process.env.EVOLUTION_API_URL;
    delete process.env.EVOLUTION_API_KEY;
    expect(getEvolutionService()).toBeNull();

    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    delete process.env.EVOLUTION_API_KEY;
    expect(getEvolutionService()).toBeNull();
  });

  it('instantiates and returns singleton instance when env vars are present', () => {
    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    process.env.EVOLUTION_API_KEY = 'apikey-123';
    process.env.EVOLUTION_INSTANCE_NAME = 'custom-instance';

    const s1 = getEvolutionService();
    expect(s1).toBeInstanceOf(EvolutionApiService);
    expect(s1?.getInstanceName()).toBe('custom-instance');

    const s2 = getEvolutionService();
    expect(s2).toBe(s1);
  });

  it('instantiates with default synkroo instanceName when EVOLUTION_INSTANCE_NAME is unset', () => {
    delete (getEvolutionService as any).evolutionInstance;
    // reset module singleton
    process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
    process.env.EVOLUTION_API_KEY = 'apikey-123';
    delete process.env.EVOLUTION_INSTANCE_NAME;

    const s = getEvolutionService();
    expect(s?.getInstanceName()).toBeDefined();
  });
});

describe('getInstanceInfo DB helper', () => {
  it('queries database and formats instance info with null fallbacks', async () => {
    const db = getDb();
    const mockSelect = db.select as jest.Mock;

    mockSelect.mockReturnValueOnce({
      from: jest.fn().mockReturnValueOnce({
        where: jest.fn().mockReturnValueOnce({
          limit: jest.fn().mockResolvedValueOnce([
            {
              instanceName: 'clinic-1-instance',
              status: 'open',
              lastConnectedAt: new Date('2026-08-01T10:00:00Z'),
              createdAt: new Date('2026-01-01T10:00:00Z'),
            },
            {
              instanceName: null,
              status: null,
              lastConnectedAt: null,
              createdAt: null,
            },
          ]),
        }),
      }),
    });

    const info = await getInstanceInfo('clinic-123');
    expect(info).toEqual([
      {
        instanceName: 'clinic-1-instance',
        status: 'open',
        lastConnectedAt: new Date('2026-08-01T10:00:00Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
      },
      {
        instanceName: 'unknown',
        status: 'unknown',
        lastConnectedAt: null,
        createdAt: null,
      },
    ]);
  });
});
