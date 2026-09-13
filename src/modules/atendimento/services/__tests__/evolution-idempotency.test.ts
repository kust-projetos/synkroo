/**
 * RE-REVIEW-A2A3 — `sendTextMessage` (leaf) NÃO faz claim: o claim vive
 * exclusivamente na facade (`channel-service.runIdempotentSend`).
 *
 * Prova: com chave, o leaf envia direto (sem dedup, sem claim, sem header de
 * idempotência); o param `idempotencyKey` existe só por compatibilidade.
 */

jest.mock('@/lib/idempotency', () => ({
  claimIdempotencyKey: jest.fn(),
  tryClaimIdempotencyKey: jest.fn(),
  markIdempotencyKeyCompleted: jest.fn(),
  markIdempotencyKeyFailed: jest.fn(),
  isIdempotencyKeyProcessed: jest.fn(),
  withIdempotency: jest.fn(),
  IdempotencyInfraError: class IdempotencyInfraError extends Error {},
}));

import { EvolutionApiService } from '../evolution-service';
import { claimIdempotencyKey } from '@/lib/idempotency';

describe('evolution sendTextMessage leaf (no claim)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { Info: { ID: 'evo-msg-1' } } }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('com chave → envia direto, sem claim e sem dedup (facade é dona do claim)', async () => {
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    const key = 'whatsapp:send:clinic-1:msg-1';

    const first = await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: key });
    expect(first).toEqual({ success: true, messageId: 'evo-msg-1' });

    const dup = await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: key });
    expect(dup).toEqual({ success: true, messageId: 'evo-msg-1' });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(claimIdempotencyKey).not.toHaveBeenCalled();
  });

  it('NÃO envia header de idempotência à Evolution (sem suporte nativo)', async () => {
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    await service.sendTextMessage('11999999999', 'Olá', { idempotencyKey: 'whatsapp:send:c:m' });

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(JSON.stringify(headers).toLowerCase()).not.toContain('idempotency');
  });

  it('falha do provider retorna erro (sem marcar nada)', async () => {
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Invalid number' }),
    });
    const service = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');

    const res = await service.sendTextMessage('11999999999', 'Olá', {
      idempotencyKey: 'whatsapp:send:clinic-1:msg-bad',
    });
    expect(res).toEqual({ success: false, error: 'Invalid number' });
  });
});
