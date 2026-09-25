import { z } from 'zod';
import { apiFailure, apiRateLimited, apiSuccess, generateRequestId } from '@/lib/api/response';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';
import { ActionError } from '@/core/actions/types';

const inputSchema = z.object({ patientId: z.string().uuid() }).strict();

function statusFor(code: string): number {
  if (code === 'unauthenticated') return 401;
  if (code === 'forbidden') return 403;
  if (code === 'not_found') return 404;
  if (code === 'internal') return 500;
  return 400;
}

function responseWithId(response: Response, requestId: string) {
  response.headers.set('x-request-id', requestId);
  return response;
}

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') ?? generateRequestId();
  try {
    const { buildUserContext } = await import('@/core/actions/context');
    const { runAction } = await import('@/core/actions/run');
    const { exportarDadosPaciente } = await import('@/modules/operacional');
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return responseWithId(apiFailure('INVALID_INPUT', 'Dados inválidos.', requestId, 400), requestId);
    // Auth-before-limiter (padrão cron/webhook): o contexto (sessão) é
    // resolvido primeiro — chamadas não autenticadas lançam
    // 'unauthenticated' e caem no 401 abaixo sem consumir quota.
    // O ctx pré-construído é reaproveitado no runAction (sem rebuild).
    const ctx = await buildUserContext();
    const exportLimit = checkRateLimit(`user:${ctx.user?.id ?? 'unknown'}`, {
      ...rateLimitPresets.api,
      keyPrefix: 'lgpd-export',
    });
    if (!exportLimit.allowed) {
      return responseWithId(apiRateLimited(requestId, exportLimit.retryAfter, 'Rate limit exceeded.'), requestId);
    }
    const result = await runAction(exportarDadosPaciente, parsed.data, ctx);
    if (!result.ok) return responseWithId(apiFailure(result.error.code.toUpperCase(), result.error.message, requestId, statusFor(result.error.code)), requestId);
    return responseWithId(apiSuccess(result.data), requestId);
  } catch (error) {
    if ((error instanceof ActionError && error.code === 'unauthenticated') || (error instanceof Error && error.message === 'unauthenticated')) {
      return responseWithId(apiFailure('UNAUTHENTICATED', 'Não autenticado.', requestId, 401), requestId);
    }
    return responseWithId(apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500), requestId);
  }
}
