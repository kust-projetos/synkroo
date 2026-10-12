/**
 * Tests for send-message-service.
 *
 * Verifies that send-message-service delegates WhatsApp to channel-service
 * while preserving its Instagram and Web contracts, including:
 *   - WhatsApp delivery via Evolution (success path)
 *   - E4 anti-duplicate-send: ambiguous Evolution failure (success:false /
 *     throw) does NOT fail over to the sidecar — returns delivery 'unknown'
 *   - Fail-closed behavior when Evolution is unavailable / sidecar not configured
 *   - Instagram and Web channel contracts
 */

import { sendByChannel, sendWhatsApp, sendInstagram } from '../send-message-service';
import * as evolutionModule from '../evolution-service';
import { dbLogger } from '@/lib/logger';

// Mock logger
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('send-message-service delegation & failover', () => {
  const originalEnv = process.env;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });
  afterAll(() => {
    process.env = originalEnv;
  });

  describe('sendByChannel(whatsapp) & sendWhatsApp failover', () => {
    it('returns success via Evolution when Evolution send succeeds', async () => {
      const mockSendTextMessage = jest.fn().mockResolvedValue({
        success: true,
        messageId: 'evo-success-123',
      });
      jest.spyOn(evolutionModule, 'getEvolutionService').mockReturnValue({
        sendTextMessage: mockSendTextMessage,
      } as any);

      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'evo-key';
      process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
      process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-bearer-secret';

      const result = await sendByChannel('whatsapp', '5511999990001', 'Test message');

      expect(result).toEqual({ success: true, messageId: 'evo-success-123' });
      expect(mockSendTextMessage).toHaveBeenCalledWith('5511999990001', 'Test message');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does NOT fall back when Evolution reports an ambiguous failure (delivery unknown)', async () => {
      const mockSendTextMessage = jest.fn().mockResolvedValue({
        success: false,
        error: 'Evolution instance disconnected',
      });
      jest.spyOn(evolutionModule, 'getEvolutionService').mockReturnValue({
        sendTextMessage: mockSendTextMessage,
      } as any);

      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'evo-key';
      process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
      process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-bearer-secret';

      // E4: `success:false` da Evolution pode ser pós-dispatch — ambíguo.
      // Sem confirmação de não-dispatch, o sidecar NÃO é chamado.
      const result = await sendByChannel('whatsapp', '5511999990002', 'Failover test');

      expect(result).toEqual({
        success: false,
        delivery: 'unknown',
        error: 'Evolution instance disconnected',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does NOT fall back when Evolution throws (ambiguous delivery)', async () => {
      const mockSendTextMessage = jest.fn().mockRejectedValue(new Error('Connection timeout to Evolution'));
      jest.spyOn(evolutionModule, 'getEvolutionService').mockReturnValue({
        sendTextMessage: mockSendTextMessage,
      } as any);

      process.env.EVOLUTION_API_URL = 'https://evolution.example.com';
      process.env.EVOLUTION_API_KEY = 'evo-key';
      process.env.WHATSAPP_FALLBACK_URL = 'https://sidecar.example.com';
      process.env.WHATSAPP_FALLBACK_SECRET = 'sidecar-secret-token';

      const result = await sendWhatsApp('5511999990003', 'Throw failover test');

      expect(result).toEqual({
        success: false,
        delivery: 'unknown',
        error: 'Connection timeout to Evolution',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails closed with delivery unknown when Evolution fails and fallback sidecar is not configured', async () => {
      const mockSendTextMessage = jest.fn().mockResolvedValue({
        success: false,
        error: 'Evolution down and no fallback',
      });
      jest.spyOn(evolutionModule, 'getEvolutionService').mockReturnValue({
        sendTextMessage: mockSendTextMessage,
      } as any);

      delete process.env.WHATSAPP_FALLBACK_URL;
      delete process.env.WHATSAPP_FALLBACK_SECRET;

      const result = await sendByChannel('whatsapp', '5511999990004', 'No fallback configured');

      expect(result).toEqual({
        success: false,
        delivery: 'unknown',
        error: 'Evolution down and no fallback',
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fails closed when Evolution is unavailable and sidecar URL is missing', async () => {
      jest.spyOn(evolutionModule, 'getEvolutionService').mockReturnValue(null);
      delete process.env.WHATSAPP_FALLBACK_URL;
      delete process.env.WHATSAPP_FALLBACK_SECRET;

      const result = await sendWhatsApp('5511999990005', 'No services');

      expect(result).toEqual({ success: false, error: 'Evolution service not available' });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('sendByChannel(instagram) & sendInstagram', () => {
    it('returns error and warns when sendInstagram is called (preserved contract)', async () => {
      const result = await sendInstagram('ig-user-123', 'Hello IG DM');

      expect(result).toEqual({ success: false, error: 'Instagram outbound not yet implemented' });
      expect(dbLogger.warn).toHaveBeenCalledWith('send-message-service: instagram send not implemented');
    });

    it('returns error when sendByChannel is called with instagram channel', async () => {
      const result = await sendByChannel('instagram', 'ig-user-123', 'Hello IG');
      expect(result).toEqual({ success: false, error: 'Instagram outbound not yet implemented' });
    });
  });

  describe('sendByChannel(web)', () => {
    it('returns error for web channel (receive-only)', async () => {
      const result = await sendByChannel('web', 'web-sess-1', 'Hello Web');
      expect(result).toEqual({ success: false, error: 'Web widget is receive-only' });
    });
  });
});
