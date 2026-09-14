import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'

/**
 * Número de migrations registradas em `src/lib/db/migrations/meta/_journal.json`.
 * Comparado contra o ledger aplicado no banco (`drizzle.__drizzle_migrations`).
 * Ao adicionar uma migration, atualize esta constante — o teste de sincronização
 * (`src/__tests__/api/health/route.test.ts`) quebra de propósito se divergir.
 */
export const EXPECTED_MIGRATIONS = 30

export interface MigrationStatus {
  complete: boolean
  applied: number
  expected: number
}

type DbExecutor = Pick<ReturnType<typeof getDb>, 'execute'>

/**
 * Lê o ledger do Drizzle e retorna quantas migrations estão aplicadas.
 * LANÇA em caso de falha do executor (timeout/conexão/ledger ausente) —
 * cabe ao chamador decidir entre absorver (endpoint público) ou propagar
 * (readiness interno, que mapeia para `db-unreachable`).
 */
async function readAppliedCount(db: DbExecutor): Promise<number> {
  const result = (await db.execute(
    sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
  )) as { rows?: Array<{ count?: number | string }> }
  const raw = result?.rows?.[0]?.count ?? 0
  return typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10) || 0
}

/**
 * Checagem de compatibilidade de migrations contra o LEDGER do Drizzle:
 * conta as entradas aplicadas em `drizzle.__drizzle_migrations` (tabela criada
 * pelo migrator `drizzle-orm/node-postgres` em schema `drizzle` por padrão —
 * o repo não configura `migrationsTable`/`migrationsSchema` custom).
 *
 * Dois casos distintos:
 * (a) query executou e count < esperado → `{complete:false}` (migrations
 *     de fato pendentes; readiness responde `migrations-incomplete`);
 * (b) executor LANÇOU (timeout/conexão/ledger ausente):
 *     - com executor injetado (readiness, dentro da transação com
 *       `statement_timeout`) → o erro PROPAGA para a rota responder
 *       `db-unreachable` (diagnóstico correto: DB, não migrations);
 *     - sem executor (endpoint público `/api/health/db`) → absorvido aqui e
 *       retornado agregado zerado sanitizado, HTTP 200 mantido, nunca
 *       `error.message` do driver. Decisão pelo menor risco: o endpoint
 *       público preserva o contrato atual (sempre 200 + agregado); a
 *       distinção fina de causa fica no readiness protegido.
 * `getDb()` fica DENTRO do fluxo protegido: falha de inicialização
 * (DATABASE_URL ausente/Hyperdrive) cai no caso (b) público.
 */
export async function checkMigrations(executor?: DbExecutor): Promise<MigrationStatus> {
  if (executor) {
    const applied = await readAppliedCount(executor)
    return { complete: applied >= EXPECTED_MIGRATIONS, applied, expected: EXPECTED_MIGRATIONS }
  }
  try {
    const applied = await readAppliedCount(getDb())
    return { complete: applied >= EXPECTED_MIGRATIONS, applied, expected: EXPECTED_MIGRATIONS }
  } catch {
    // Intencional (caso b público): DB inacessível conta como incompleto,
    // sem expor mensagem de erro do driver ao cliente.
    return { complete: false, applied: 0, expected: EXPECTED_MIGRATIONS }
  }
}

/**
 * Diagnóstico sanitizado de migrations para ambiente operacional.
 * Payload agregado — sem enumeração de schema, sem mensagens de erro brutas.
 * Sempre 200 (inclusive com DB fora); o corpo carrega `status`.
 */
export async function GET(_request: NextRequest) {
  const { complete, applied, expected } = await checkMigrations()
  return NextResponse.json({
    status: complete ? 'complete' : 'incomplete',
    complete,
    migrations_applied: applied,
    migrations_expected: expected,
  })
}
