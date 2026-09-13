/**
 * Integration leve (A3) — retry duplicado de sendTextMessage com a mesma chave
 * chama o provider 1 vez; sem chave, o comportamento legado é preservado.
 *
 * Claim real sob mock in-memory da camada `@/lib/idempotency` (sem DB).
 * Evolution NÃO recebe header de idempotência (sem suporte nativo documentado).
 */

const outcomes: Array<'claimed' | 'completed' | 'in_progress' | 'retry_after'> = [];
const completedKeys: string[] = [];
const failedKeys: string[] = [];

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(async () => outcomes.shift() ?? 'claimed'),
  markIdempotencyKeyCompleted: jest.fn(async (key: string) => {
    completedKeys.push(key);
  }),
  markIdempotencyKeyFailed: jest.fn(async (key: string) => {
    failedKeys.push(key);
  }),
  isIdempotencyKeyProcessed: jest.fn(async (key: string) => completedKeys.includes(key)),
  withIdempotency: jest.fn(),
}));

import { EvolutionApiService } from '../evolution-service';

describe('evolution sendTextMessage idempotency (A3)', () => {
  beforeEach(() => {
    outcomes.length = 0;
    completedKeys.length = 0;
    failedKeys.length = 0;
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
    outcomes.push('claimed', 'completed');
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
    expect(completedKeys.length).toBe(0);
  });

  it('NÃO envia header de idempotência à Evolution (sem suporte nativo)', async () => {
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: 'whatsapp:send:c:m' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(JSON.stringify(headers).toLowerCase()).not.toContain('idempotency');
  });

  it('falha do provider libera retry (não completa o claim)', async () => {
    outcomes.push('claimed');
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid number' }),
    });
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    const key = 'whatsapp:send:clinic-1:msg-bad';

    const first = await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: key });
    expect(first.success).toBe(false);
    expect(completedKeys.includes(key)).toBe(false);
    expect(failedKeys.includes(key)).toBe(true);
  });
});
