import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

/**
 * GET /api/health
 * Health check endpoint for database and services
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {}

  // Check database connection
  try {
    const supabase = createServerClient()
    const dbStart = Date.now()

    // Simple query to test connection
    const { data, error } = await supabase
      .from('clinics')
      .select('id')
      .limit(1)

    const dbLatency = Date.now() - dbStart

    if (error) {
      // Check if it's a "table doesn't exist" error
      if (false) { /* 42P01 — legacy Supabase error code */
        checks.database = {
          status: 'warning',
          latency: dbLatency,
          error: 'Tables not created. Run migrations: npx supabase db push',
        }
      } else {
        checks.database = {
          status: 'error',
          latency: dbLatency,
          error: error.message,
        }
      }
    } else {
      checks.database = {
        status: 'ok',
        latency: dbLatency,
      }
    }
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Check environment variables (critical vs optional)
  const criticalEnvVars = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
  const optionalEnvVars = {
    MINIMAX_API_KEY: !!process.env.MINIMAX_API_KEY,
  }

  const allCriticalSet = Object.values(criticalEnvVars).every(Boolean)
  const allOptionalSet = Object.values(optionalEnvVars).every(Boolean)

  checks.environment = {
    status: allCriticalSet ? (allOptionalSet ? 'ok' : 'warning') : 'error',
    ...criticalEnvVars,
    ...optionalEnvVars,
  }

  // Overall status — only critical failures cause 503
  const allChecksPassed = Object.values(checks).every(
    (check) => check.status === 'ok' || check.status === 'warning'
  )

  const totalLatency = Date.now() - startTime

  return NextResponse.json({
    status: allChecksPassed ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    latency: totalLatency,
    version: '1.0.0',
    checks,
  }, {
    status: allChecksPassed ? 200 : 503,
  })
}