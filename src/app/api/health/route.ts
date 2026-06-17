import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}

  // Database check via Drizzle
  try {
    const db = getDb()
    const dbStart = Date.now()
    const result = await db.execute(sql`SELECT 1 FROM clinics LIMIT 1`)
    const dbLatency = Date.now() - dbStart

    if (result) {
      checks.database = { status: 'ok', latency: dbLatency }
    } else {
      checks.database = { status: 'warning', latency: dbLatency, error: 'Empty result' }
    }
  } catch (error) {
    checks.database = { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
  }

  // Environment variables check
  const criticalEnvVars = {
    DATABASE_URL: !!process.env.DATABASE_URL,
  }
  const optionalEnvVars = {
    MINIMAX_API_KEY: !!process.env.MINIMAX_API_KEY,
  }
  const allCriticalSet = Object.values(criticalEnvVars).every(Boolean)
  const allOptionalSet = Object.values(optionalEnvVars).every(Boolean)
  checks.environment = {
    status: allCriticalSet ? (allOptionalSet ? 'ok' : 'warning') : 'error',
    ...criticalEnvVars, ...optionalEnvVars,
  }

  const allChecksPassed = Object.values(checks).every((c) => c.status === 'ok' || c.status === 'warning')
  return NextResponse.json({
    status: allChecksPassed ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    latency: Date.now() - startTime,
    version: '1.0.0',
    checks,
  }, { status: allChecksPassed ? 200 : 503 })
}
