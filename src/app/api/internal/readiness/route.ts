import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { checkReadiness } from '@/services/api-handlers/health/readiness';

function isAuthorizedByCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? request.headers.get('x-cron-secret') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    // timingSafeEqual exige buffers de mesmo tamanho
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Readiness real (interno, protegido): checagem de banco + migrations via
 * camada de serviço. Apenas dependências essenciais — opcionais
 * (Evolution/LLM) NÃO derrubam o serviço e ficam de fora.
 *
 * Payload mais rico que o liveness público, mas sem secrets e sem
 * `error.message` do driver: falhas usam motivos curtos estáticos
 * (`db-unreachable`, `migrations-incomplete`). Toda resposta inclui
 * `durationMs` (insumo G5). Falha → 503.
 */
export async function GET(request: NextRequest) {
  // F11.07: barato e protegido — aceita CRON_SECRET (timingSafeEqual) OU sessão autenticada
  if (!isAuthorizedByCronSecret(request)) {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const result = await checkReadiness();

  if (!result.ok) {
    return NextResponse.json(
      { status: 'not-ready', reason: result.reason, durationMs: result.durationMs },
      { status: 503 },
    );
  }

  return NextResponse.json({
    status: 'ready',
    checks: { database: 'ok', migrations: 'complete' },
    durationMs: result.durationMs,
  });
}
