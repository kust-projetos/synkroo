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
 * Checagem de compatibilidade de migrations contra o LEDGER do Drizzle:
 * conta as entradas aplicadas em `drizzle.__drizzle_migrations` (tabela criada
 * pelo migrator `drizzle-orm/node-postgres` em schema `drizzle` por padrão —
 * o repo não configura `migrationsTable`/`migrationsSchema` custom).
 *
 * Menor que o esperado → incompleto. Igual/maior → completo.
 * `getDb()` fica DENTRO do fluxo protegido: falha de inicialização
 * (DATABASE_URL ausente/Hyperdrive) retorna agregado zerado sanitizado,
 * nunca `error.message` do driver. Reaproveitada pelo readiness interno,
 * que pode injetar o executor da transação (com `statement_timeout`).
 */
export async function checkMigrations(executor?: DbExecutor): Promise<MigrationStatus> {
  try {
    const db = executor ?? getDb()
    const result = (await db.execute(
      sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`,
    )) as { rows?: Array<{ count?: number | string }> }
    const raw = result?.rows?.[0]?.count ?? 0
    const applied = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10) || 0
    return { complete: applied >= EXPECTED_MIGRATIONS, applied, expected: EXPECTED_MIGRATIONS }
  } catch {
    // Intencional: DB inacessível ou ledger ausente conta como incompleto,
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
