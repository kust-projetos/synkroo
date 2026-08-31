import { NextRequest } from 'next/server';
import { verifyWidgetToken } from '@/lib/auth/widget-token';
import { POST } from './route';
import { checkRateLimit } from '@/lib/rate-limit';
import { isAllowedWidgetOrigin, resolveWidgetInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';

jest.mock('@/core/modules/gates', () => ({ withModuleRoute: () => (handler: unknown) => handler }));
jest.mock('@/core/modules/manifest', () => ({ createManifest: () => ({}) }));
jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 10, reset: 60 }),
  getClientIdentifier: jest.fn().mockReturnValue('widget-client'),
  rateLimitPresets: { auth: {} },
}));
jest.mock('@/modules/atendimento/integrations/resolve-channel-installation', () => ({
  isAllowedWidgetOrigin: jest.fn(),
  resolveWidgetInstallation: jest.fn(),
}));

const mockRateLimit = jest.mocked(checkRateLimit);
const mockIsAllowedOrigin = jest.mocked(isAllowedWidgetOrigin);
const mockResolveInstallation = jest.mocked(resolveWidgetInstallation);

const SECRET = 'widget-test-secret-with-at-least-32-characters';
const ORIGIN = 'https://clinic.example';

function request(body: unknown, origin = ORIGIN) {
  return new NextRequest('https://synkroo.example/api/widget/session?installationId=public-installation', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/widget/session', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = SECRET;
    jest.clearAllMocks();
    mockIsAllowedOrigin.mockReturnValue(true);
    mockResolveInstallation.mockResolvedValue({
      installationId: 'public-installation',
      clinicId: 'clinic-1',
      allowedOrigins: [ORIGIN],
    });
    mockRateLimit.mockReturnValue({ allowed: true, remaining: 10, reset: 60 } as any);
  });

  it('issues a short-lived token for an enabled installation and approved origin', async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.token).toEqual(expect.any(String));
    expect(body.data.expiresAt).toEqual(expect.any(String));
    expect(verifyWidgetToken(SECRET, body.data.token)?.installationId).toBe('public-installation');
    expect(verifyWidgetToken(SECRET, body.data.token)?.origin).toBe(ORIGIN);
    expect(mockResolveInstallation).toHaveBeenCalledWith('public-installation', ORIGIN);
  });

  it('rejects non-HTTPS or unapproved origins before resolving installation', async () => {
    mockIsAllowedOrigin.mockReturnValue(false);

    const response = await POST(request({}, 'http://clinic.example'));

    expect(response.status).toBe(403);
    expect(mockResolveInstallation).not.toHaveBeenCalled();
  });

  it('rejects a disabled or unknown installation', async () => {
    mockResolveInstallation.mockResolvedValue(null);

    const response = await POST(request({}));

    expect(response.status).toBe(403);
  });

  it('applies the session rate limit per installation and client', async () => {
    mockRateLimit.mockReturnValue({ allowed: false, remaining: 0, reset: 60 } as any);

    const response = await POST(request({}));

    expect(response.status).toBe(429);
    expect(mockRateLimit).toHaveBeenCalledWith(
      'public-installation:widget-client',
      expect.objectContaining({ keyPrefix: 'widget-session' }),
    );
  });
});
