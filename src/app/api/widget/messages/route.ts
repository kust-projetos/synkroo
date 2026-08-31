import { NextRequest, NextResponse } from 'next/server';
import { apiFailure, apiSuccess, generateRequestId } from '@/lib/api/response';
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit';
import { verifyWidgetToken } from '@/lib/auth/widget-token';
import { resolveWidgetInstallation, isAllowedWidgetOrigin } from '@/modules/atendimento/integrations/resolve-channel-installation';
import { receberWidgetMensagem } from '@/modules/atendimento/actions/receber-widget-mensagem';
import { runAtendimentoSystemActionResult } from '@/modules/atendimento/ui/route-adapter';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';

const MAX_BODY_BYTES = 64 * 1024;

function withCors(response: NextResponse, origin: string): NextResponse {
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('x-request-id', response.headers.get('x-request-id') ?? generateRequestId());
  return response;
}

function failure(origin: string, code: string, message: string, status: number): NextResponse {
  const response = apiFailure(code, message, generateRequestId(), status);
  return withCors(response, origin);
}

function installationIdFrom(request: NextRequest, body?: Record<string, unknown> | null): string {
  const fromQuery = request.nextUrl.searchParams.get('installationId');
  if (fromQuery) return fromQuery;
  return typeof body?.installationId === 'string' ? body.installationId : '';
}

async function resolveOriginInstallation(request: NextRequest, installationId: string) {
  const origin = request.headers.get('origin') ?? '';
  if (!isAllowedWidgetOrigin(origin)) return { origin, installation: null };
  const installation = await resolveWidgetInstallation(installationId, origin);
  return { origin, installation };
}

async function handleOPTIONS(request: NextRequest): Promise<NextResponse> {
  const installationId = installationIdFrom(request);
  const { origin, installation } = await resolveOriginInstallation(request, installationId);
  if (!installation) return failure(origin, 'FORBIDDEN', 'Origin not allowed.', 403);
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
  response.headers.set('Access-Control-Max-Age', '300');
  return withCors(response, origin);
}

async function handlePOST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin') ?? '';
  if (!isAllowedWidgetOrigin(origin)) return failure(origin, 'FORBIDDEN', 'Origin not allowed.', 403);

  const raw = await request.arrayBuffer();
  if (raw.byteLength > MAX_BODY_BYTES) return failure(origin, 'INVALID_INPUT', 'Payload too large.', 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(new TextDecoder().decode(raw)) as Record<string, unknown>;
  } catch {
    return failure(origin, 'INVALID_INPUT', 'Invalid request body.', 400);
  }

  const installationId = installationIdFrom(request, body);
  const { installation } = await resolveOriginInstallation(request, installationId);
  if (!installation) return failure(origin, 'FORBIDDEN', 'Invalid widget installation.', 403);

  const clientKey = `${installation.installationId}:${getClientIdentifier(request)}`;
  const rateLimit = checkRateLimit(clientKey, { ...rateLimitPresets.messages, keyPrefix: 'widget-message' });
  if (!rateLimit.allowed) return failure(origin, 'TOO_MANY_REQUESTS', 'Rate limit exceeded.', 429);

  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const claims = verifyWidgetToken(process.env.AUTH_SECRET ?? '', token);
  if (!claims || claims.installationId !== installation.installationId || claims.origin !== origin) {
    return failure(origin, 'UNAUTHORIZED', 'Invalid or expired widget token.', 401);
  }

  const visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
  const idempotencyKey = request.headers.get('idempotency-key')
    ?? (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '');
  const message = typeof body.message === 'string' ? body.message : '';
  if (!visitorId || !idempotencyKey || !message) {
    return failure(origin, 'INVALID_INPUT', 'visitorId, idempotencyKey and message are required.', 422);
  }

  const result = await runAtendimentoSystemActionResult(receberWidgetMensagem, {
    externalConversationId: visitorId,
    externalMessageId: idempotencyKey,
    message,
    metadata: { origin, installationId: installation.installationId },
  }, installation.clinicId);
  if (!result.ok) {
    const status = result.error.code === 'invalid_input' ? 422 : 500;
    return failure(origin, result.error.code.toUpperCase(), result.error.message, status);
  }
  return withCors(apiSuccess(result.data), origin);
}

async function handleGET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin') ?? '';
  const response = failure(origin, 'METHOD_NOT_ALLOWED', 'Use POST to send a widget message.', 405);
  response.headers.set('Allow', 'POST, OPTIONS');
  return response;
}

const gated = withModuleRoute('atendimento');
export const GET = gated(handleGET);
export const POST = gated(handlePOST);
export const OPTIONS = gated(handleOPTIONS);
