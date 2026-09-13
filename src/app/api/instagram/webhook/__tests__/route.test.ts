import { NextRequest } from 'next/server';
import { createHmac } from 'crypto';

const INSTAGRAM_VERIFY_TOKEN = 'instagram-verify-token';
const INSTAGRAM_APP_SECRET = 'instagram-app-secret-test-32chars';

function computeSignature(body: string, secret = INSTAGRAM_APP_SECRET): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

// Mocks — defined before import, factory uses jest.fn directly (no spread)
jest.mock('@/core/modules/gates', () => ({
  withModuleRoute: () => (handler: any) => handler,
}));
jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => ({}),
}));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true, remaining: 10 })),
  getClientIdentifier: jest.fn(() => 'test-client'),
  rateLimitPresets: { webhook: { windowMs: 60000, maxRequests: 100 } },
}));
jest.mock('@/modules/atendimento/repositories/conversations-repository', () => ({
  resolveInstagramInstallation: jest.fn(),
  getClinicByInstagramAccountId: jest.fn(),
}));
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemActionResult: jest.fn(),
}));

import { GET, POST } from '../route';

// Resolve mocks after import
const mockCheckRateLimit = jest.requireMock('@/lib/rate-limit').checkRateLimit as jest.Mock;
const mockGetClientIdentifier = jest.requireMock('@/lib/rate-limit').getClientIdentifier as jest.Mock;
const mockResolveInstagramInstallation = jest.requireMock('@/modules/atendimento/repositories/conversations-repository').resolveInstagramInstallation as jest.Mock;
const mockRunAction = jest.requireMock('@/modules/atendimento/ui/route-adapter').runAtendimentoSystemActionResult as jest.Mock;

describe('Instagram webhook — GET verification (T2)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10 } as any);
    mockGetClientIdentifier.mockReturnValue('test-client');
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns challenge when token matches', async () => {
    const req = new NextRequest(`http://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=${INSTAGRAM_VERIFY_TOKEN}&hub.challenge=challenge123`);
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('challenge123');
  });

  it('rejects wrong token', async () => {
    const req = new NextRequest(`http://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge123`);
    const res = await GET(req as any);
    expect(res.status).toBe(403);
  });
});

describe('Instagram webhook — POST inbound signed (T2)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10 } as any);
    mockGetClientIdentifier.mockReturnValue('test-client');
    mockResolveInstagramInstallation.mockResolvedValue({ clinicId: 'clinic-a-id', installationId: 'ig-account-1' } as any);
    mockRunAction.mockResolvedValue({ ok: true, data: { deduped: false } } as any);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function makePost(body: any, signature?: string) {
    const raw = JSON.stringify(body);
    const sig = signature !== undefined ? signature : computeSignature(raw);
    return new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sig,
      },
    });
  }

  it('processes valid instagram message via receberMensagem with channel instagram', async () => {
    const body = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          messaging: [
            {
              sender: { id: 'sender-1' },
              recipient: { id: 'ig-account-1' },
              timestamp: Date.now().toString(),
              message: { mid: 'mid-1', text: 'Olá' },
            },
          ],
        },
      ],
    };
    const res = await POST(makePost(body) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.processed).toBe(1);
    expect(mockRunAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ channel: 'instagram', externalConversationId: 'sender-1', externalMessageId: 'mid-1' }),
      'clinic-a-id',
    );
    expect(mockRunAction.mock.calls[0][2]).toBe('clinic-a-id');
  });

  it('rejects invalid signature before rate limit (T1 b pattern)', async () => {
    mockCheckRateLimit.mockClear();
    const body = { object: 'instagram', entry: [] };
    const raw = JSON.stringify(body);
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=invalid' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(403);
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('fails closed for unknown installation — no persist', async () => {
    mockResolveInstagramInstallation.mockResolvedValue(null as any);
    const body = {
      object: 'instagram',
      entry: [{ id: 'unknown-account', messaging: [{ sender: { id: 'sender-1' }, recipient: { id: 'unknown-account' }, timestamp: Date.now().toString(), message: { mid: 'mid-1', text: 'Olá' } }] }],
    };
    const res = await POST(makePost(body) as any);
    expect(res.status).toBe(403);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('ignores non-instagram object', async () => {
    const body = { object: 'page', entry: [] };
    const res = await POST(makePost(body) as any);
    const json = await res.json();
    expect(json.status).toBe('ignored');
    expect(mockRunAction).not.toHaveBeenCalled();
  });
});

describe('Instagram webhook — two clinics isolation (T2 integration)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10 } as any);
    mockRunAction.mockResolvedValue({ ok: true, data: { deduped: false } } as any);
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('installation A does not create/alter conversation of B', async () => {
    const accountA = 'ig-account-a';
    const accountB = 'ig-account-b';
    const clinicA = 'clinic-a-uuid';
    const clinicB = 'clinic-b-uuid';

    mockResolveInstagramInstallation.mockImplementation(async (accountId: string) => {
      if (accountId === accountA) return { clinicId: clinicA, installationId: accountA };
      if (accountId === accountB) return { clinicId: clinicB, installationId: accountB };
      return null;
    });

    function makePostForAccount(accountId: string, senderId: string, mid: string) {
      const body = {
        object: 'instagram',
        entry: [{ id: accountId, messaging: [{ sender: { id: senderId }, recipient: { id: accountId }, timestamp: Date.now().toString(), message: { mid, text: 'Olá' } }] }],
      };
      const raw = JSON.stringify(body);
      return new NextRequest('http://localhost/api/instagram/webhook', {
        method: 'POST',
        body: raw,
        headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) },
      });
    }

    const reqA = makePostForAccount(accountA, 'sender-a', 'mid-a');
    const resA = await POST(reqA as any);
    expect(resA.status).toBe(200);
    expect(mockRunAction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ externalConversationId: 'sender-a' }), clinicA);
    expect(mockRunAction).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), clinicB);

    mockRunAction.mockClear();

    const reqB = makePostForAccount(accountB, 'sender-b', 'mid-b');
    const resB = await POST(reqB as any);
    expect(resB.status).toBe(200);
    expect(mockRunAction).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ externalConversationId: 'sender-b' }), clinicB);
    expect(mockRunAction).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), clinicA);

    expect(mockRunAction).toHaveBeenCalledTimes(1);
    expect(mockRunAction.mock.calls[0][2]).toBe(clinicB);
  });
});

describe('Instagram webhook — E17 branch coverage (determinística, sem credenciais reais)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10 } as any);
    mockGetClientIdentifier.mockReturnValue('test-client');
    mockResolveInstagramInstallation.mockResolvedValue({ clinicId: 'clinic-a-id', installationId: 'ig-account-1' } as any);
    mockRunAction.mockResolvedValue({ ok: true, data: { deduped: false } } as any);
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it('linha 34: NODE_ENV=development sem tokens permite assinatura ausente (dev bypass)', async () => {
    process.env = { ...originalEnv, NODE_ENV: 'development' } as any;
    delete (process.env as any).INSTAGRAM_VERIFY_TOKEN;
    delete (process.env as any).INSTAGRAM_APP_SECRET;
    delete (process.env as any).WHATSAPP_VERIFY_TOKEN;
    delete (process.env as any).WHATSAPP_APP_SECRET;

    const body = { object: 'instagram', entry: [] };
    const raw = JSON.stringify(body);
    // signature ausente deve passar no dev bypass
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json' } as any,
    });
    const res = await POST(req as any);
    // sem entries, retorna success true (não 403)
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(mockCheckRateLimit).toHaveBeenCalled();
  });

  it('linha 70: body com JSON inválido retorna 400 após assinatura válida', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    const raw = '{invalid-json';
    const sig = computeSignature(raw);
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sig } as any,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/Invalid request body/);
  });

  it('linhas 88-90: payload via entry.changes[].value.messaging coberto', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    const body = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          changes: [
            {
              value: {
                messaging: [
                  {
                    sender: { id: 'sender-via-changes' },
                    recipient: { id: 'ig-account-1' },
                    timestamp: Date.now().toString(),
                    message: { mid: 'mid-changes-1', text: 'via changes' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(body);
    const sig = computeSignature(raw);
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sig } as any,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(1);
    expect(mockRunAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ externalConversationId: 'sender-via-changes', externalMessageId: 'mid-changes-1' }),
      'clinic-a-id',
    );
  });

  it('linhas 88-90 vazio: changes sem messaging resulta em ignored (continue)', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    const body = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          changes: [{ value: {} }, { value: { messaging: [] } }],
        },
      ],
    };
    const raw = JSON.stringify(body);
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(0);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('linha 116: from ou mid ausente retorna 400 Invalid Instagram message payload', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    // from ausente
    const bodyMissingFrom = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          messaging: [{ sender: {}, recipient: { id: 'ig-account-1' }, timestamp: Date.now().toString(), message: { mid: 'mid-1', text: 'hi' } }],
        },
      ],
    };
    let raw = JSON.stringify(bodyMissingFrom);
    let req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    let res = await POST(req as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid Instagram message payload/);

    mockResolveInstagramInstallation.mockResolvedValue({ clinicId: 'clinic-a-id', installationId: 'ig-account-1' } as any);
    // mid ausente
    const bodyMissingMid = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          messaging: [{ sender: { id: 'sender-1' }, recipient: { id: 'ig-account-1' }, timestamp: Date.now().toString(), message: { text: 'hi' } }],
        },
      ],
    };
    raw = JSON.stringify(bodyMissingMid);
    req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('linhas 124-138: variações de attachments — image com caption, image sem caption, audio, document e continue is_echo', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;

    const makeAttachmentBody = (message: any) => ({
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          messaging: [{ sender: { id: 'sender-1' }, recipient: { id: 'ig-account-1' }, timestamp: Date.now().toString(), message: { mid: `mid-${Math.random()}`, ...message } }],
        },
      ],
    });

    // image com caption
    mockRunAction.mockResolvedValueOnce({ ok: true, data: {} } as any);
    let body: any = makeAttachmentBody({ attachments: [{ type: 'image', caption: 'foto caption' }] });
    let raw = JSON.stringify(body);
    let req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    let res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockRunAction).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ message: 'foto caption', messageType: 'image' }), 'clinic-a-id');

    // image sem caption -> [Image]
    mockRunAction.mockResolvedValueOnce({ ok: true, data: {} } as any);
    body = makeAttachmentBody({ attachments: [{ type: 'image' }] });
    raw = JSON.stringify(body);
    req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockRunAction).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ message: '[Image]', messageType: 'image' }), 'clinic-a-id');

    // audio -> [Audio]
    mockRunAction.mockResolvedValueOnce({ ok: true, data: {} } as any);
    body = makeAttachmentBody({ attachments: [{ type: 'audio' }] });
    raw = JSON.stringify(body);
    req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockRunAction).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ message: '[Audio]', messageType: 'audio' }), 'clinic-a-id');

    // document / other type -> [Attachment]
    mockRunAction.mockResolvedValueOnce({ ok: true, data: {} } as any);
    body = makeAttachmentBody({ attachments: [{ type: 'file' }] });
    raw = JSON.stringify(body);
    req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    res = await POST(req as any);
    expect(res.status).toBe(200);
    expect(mockRunAction).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ message: '[Attachment]', messageType: 'document' }), 'clinic-a-id');

    // is_echo / sem texto nem attachments -> continue (não chama action)
    mockRunAction.mockClear();
    body = makeAttachmentBody({ is_echo: true });
    raw = JSON.stringify(body);
    req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(0);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('linhas 166-167: erro invalid_input mapeia 422 e demais 500', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;

    const body = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          messaging: [{ sender: { id: 'sender-1' }, recipient: { id: 'ig-account-1' }, timestamp: Date.now().toString(), message: { mid: 'mid-err-1', text: 'hi' } }],
        },
      ],
    };
    const raw = JSON.stringify(body);

    mockRunAction.mockResolvedValueOnce({ ok: false, error: { code: 'invalid_input', message: 'bad input' } } as any);
    let req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    let res = await POST(req as any);
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('bad input');

    mockRunAction.mockResolvedValueOnce({ ok: false, error: { code: 'internal', message: 'fail' } } as any);
    req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    res = await POST(req as any);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('fail');
  });

  it('timestamp stale >24h é ignorado (continue) sem chamar action', async () => {
    process.env = { ...originalEnv, INSTAGRAM_VERIFY_TOKEN, INSTAGRAM_APP_SECRET, NODE_ENV: 'production' } as any;
    const staleTs = Date.now() - 25 * 60 * 60 * 1000;
    const body = {
      object: 'instagram',
      entry: [
        {
          id: 'ig-account-1',
          messaging: [{ sender: { id: 'sender-1' }, recipient: { id: 'ig-account-1' }, timestamp: staleTs.toString(), message: { mid: 'mid-stale', text: 'old' } }],
        },
      ],
    };
    const raw = JSON.stringify(body);
    const req = new NextRequest('http://localhost/api/instagram/webhook', {
      method: 'POST',
      body: raw,
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': computeSignature(raw) } as any,
    });
    mockRunAction.mockClear();
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.processed).toBe(0);
    expect(mockRunAction).not.toHaveBeenCalled();
  });
});
