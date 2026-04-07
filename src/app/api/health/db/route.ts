import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * GET /api/health/db
 * Verifica estrutura do banco de dados
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient()
  const results: Record<string, { exists: boolean; count?: number; error?: string }> = {}

  // Tabelas esperadas
  const tables = [
    'clinics',
    'users',
    'patients',
    'dentists',
    'procedures',
    'conversations',
    'messages',
    'appointments',
    'schedule_blocks',
    'follow_ups',
    'knowledge_base',
    'whatsapp_instances',
    'message_templates',
    'patient_risk_scores',
    'audit_logs',
    'waitlist',
  ]

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        results[table] = { exists: false, error: error.message }
      } else {
        results[table] = { exists: true, count: count || 0 }
      }
    } catch (error) {
      results[table] = {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  const existingTables = Object.values(results).filter((r) => r.exists).length
  const totalTables = tables.length

  return NextResponse.json({
    status: existingTables === totalTables ? 'complete' : 'incomplete',
    tables_created: existingTables,
    tables_expected: totalTables,
    tables: results,
  })
}