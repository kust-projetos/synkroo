/**
 * Unit test: WhatsApp provider registry (vNext P3.1 + P3.2, WAHA-only 3863c4f).
 *
 * The registry is the single seam `channel-service` uses to reach a provider
 * adapter. WAHA is the channel (registered FIRST and exposed as the default);
 * Evolution stays registered as a DEPRECATED legacy fallback. Playwright
 * sidecar and business API are still NOT adapters here.
 */

jest.mock('../../services/evolution-service', () => ({
  getEvolutionService: jest.fn(),
}));

import { getEvolutionService } from '../../services/evolution-service';
import { evolutionWhatsAppProviderAdapter } from '../evolution-adapter';
import { wahaWhatsAppProviderAdapter } from '../waha-adapter';
import {
  DEFAULT_WHATSAPP_PROVIDER_ID,
  getDefaultWhatsAppProviderAdapter,
  getWhatsAppProviderAdapter,
  listWhatsAppProviderAdapterIds,
  registerWhatsAppProviderAdapter,
  resetWhatsAppProviderRegistry,
  type WhatsAppProviderAdapter,
} from '../whatsapp-provider-registry';

const mockGetEvolutionService = getEvolutionService as jest.MockedFunction<typeof getEvolutionService>;

function fakeAdapter(id: WhatsAppProviderAdapter['id']): WhatsAppProviderAdapter {
  return {
    id,
    isAvailable: () => true,
    sendTextMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'fake-1' }),
  };
}

describe('WhatsApp provider registry (P3.1 + P3.2, WAHA-only)', () => {
  beforeEach(() => {
    resetWhatsAppProviderRegistry();
    jest.clearAllMocks();
    delete process.env.WAHA_API_URL;
    delete process.env.WAHA_API_KEY;
    delete process.env.WAHA_SESSION;
  });

  afterAll(() => {
    resetWhatsAppProviderRegistry();
  });

  it('resolves the Evolution adapter (deprecated legacy, still functional)', () => {
    expect(getWhatsAppProviderAdapter('evolution')).toBe(evolutionWhatsAppProviderAdapter);
  });

  it('resolves the WAHA adapter by default (WAHA is the channel)', () => {
    expect(getWhatsAppProviderAdapter('waha')).toBe(wahaWhatsAppProviderAdapter);
  });

  it('exposes WAHA as the default provider', () => {
    expect(DEFAULT_WHATSAPP_PROVIDER_ID).toBe('waha');
    expect(getDefaultWhatsAppProviderAdapter()).toBe(wahaWhatsAppProviderAdapter);
  });

  it('returns null for providers that are not registered yet', () => {
    expect(getWhatsAppProviderAdapter('playwright')).toBeNull();
    expect(getWhatsAppProviderAdapter('business-api')).toBeNull();
  });

  it('lists the registered provider ids (WAHA-first)', () => {
    expect(listWhatsAppProviderAdapterIds()).toEqual(['waha', 'evolution']);
  });

  it('registers a custom adapter and lets it override an existing provider', () => {
    const custom = fakeAdapter('evolution');

    registerWhatsAppProviderAdapter(custom);

    expect(getWhatsAppProviderAdapter('evolution')).toBe(custom);
    expect(listWhatsAppProviderAdapterIds()).toEqual(['waha', 'evolution']);
  });

  it('ignores adapters without a provider id (fail-closed)', () => {
    registerWhatsAppProviderAdapter({
      id: '',
      isAvailable: () => true,
      sendTextMessage: jest.fn(),
    } as unknown as WhatsAppProviderAdapter);

    expect(listWhatsAppProviderAdapterIds()).toEqual(['waha', 'evolution']);
    expect(getWhatsAppProviderAdapter('' as WhatsAppProviderAdapter['id'])).toBeNull();
  });

  it('restores the default registry on reset', () => {
    registerWhatsAppProviderAdapter(fakeAdapter('waha'));

    resetWhatsAppProviderRegistry();

    expect(getWhatsAppProviderAdapter('evolution')).toBe(evolutionWhatsAppProviderAdapter);
    expect(getWhatsAppProviderAdapter('waha')).toBe(wahaWhatsAppProviderAdapter);
    expect(listWhatsAppProviderAdapterIds()).toEqual(['waha', 'evolution']);
  });

  it('wires the default Evolution adapter to the Evolution leaf', async () => {
    const sendTextMessage = jest.fn().mockResolvedValue({ success: true, messageId: 'evo-9' });
    mockGetEvolutionService.mockReturnValue({ sendTextMessage } as never);

    const adapter = getWhatsAppProviderAdapter('evolution');
    expect(adapter?.isAvailable()).toBe(true);
    await expect(adapter?.sendTextMessage('5511999999999', 'Olá')).resolves.toEqual({
      success: true,
      messageId: 'evo-9',
    });
    expect(sendTextMessage).toHaveBeenCalledWith('5511999999999', 'Olá');
  });
});
