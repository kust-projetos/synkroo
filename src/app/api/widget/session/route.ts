import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiFailure, apiRateLimited, apiSuccess, generateRequestId } from '@/lib/api/response';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { issueWidgetToken } from '@/lib/auth/widget-token';
import { isAllowedWidgetOrigin, resolveWidgetInstallation } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

function cors(response: NextResponse, origin: string): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('x-request-id', response.headers.get('x-request-id') ?? generateRequestId());
  return response;
}

function failure(origin: string, code: string, message: string, status: number): NextResponse {
  return cors(apiFailure(code, message, generateRequestId(), status), origin);
}

function queryInstallationId(request: NextRequest): string {
  return request.nextUrl.searchParams.get('installationId') ?? '';
}

// Etapa 2.5 (SYN-API-003): o body só carrega `installationId` (chave opaca de
// lookup, resolvida de forma fail-closed contra allowlist de origem). Não
// havia schema de runtime — só `typeof` inline. Schema mínimo na borda;
// comportamento idêntico (fallback '' → 403 na resolução).
const widgetSessionBodySchema = z.object({
  installationId: z.string().min(1).optional(),
});

async function resolveRequestInstallation(request: NextRequest, installationId: string) {
  const origin = request.headers.get('origin') ?? '';
  if (!isAllowedWidgetOrigin(origin)) return { origin, installation: null };
  return { origin, installation: await resolveWidgetInstallation(installationId, origin) };
}

async function handleOPTIONS(request: NextRequest): Promise<NextResponse> {
  const { origin, installation } = await resolveRequestInstallation(request, queryInstallationId(request));
  if (!installation) return failure(origin, 'FORBIDDEN', 'Origin not allowed.', 403);
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '300');
  return cors(response, origin);
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin') ?? '';
  if (!isAllowedWidgetOrigin(origin)) return failure(origin, 'FORBIDDEN', 'Origin not allowed.', 403);

  const rawBody = await request.json().catch(() => null) as unknown;
  const parsedBody = widgetSessionBodySchema.safeParse(rawBody ?? {});
  const bodyInstallationId = parsedBody.success ? (parsedBody.data.installationId ?? '') : '';
  const installationId = queryInstallationId(request) || bodyInstallationId;
  const { installation } = await resolveRequestInstallation(request, installationId);
  if (!installation) return failure(origin, 'FORBIDDEN', 'Invalid widget installation.', 403);

  const rateLimit = checkRateLimit(
    `${installation.installationId}:${getClientIdentifier(request)}`,
    { ...rateLimitPresets.auth, keyPrefix: 'widget-session' },
  );
  if (!rateLimit.allowed) return cors(apiRateLimited(generateRequestId(), rateLimit.retryAfter, 'Rate limit exceeded.'), origin);

  const secret = process.env.AUTH_SECRET ?? '';
  if (!secret) return failure(origin, 'INTERNAL_ERROR', 'Widget authentication is unavailable.', 500);
  const issued = issueWidgetToken(secret, {
    installationId: installation.installationId,
    origin,
    ttlSeconds: 300,
  });
  return cors(apiSuccess({ token: issued.token, expiresAt: new Date(issued.claims.expiresAt * 1000).toISOString() }), origin);
}

const gated = withModuleRoute('atendimento');
export const POST = gated(handlePOST);
export const OPTIONS = gated(handleOPTIONS);
