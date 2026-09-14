import { NextRequest, NextResponse } from 'next/server'

/**
 * Liveness puro: indica apenas que o processo está vivo e respondendo.
 *
 * NÃO consulta o banco de dados nem nenhuma dependência externa (opcional ou
 * essencial). Readiness real (DB acessível + migrations compatíveis) vive em
 * `/api/internal/readiness`, protegido por CRON_SECRET/sessão.
 *
 * Retorna 200 sempre que o processo responder. Payload mínimo, sem `checks`,
 * sem `latency` e sem mensagens de erro de drivers — nada que exponha internos.
 */
export async function GET(_request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
}
