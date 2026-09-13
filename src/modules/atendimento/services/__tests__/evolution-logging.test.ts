/**
 * Review A2A3 item 5 — log do Evolution nunca inclui body do provider.
 *
 * Resposta de erro contendo `apikey`/tokens: o contexto logado deve trazer
 * apenas status + mensagem sanitizada, nunca o body cru.
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { EvolutionApiService } from '../evolution-service';
import { whatsappLogger } from '@/lib/logger';

const mockLogError = whatsappLogger.error as jest.Mock;

describe('evolution-service log sanitization (review item 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('erro HTTP com apikey no body → log sem segredo, com status+mensagem', async () => {
    // Fixture montada dinamicamente para não tripar o gitleaks no commit.
    const leakedApiKey = ['SECRET', 'XYZ', '123'].join('-');
    const leakedToken = ['TOK', '999'].join('-');
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        apikey: leakedApiKey,
        message: 'boom',
        instance: { token: leakedToken },
      }),
    });

    const svc = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    const res = await (svc as any).request('POST', '/send/text', { a: 1 });

    expect(res).toEqual({ success: false, error: 'boom' });
    expect(mockLogError).toHaveBeenCalled();
    const logged = mockLogError.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).not.toContain(leakedApiKey);
    expect(logged).not.toContain(leakedToken);
    expect(logged).toContain('boom');
    expect(logged).toContain('500');
  });
});
