import { NextResponse } from 'next/server'

/**
 * POST /api/admin/run-migration
 * Migrations must be run via Drizzle CLI.
 * This endpoint is disabled.
 */
export async function POST() {
  return NextResponse.json(
    { error: 'Migrations are managed by Drizzle CLI; run npm run db:migrate' },
    { status: 403 }
  )
}