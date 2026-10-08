/**
 * Evolution webhook — retired (410 Gone).
 *
 * WAHA-only (owner decision, commit 3863c4f, ratified 2026-10-08): the legacy
 * Evolution inbound route is a Gone stub. Every method returns 410 under the
 * canonical error envelope and points senders at `/api/whatsapp/waha`.
 */

import { NextRequest } from 'next/server';

jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: unknown) => handler,
}));

jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));

import { GET, POST } from './route';

function makeRequest(url: string, method = 'POST', body: unknown = { event: 'messages.upsert' }) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Evolution webhook retirement (410 Gone)', () => {
  it('POST returns 410 with the canonical error envelope', async () => {
    const response = await POST(
      makeRequest('http://localhost/api/whatsapp/evolution?token=anything'),
    );

    expect(response.status).toBe(410);
    const payload = await response.json();
    expect(payload.error.code).toBe('EVOLUTION_RETIRED');
    expect(typeof payload.error.message).toBe('string');
    expect(typeof payload.error.requestId).toBe('string');
  });

  it('POST points senders at the WAHA inbound webhook', async () => {
    const response = await POST(makeRequest('http://localhost/api/whatsapp/evolution'));
    const payload = await response.json();
    expect(payload.error.message).toContain('/api/whatsapp/waha');
  });

  it('GET returns 410 with the same envelope', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/whatsapp/evolution', { method: 'GET' }),
    );

    expect(response.status).toBe(410);
    const payload = await response.json();
    expect(payload.error.code).toBe('EVOLUTION_RETIRED');
    expect(typeof payload.error.requestId).toBe('string');
  });

  it('retirement precedes auth: invalid secrets also get 410, never 403', async () => {
    const response = await POST(
      makeRequest('http://localhost/api/whatsapp/evolution?token=wrong'),
    );

    expect(response.status).toBe(410);
    const payload = await response.json();
    expect(payload.error.code).toBe('EVOLUTION_RETIRED');
  });

  it('retirement precedes validation: malformed payloads get 410, never 400', async () => {
    const response = await POST(
      makeRequest('http://localhost/api/whatsapp/evolution', 'POST', { garbage: true }),
    );

    expect(response.status).toBe(410);
  });
});
