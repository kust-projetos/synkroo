import { NextRequest } from 'next/server';
import { issueWidgetToken } from '@/lib/auth/widget-token';
import { GET, POST } from './route';
import { isAllowedWidgetOrigin, resolveWidgetInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { runAtendimentoSystemActionResult } from '@/modules/atendimento/ui/route-adapter';
import { checkRateLimit } from '@/lib/rate-limit';

jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (handler: unknown) => handler }));
jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10, reset: 60 }),
  getClientIdentifier: jest.fn().mockReturnValue('widget-client'),
  rateLimitPresets: { messages: {} },
}));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation', () => ({
  isAllowedWidgetOrigin: jest.fn(),
  resolveWidgetInstallation: jest.fn(),
}));
jest.mock('@/modules/atendimento/ui/route-adapter', () => ({
  runAtendimentoSystemActionResult: jest.fn(),
}));

const mockRateLimit = jest.mocked(checkRateLimit);
const mockIsAllowedOrigin = jest.mocked(isAllowedWidgetOrigin);
const mockResolveInstallation = jest.mocked(resolveWidgetInstallation);
const mockRunAction = jest.mocked(runAtendimentoSystemActionResult);

const SECRET = 'widget-test-secret-with-at-least-32-characters';
const ORIGIN = 'https://clinic.example';
const INSTALLATION = { installationId: 'public-installation', clinicId: 'clinic-1', allowedOrigins: [ORIGIN] };

function request(body: unknown, token = issueWidgetToken(SECRET, { installationId: INSTALLATION.installationId, origin: ORIGIN }).token, origin = ORIGIN) {
  return new NextRequest('https://synkroo.example/api/widget/messages', {
    method: 'POST',
    headers: {
      origin,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'idempotency-key': 'message-1',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/widget/messages', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    jest.clearAllMocks();
    mockIsAllowedOrigin.mockReturnValue(true);
    mockResolveInstallation.mockResolvedValue(INSTALLATION);
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 10, reset: 60 } as any);
    mockRunAction.mockResolvedValue({
      ok: true,
      data: { deduped: false, conversationId: 'conversation-1', messageId: 'message-1' },
    });
  });

  it('accepts a valid token and routes the message through the system Action', async () => {
    const response = await POST(request({
      installationId: INSTALLATION.installationId,
      visitorId: 'visitor-1',
      message: 'Olá',
      clinicId: 'attacker-clinic',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { deduped: false, conversationId: 'conversation-1', messageId: 'message-1' },
    });
    expect(mockRunAction).toHaveBeenCalledWith(
      expect.anything(),
      {
        externalConversationId: 'visitor-1',
        externalMessageId: 'message-1',
        message: 'Olá',
        metadata: { origin: ORIGIN, installationId: INSTALLATION.installationId },
      },
      'clinic-1',
    );
    expect(mockRunAction.mock.calls[0][1]).not.toHaveProperty('clinicId');
  });

  it('rejects invalid, expired, or cross-origin tokens before the Action', async () => {
    const token = issueWidgetToken(SECRET, { installationId: INSTALLATION.installationId, origin: 'https://other.example' }).token;
    const response = await POST(request({ visitorId: 'visitor-1', message: 'Olá' }, token));

    expect(response.status).toBe(401);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('rejects an origin that is not HTTPS/allowlisted', async () => {
    mockIsAllowedOrigin.mockReturnValue(false);

    const response = await POST(request({ visitorId: 'visitor-1', message: 'Olá' }, undefined, 'http://clinic.example'));

    expect(response.status).toBe(403);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('rejects malformed input and enforces rate limits', async () => {
    const invalid = await POST(request({ visitorId: 'visitor-1', message: '' }));
    expect(invalid.status).toBe(422);

    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, reset: 60 } as any);
    const limited = await POST(request({ visitorId: 'visitor-1', message: 'Olá' }));
    expect(limited.status).toBe(429);
    expect(mockRunAction).not.toHaveBeenCalled();
  });

  it('returns the canonical 405 envelope for GET without reading history', async () => {
    const response = await GET(new NextRequest('https://synkroo.example/api/widget/messages', { method: 'GET', headers: { origin: ORIGIN } }));

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST, OPTIONS');
    await expect(response.json()).resolves.toEqual({
      error: expect.objectContaining({ code: 'METHOD_NOT_ALLOWED', message: expect.any(String), requestId: expect.any(String) }),
    });
  });
});
