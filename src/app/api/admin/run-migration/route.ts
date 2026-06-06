import { NextResponse } from 'next/server'

/**
 * POST /api/admin/run-migration
 * Migrations must be run via Supabase CLI.
 * This endpoint is disabled.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Migrations must be run via Supabase CLI' },
    { status: 403 }
  )
}