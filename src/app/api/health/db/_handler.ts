import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const db = getDb()
  const results: Record<string, { exists: boolean; count?: number; error?: string }> = {}
  const tables = ['clinics', 'users', 'patients', 'dentists', 'procedures', 'conversations', 'messages', 'appointments', 'schedule_blocks', 'follow_ups', 'knowledge_base', 'whatsapp_instances', 'message_templates', 'patient_risk_scores', 'audit_logs', 'waitlist']

  for (const table of tables) {
    try {
      const r = await db.execute(sql`SELECT COUNT(*)::int as count FROM ${sql.raw(table)}`)
      const count = (r as any)?.rows?.[0]?.count ?? 0
      results[table] = { exists: true, count }
    } catch (error) {
      results[table] = { exists: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  const existing = Object.values(results).filter((r) => r.exists).length
  return NextResponse.json({ status: existing === tables.length ? 'complete' : 'incomplete', tables_created: existing, tables_expected: tables.length, tables: results })
}
