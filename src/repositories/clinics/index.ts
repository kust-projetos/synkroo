/**
 * Clinics Repository
 * Provides Drizzle-based access to clinics table
 */

import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics } from '@/lib/db/schema/core'
import { dbLogger } from '@/lib/logger'

export interface ClinicRow {
  id: string
  name: string
  slug: string
  phone: string
  email: string
  website: string | null
  address: Record<string, unknown>
  settings: Record<string, unknown>
  subscriptionPlan: string | null
  subscriptionStatus: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}

/**
 * Get clinic by ID
 */
export async function findClinicById(id: string): Promise<ClinicRow | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(clinics)
    .where(eq(clinics.id, id))
    .limit(1)
  return (row as ClinicRow) ?? null
}

/**
 * Get clinic config (alias for findClinicById, matches admin.ts interface)
 */
export async function getClinicConfig(clinicId: string): Promise<ClinicRow | null> {
  return findClinicById(clinicId)
}
