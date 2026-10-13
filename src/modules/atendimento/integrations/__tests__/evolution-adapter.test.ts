/**
 * Unit test: EvolutionAdapter (vNext P3.1 — provider abstraction).
 *
 * The adapter is a thin mapping layer over the existing Evolution leaf
 * (`services/evolution-service`): it must not change transport, must not own
 * idempotency (the facade does), and must surface provider failures verbatim
 * so `channel-service` keeps its fallback decision.
 */

jest.mock('../../services/evolution-service', () => ({
  getEvolutionService: jest.fn(),
}));

import { getEvolutionService } from '../../services/evolution-service';
import { evolutionWhatsAppProviderAdapter } from '../evolution-adapter';

const mockGetEvolutionService = getEvolutionService as jest.MockedFunction<typeof getEvolutionService>;

describe('EvolutionAdapter (P3.1)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is registered under the "evolution" provider id', () => {
    expect(evolutionWhatsAppProviderAdapter.id).toBe('evolution');
  });

  it('is not available when the Evolution leaf resolves to null', () => {
    mockGetEvolutionService.mockReturnValue(null);
    expect(evolutionWhatsAppProviderAdapter.isAvailable()).toBe(false);
  });

  it('is available when the Evolution leaf resolves a service', () => {
    mockGetEvolutionService.mockReturnValue({ sendTextMessage: jest.fn() } as never);
    expect(evolutionWhatsAppProviderAdapter.isAvailable()).toBe(true);
  });

  it('resolves the leaf lazily on every call (env/singleton changes are honoured)', () => {
    mockGetEvolutionService.mockReturnValueOnce(null);
    expect(evolutionWhatsAppProviderAdapter.isAvailable()).toBe(false);
    mockGetEvolutionService.mockReturnValueOnce({ sendTextMessage: jest.fn() } as never);
    expect(evolutionWhatsAppProviderAdapter.isAvailable()).toBe(true);
    expect(mockGetEvolutionService).toHaveBeenCalledTimes(2);
  });

  it('maps sendTextMessage(to, text) to the leaf and returns its result contract', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-1' });
    mockGetEvolutionService.mockReturnValue({ sendTextMessage } as never);

    const result = await evolutionWhatsAppProviderAdapter.sendTextMessage('5511999999999', 'Olá');

    expect(sendTextMessage).toHaveBeenCalledTimes(1);
    expect(sendTextMessage).toHaveBeenCalledWith('5511999999999', 'Olá');
    expect(result).toEqual({ success: true, messageId: 'evo-1' });
  });

  it('propagates provider failure results unchanged (facade decides the fallback)', async () => {
    mockGetEvolutionService.mockReturnValue({
      sendTextMessage: jest.fn().mockResolvedValue({ success: false, error: 'HTTP 500' }),
    } as never);

    await expect(
      evolutionWhatsAppProviderAdapter.sendTextMessage('5511999999999', 'Olá'),
    ).resolves.toEqual({ success: false, error: 'HTTP 500' });
  });

  it('rethrows provider errors so the facade fallback path still runs', async () => {
    mockGetEvolutionService.mockReturnValue({
      sendTextMessage: jest.fn().mockRejectedValue(new Error('Evolution timed out')),
    } as never);

    await expect(
      evolutionWhatsAppProviderAdapter.sendTextMessage('5511999999999', 'Olá'),
    ).rejects.toThrow('Evolution timed out');
  });

  it('fails closed when called while unavailable (never fabricates a messageId)', async () => {
    mockGetEvolutionService.mockReturnValue(null);

    const result = await evolutionWhatsAppProviderAdapter.sendTextMessage('5511999999999', 'Olá');

    expect(result.success).toBe(false);
    expect(result.messageId).toBeUndefined();
    expect(result.error).toMatch(/not available/i);
  });
});
