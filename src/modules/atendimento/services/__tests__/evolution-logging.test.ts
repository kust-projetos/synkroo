/**
 * Review A2A3 item 5 + PII alcançável — log do Evolution nunca inclui body do
 * provider.
 *
 * Resposta de erro contendo `apikey`/tokens e PII em `data.message`/`data.error`:
 * o logger só redige por CHAVE (`SENSITIVE_LOG_KEYS`), então uma STRING
 * provider-controlled seria serializada crua. O contexto logado deve trazer
 * apenas status + código da allowlist — nunca o body, telefone, texto ou
 * mensagem do provider.
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

  it('erro HTTP com apikey no body → log sem segredo, com status+código', async () => {
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

    // Comportamento da resposta preservado: o caller continua recebendo a
    // mensagem do provider em `error`.
    expect(res).toEqual({ success: false, error: 'boom' });
    expect(mockLogError).toHaveBeenCalled();
    const logged = mockLogError.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).not.toContain(leakedApiKey);
    expect(logged).not.toContain(leakedToken);
    // Nenhum texto livre do provider — nem a mensagem "inofensiva" do caso.
    expect(logged).not.toContain('boom');
    expect(logged).toContain('500');
    expect(logged).toContain('PROVIDER_SERVER_ERROR');
  });

  it('PII embutida em `data.message`/`data.error` NUNCA chega ao log', async () => {
    // Marcadores montados dinamicamente (gitleaks-safe) que só existiriam no
    // log se o texto livre do provider fosse serializado.
    const phone = '55' + '1198765' + '4321';
    const body = 'Lembrete: sua consulta é amanhã às 14h';
    const secretInMessage = ['API', 'KEY', 'LIVE', '7f3a'].join('-');
    const phoneInError = '+' + '5511999998888';

    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        message: `invalid destination ${phone}: ${body} (${secretInMessage})`,
        error: `send failed for ${phoneInError}`,
      }),
    });

    const svc = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    const res = await (svc as any).request('POST', '/send/text', { number: phone });

    const logged = mockLogError.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    // Nada do corpo do provider: sem telefone, sem texto, sem segredo ecoado.
    expect(logged).not.toContain(phone);
    expect(logged).not.toContain(phoneInError);
    expect(logged).not.toContain(body);
    expect(logged).not.toContain('Lembrete');
    expect(logged).not.toContain(secretInMessage);
    // O que RESTA é só o evento fixo, o status e o código da allowlist.
    expect(logged).toContain('Evolution API error');
    expect(logged).toContain('400');
    expect(logged).toContain('PROVIDER_BAD_REQUEST');
  });

  it('resposta do provider continua intacta em todos os caminhos de erro', async () => {
    // Sem `message`/`error`: cai no `HTTP <status>` — o código do log é o do
    // range, não do corpo.
    (global.fetch as unknown) = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });
    const svc = new EvolutionApiService('https://evolution.example.com', 'k', 'inst');
    await expect((svc as any).request('GET', '/status')).resolves.toEqual({ success: false, error: 'HTTP 503' });

    const logged = mockLogError.mock.calls.map((c) => JSON.stringify(c)).join(' ');
    expect(logged).toContain('PROVIDER_SERVER_ERROR');
  });
});
