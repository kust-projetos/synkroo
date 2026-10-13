import { NextRequest } from 'next/server'
import { sql } from 'drizzle-orm'
import { apiSuccess } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'

/**
 * Número de migrations registradas em `src/lib/db/migrations/meta/_journal.json`.
 * Comparado contra o ledger aplicado no banco (`drizzle.__drizzle_migrations`).
 * Ao adicionar uma migration, atualize esta constante — o teste de sincronização
 * (`src/__tests__/api/health/route.test.ts`) quebra de propósito se divergir.
 */
export const EXPECTED_MIGRATIONS = 37

export interface MigrationStatus {
  complete: boolean
  applied: number
  expected: number
  /** Ledger do Drizzle completo (independente do shape do gate de manutenção). */
  ledgerComplete: boolean
  /**
   * Estado FUNCIONAL do gate de manutenção do outbox (migration 0036 expandida):
   * `present` só com tabela `outbox_control` (com a linha singleton), função e
   * trigger do gate HABILITADO (`tgenabled = 'O'`) em `outbox_jobs` e coluna
   * `claim_release` — um ambiente que aplicou a 0036 ORIGINAL está com o ledger
   * em 36 sem esses objetos e NÃO pode reportar readiness completo.
   * Shape sem a linha/trigger ativo não é segurança funcional: o gate não
   * decide nada. `unknown` quando o banco não responde (endpoint público).
   */
  maintenanceControl: 'present' | 'missing' | 'unknown'
}

type DbExecutor = Pick<ReturnType<typeof getDb>, 'execute'>

/**
 * Checagem FUNCIONAL (nível de conteúdo + estado ativo) do gate de manutenção
 * do outbox.
 *
 * O ledger do Drizzle sozinho não distingue "0036 expandida aplicada" de
 * "0036 original aplicada" (a entrada do ledger é a mesma). A primeira query
 * olha os objetos reais: tabela singleton, função do gate, trigger HABILITADO
 * em `outbox_jobs` e coluna `claim_release`. A segunda — só rodada quando a
 * tabela existe — confirma que a LINHA singleton (`id = 1`) está lá. Shape sem
 * a linha/trigger ativo não é segurança funcional: o gate não decide nada, e o
 * repair explícito (`scripts/outbox-control-repair.mjs --apply`) é a única
 * convergência (nunca silenciosa via migração).
 *
 * As duas queries são parse-safe de propósito: nada referencia `outbox_control`
 * diretamente antes de saber que ela existe (`to_regclass`/`pg_class` aceitam
 * nome ausente e devolvem NULL) — um shape "faltando" nunca vira erro de query.
 */
const OUTBOX_MAINTENANCE_OBJECTS_SQL = sql`
  SELECT
    EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = 'outbox_control'
        AND c.relkind = 'r'
        AND n.nspname = current_schema()
    ) AS control_table,
    EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'outbox_enforce_control_gate'
        AND n.nspname = current_schema()
    ) AS gate_function,
    EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = 'outbox_jobs'::regclass
         AND NOT t.tgisinternal
         AND t.tgenabled = 'O'
         AND t.tgtype = 19 -- BEFORE UPDATE FOR EACH ROW
         AND t.tgqual IS NULL -- sem predicado que possa restringir o gate
         AND t.tgfoid = (
          SELECT p.oid FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE p.proname = 'outbox_enforce_control_gate'
            AND n.nspname = current_schema()
        )
    ) AS gate_trigger,
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'outbox_jobs'
        AND column_name = 'claim_release'
    ) AS claim_release_column
`

/** Só executada quando a tabela existe (ver `OUTBOX_MAINTENANCE_OBJECTS_SQL`). */
const OUTBOX_CONTROL_ROW_SQL = sql`
  SELECT EXISTS (SELECT 1 FROM "outbox_control" WHERE "id" = 1) AS control_row
`

async function readMaintenanceControlShape(db: DbExecutor): Promise<'present' | 'missing'> {
  const objects = (await db.execute(OUTBOX_MAINTENANCE_OBJECTS_SQL)) as {
    rows?: Array<Record<string, unknown>>
  }
  const row = objects?.rows?.[0]
  if (!row?.control_table) return 'missing'
  const singleton = (await db.execute(OUTBOX_CONTROL_ROW_SQL)) as {
    rows?: Array<Record<string, unknown>>
  }
  const present = Boolean(row?.gate_function)
    && Boolean(row?.gate_trigger)
    && Boolean(row?.claim_release_column)
    && Boolean(singleton?.rows?.[0]?.control_row)
  return present ? 'present' : 'missing'
}

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
 * `complete` = ledger EXATO (== esperado, nem a menos nem a mais) E gate de
 * manutenção funcionalmente presente — um ledger 36/36 sobre a 0036 original
 * (sem o gate) NÃO é complete, e um ledger à FRENTE do journal (37 vs 36)
 * também não é: o binário espera exatamente o conjunto de migrations que
 * acompanha.
 *
 * Dois casos distintos:
 * (a) query executou e count != esperado → `{complete:false}` (migrations
 *     de fato pendentes, ou ambiente à frente do código; readiness responde
 *     `migrations-incomplete`);
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
    const ledgerComplete = applied === EXPECTED_MIGRATIONS
    const maintenanceControl = await readMaintenanceControlShape(executor)
    return {
      complete: ledgerComplete && maintenanceControl === 'present',
      applied,
      expected: EXPECTED_MIGRATIONS,
      ledgerComplete,
      maintenanceControl,
    }
  }
  try {
    const applied = await readAppliedCount(getDb())
    const ledgerComplete = applied === EXPECTED_MIGRATIONS
    const maintenanceControl = await readMaintenanceControlShape(getDb())
    return {
      complete: ledgerComplete && maintenanceControl === 'present',
      applied,
      expected: EXPECTED_MIGRATIONS,
      ledgerComplete,
      maintenanceControl,
    }
  } catch {
    // Intencional (caso b público): DB inacessível conta como incompleto,
    // sem expor mensagem de erro do driver ao cliente.
    return {
      complete: false,
      applied: 0,
      expected: EXPECTED_MIGRATIONS,
      ledgerComplete: false,
      maintenanceControl: 'unknown',
    }
  }
}

/**
 * Diagnóstico sanitizado de migrations para ambiente operacional.
 * Payload agregado — sem enumeração de schema, sem mensagens de erro brutas.
 * Sempre 200 (inclusive com DB fora); o corpo carrega `data.status`.
 */
export async function GET(_request: NextRequest) {
  const { complete, applied, expected, maintenanceControl } = await checkMigrations()
  return apiSuccess({
    status: complete ? 'complete' : 'incomplete',
    complete,
    migrationsApplied: applied,
    migrationsExpected: expected,
    maintenanceControl,
  })
}
