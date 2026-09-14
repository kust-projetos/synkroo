import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'

/**
 * Lista interna de tabelas esperadas pelo schema. Não é exposta no payload:
 * o endpoint retorna apenas agregados (booleano + contagens), sem enumeração
 * de schema e sem `error.message` do driver.
 */
const EXPECTED_TABLES = ['clinics', 'users', 'patients', 'dentists', 'procedures', 'conversations', 'messages', 'appointments', 'schedule_blocks', 'follow_ups', 'knowledge_base', 'whatsapp_instances', 'message_templates', 'patient_risk_scores', 'audit_logs', 'waitlist']

export interface MigrationStatus {
  complete: boolean
  created: number
  expected: number
}

/**
 * Checagem de compatibilidade de migrations: conta quantas tabelas esperadas
 * existem (probe barato `SELECT 1 ... LIMIT 1`, sem COUNT). Erros do driver
 * são absorvidos — o chamador recebe apenas o agregado, nunca `error.message`.
 * Reaproveitada pelo readiness interno (`/api/internal/readiness`).
 */
export async function checkMigrations(): Promise<MigrationStatus> {
  const db = getDb()
  let created = 0

  for (const table of EXPECTED_TABLES) {
    try {
      await db.execute(sql`SELECT 1 FROM ${sql.raw(table)} LIMIT 1`)
      created += 1
    } catch {
      // Intencional: tabela ausente/inacessível conta como incompleta,
      // sem expor mensagem de erro do driver ao cliente.
    }
  }

  return { complete: created === EXPECTED_TABLES.length, created, expected: EXPECTED_TABLES.length }
}

/**
 * Diagnóstico sanitizado de migrations para ambiente operacional.
 * Payload agregado — sem contagens por tabela, sem enumeração de schema,
 * sem mensagens de erro brutas. Sempre 200; o corpo carrega `status`.
 */
export async function GET(_request: NextRequest) {
  const { complete, created, expected } = await checkMigrations()
  return NextResponse.json({
    status: complete ? 'complete' : 'incomplete',
    complete,
    tables_created: created,
    tables_expected: expected,
  })
}
