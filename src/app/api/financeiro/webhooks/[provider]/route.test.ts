/**
 * route.test.ts — POST /api/financeiro/webhooks/[provider]
 *
 * Task 7 — financeiro collection closure.
 * Webhook permanece NÃO-gated (não usa withModuleRoute) para que
 * reconciliação de cobranças funcione mesmo com módulo desabilitado.
 *
 * Cobertura:
 *  - 404 unknown provider
 *  - 401 missing/invalid token
 *  - 200 known charge (reconcile)
 *  - 404 unknown charge
 *  - rate limit
 */

const mockProcessAsaasWebhook = jest.fn();
const mockListGateways = jest.fn();
const mockListGatewaysByProvider = jest.fn();
const mockGetPaymentGateway = jest.fn();
const mockDecryptGatewayCredentials = jest.fn();

jest.mock('@/modules/financeiro/gateways/providers/asaas/webhook', () => ({
  processAsaasWebhook: (...args: unknown[]) => mockProcessAsaasWebhook(...args),
}));

jest.mock('@/modules/financeiro/repositories/financeiro-repository', () => ({
  listGateways: (...args: unknown[]) => mockListGateways(...args),
  listGatewaysByProvider: (...args: unknown[]) => mockListGatewaysByProvider(...args),
  getPaymentGateway: (...args: unknown[]) => mockGetPaymentGateway(...args),
}));

jest.mock('@/modules/financeiro/lib/crypto', () => ({
  decryptGatewayCredentials: (...args: unknown[]) => mockDecryptGatewayCredentials(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from './route';

const validToken = 'asaas-api-key-12345';

function makeRequest(overrides: {
  provider?: string;
  clinicId?: string;
  token?: string;
  body?: unknown;
} = {}) {
  const {
    provider = 'asaas',
    clinicId = 'c1',
    token = validToken,
    body = { event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1' } },
  } = overrides;

  const url = `http://localhost/api/financeiro/webhooks/${provider}?clinicId=${clinicId}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-asaas-token': token,
  };

  return new NextRequest(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function context(provider = 'asaas') {
  return { params: Promise.resolve({ provider }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListGateways.mockResolvedValue([
    { id: 'gw-1', provider: 'asaas', isEnabled: true },
  ]);
  mockListGatewaysByProvider.mockResolvedValue([
    { id: 'gw-1', clinicId: 'c1', provider: 'asaas', isEnabled: true, encryptedConfig: { iv: 'iv', data: 'enc', tag: 'tag' } },
  ]);
  mockGetPaymentGateway.mockResolvedValue({
    id: 'gw-1',
    encryptedConfig: { iv: 'iv', data: 'enc', tag: 'tag' },
  });
  mockDecryptGatewayCredentials.mockReturnValue({ apiKey: validToken });
  mockProcessAsaasWebhook.mockResolvedValue({ settled: true, chargeFound: true });
});

describe('POST /api/financeiro/webhooks/[provider] — ungated', () => {
  it('404 para provider desconhecido', async () => {
    const res = await POST(makeRequest({ provider: 'unknown' }), context('unknown'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Unknown provider' });
    expect(mockProcessAsaasWebhook).not.toHaveBeenCalled();
  });

  it('401 para x-asaas-token ausente', async () => {
    const res = await POST(makeRequest({ token: '' }), context());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Missing Asaas webhook token header' });
  });

  it('401 quando nenhum gateway possui a credencial do provider', async () => {
    mockListGatewaysByProvider.mockResolvedValue([]);
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: 'Invalid webhook token' });
    expect(mockProcessAsaasWebhook).not.toHaveBeenCalled();
  });

  it('200 para settlement reconciliation mesmo com gateway desabilitado (isEnabled=false)', async () => {
    mockListGatewaysByProvider.mockResolvedValue([
      { id: 'gw-1', clinicId: 'c1', provider: 'asaas', isEnabled: false, encryptedConfig: { iv: 'iv', data: 'enc', tag: 'tag' } },
    ]);
    mockGetPaymentGateway.mockResolvedValue({
      id: 'gw-1',
      encryptedConfig: { iv: 'iv', data: 'enc', tag: 'tag' },
    });
    mockDecryptGatewayCredentials.mockReturnValue({ apiKey: validToken });
    mockProcessAsaasWebhook.mockResolvedValue({ settled: true, chargeFound: true });
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, settled: true });
    expect(mockProcessAsaasWebhook).toHaveBeenCalled();
  });

  it('401 para token inválido (mismatch)', async () => {
    mockDecryptGatewayCredentials.mockReturnValue({ apiKey: 'different-key' });
    const res = await POST(makeRequest({ token: 'wrong-token' }), context());
    expect(res.status).toBe(401);
    expect(mockProcessAsaasWebhook).not.toHaveBeenCalled();
  });

  it('aceita o header oficial Asaas e o webhook token da instalação', async () => {
    mockDecryptGatewayCredentials.mockReturnValue({ apiKey: 'api-key', webhookToken: validToken });
    const request = makeRequest({ token: '' });
    request.headers.set('asaas-access-token', validToken);
    const res = await POST(request, context());
    expect(res.status).toBe(200);
  });

  it('deriva clinicId da credencial e ignora clinicId de query/header', async () => {
    const res = await POST(makeRequest({ clinicId: 'attacker-clinic' }), context());
    expect(res.status).toBe(200);
    expect(mockListGatewaysByProvider).toHaveBeenCalledWith('asaas');
    expect(mockProcessAsaasWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: 'c1' }),
    );
  });

  it('200 para cobrança conhecida → reconciliation (settled)', async () => {
    mockProcessAsaasWebhook.mockResolvedValue({ settled: true, chargeFound: true });
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, settled: true });
    expect(mockProcessAsaasWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 'c1',
        body: { event: 'PAYMENT_RECEIVED', payment: { id: 'pay-1' } },
      }),
    );
  });

  it('200 com duplicate=true quando evento já processado', async () => {
    mockProcessAsaasWebhook.mockResolvedValue({ settled: false, duplicate: true, chargeFound: true });
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, duplicate: true });
  });

  it('200 para evento conhecido não-settlement (settled=false, chargeFound=true)', async () => {
    mockProcessAsaasWebhook.mockResolvedValue({ settled: false, chargeFound: true });
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ received: true, settled: false });
  });

  it('NÃO verifica module gate (webhook ungated) — source não importa createManifest()', async () => {
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(200);
  });

  it('404 quando chargeFound=false (cobrança genuinamente desconhecida)', async () => {
    mockProcessAsaasWebhook.mockResolvedValue({ settled: false, chargeFound: false });
    const res = await POST(makeRequest(), context());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'Charge not found' });
  });
});