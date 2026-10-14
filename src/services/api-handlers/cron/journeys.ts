import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { JOURNEY_TICK_BATCH_SIZE, tickPostVisitJourney } from '@/modules/followup';
import { apiSuccess, apiFailure, apiRateLimited, generateRequestId } from '@/lib/api/response';
import { checkRateLimit, rateLimitPresets } from '@/lib/rate-limit';

/**
 * POST /api/cron/journeys — tick OBSERVE da journey pós-consulta (P7 Slice 1).
 *
 * Varre em lote limitado as instâncias elegíveis e avança no máximo UM estado
 * por instância por execução. Sem envio, sem branches neste slice.
 *
 * Segurança (padrão outbox): CRON_SECRET Bearer via `timingSafeEqual`
 * ANTES do rate limiter (credencial inválida não consome quota).
 *
 * Agendamento: job `journeys` em `scripts/lib/cron-schedule.mjs`, OPT-IN
 * explícito via `CRON_JOBS_ENABLED` (desabilitado por default — NÃO adicionar
 * a `wrangler.toml` sem decisão do owner). Crons legados intactos.
 */
function isAuthorized(request: NextRequest): boolean {
  const provided = request.headers.get('Authorization') ?? '';
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  return Boolean(process.env.CRON_SECRET)
    && provided.length === expected.length
    && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

function parseLimit(request: NextRequest): number {
  const raw = Number(new URL(request.url).searchParams.get('limit') ?? JOURNEY_TICK_BATCH_SIZE);
  if (!Number.isFinite(raw)) return JOURNEY_TICK_BATCH_SIZE;
  return Math.min(Math.max(Math.floor(raw), 1), 100);
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  if (!isAuthorized(request)) {
    return apiFailure('UNAUTHORIZED', 'Unauthorized', requestId, 401);
  }
  // Auth-before-limiter (padrão outbox/cleanup): credencial inválida não consome quota.
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return apiRateLimited(requestId, rateLimit.retryAfter);
  }
  try {
    const result = await tickPostVisitJourney({ batchSize: parseLimit(request) });
    return apiSuccess({ success: true, ...result });
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500);
  }
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  if (!isAuthorized(request)) {
    return apiFailure('UNAUTHORIZED', 'Unauthorized', requestId, 401);
  }
  const rateLimit = checkRateLimit('cron', rateLimitPresets.cron);
  if (!rateLimit.allowed) {
    return apiRateLimited(requestId, rateLimit.retryAfter);
  }
  return NextResponse.json({
    status: 'ok',
    job: 'journeys',
    message: 'Journey tick endpoint is active (opt-in via CRON_JOBS_ENABLED)',
    defaultBatchSize: JOURNEY_TICK_BATCH_SIZE,
  });
}
