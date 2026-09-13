/**
 * Integration leve (A3) — retry duplicado de sendTextMessage com a mesma chave
 * chama o provider 1 vez; sem chave, o comportamento legado é preservado.
 *
 * Claim real sob mock in-memory da camada `@/lib/idempotency` (sem DB).
 * Evolution NÃO recebe header de idempotência (sem suporte nativo documentado).
 */

const claimed = new Set<string>();
const completed = new Set<string>();

jest.mock('@/lib/idempotency', () => ({
  tryClaimIdempotencyKey: jest.fn(async (key: string) => {
    if (claimed.has(key) || completed.has(key)) return false;
    claimed.add(key);
    return true;
  }),
  markIdempotencyKeyCompleted: jest.fn(async (key: string) => {
    completed.add(key);
  }),
  markIdempotencyKeyFailed: jest.fn(async (key: string) => {
    claimed.delete(key);
  }),
  isIdempotencyKeyProcessed: jest.fn(async (key: string) => completed.has(key)),
  withIdempotency: jest.fn(),
}));

import { EvolutionApiService } from '../evolution-service';

describe('evolution sendTextMessage idempotency (A3)', () => {
  beforeEach(() => {
    claimed.clear();
    completed.clear();
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-msg-1' } } }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retry duplicado da mesma operação lógica → provider chamado 1 vez', async () => {
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    const key = 'whatsapp:send:clinic-1:msg-1';

    const first = await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: key });
    expect(first).toEqual({ success: true, messageId: 'evo-msg-1' });

    const dup = await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: key });
    expect(dup).toEqual({ success: true, deduplicated: true });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('sem chave → envio direto sem claim (legado preservado)', async () => {
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');

    await service.sendTextMessage('11999999999', 'A');
    await service.sendTextMessage('11999999999', 'A');

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(completed.size).toBe(0);
  });

  it('NÃO envia header de idempotência à Evolution (sem suporte nativo)', async () => {
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: 'whatsapp:send:c:m' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(JSON.stringify(headers).toLowerCase()).not.toContain('idempotency');
  });

  it('falha do provider libera retry (não completa o claim)', async () => {
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid number' }),
    });
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    const key = 'whatsapp:send:clinic-1:msg-bad';

    const first = await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: key });
    expect(first.success).toBe(false);
    expect(completed.has(key)).toBe(false);
  });
});
