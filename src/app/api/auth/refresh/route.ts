import { NextResponse } from 'next/server'

/**
 * POST /api/auth/refresh
 *
 * DEPRECATED: Auth.js JWT sessions auto-refresh on each request
 * via the `maxAge` configuration (30 days). No explicit refresh
 * endpoint is needed. This route returns success for backward
 * compatibility with any frontend code that may still call it.
 */
export async function POST() {
  return NextResponse.json({
    success: true,
    note: 'Session refresh is handled automatically by Auth.js JWT cookies. This endpoint exists for backward compatibility.',
  })
}
