import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lt, inArray, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { dbLogger } from '@/lib/logger'
import { getDb } from '@/lib/db/client'
import {
  appointments as appointmentsTable,
  campaigns as campaignsTable,
  patients as patientsTable,
  conversations,
} from '@/lib/db/schema'
import { getInactivityStats } from '@/services/followup/inactive-patient.service'

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for a clinic — migrated from Supabase to Drizzle.
 * All independent queries run in parallel via Promise.all().
 *
 * Escala: nenhum endpoint traz linhas brutas para a memória. Contagens e
 * taxas são calculadas no Postgres via count(*) + FILTER, inclusive para as
 * janelas de hoje e de 30 dias.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const db = getDb()

    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000)

    const thirtyDaysAgo = new Date(todayStart.getTime() - 30 * 24 * 3600 * 1000)

    const notDeleted = sql`${appointmentsTable.deletedAt} IS NULL`

    // Run all independent queries in parallel
    const [
      todayAgg,
      recentAgg,
      inactiveStats,
      activeCampaignsCount,
      openConversationsCount,
      totalPatientsCount,
    ] = await Promise.all([
      // 1. Today's appointments — agregação SQL direta (total, confirmed, pending)
      db
        .select({
          total: sql<number>`count(*)::int`,
          confirmed: sql<number>`count(*) filter (where ${appointmentsTable.status} = 'confirmed')::int`,
          pending: sql<number>`count(*) filter (where ${appointmentsTable.status} in ('scheduled', 'pending'))::int`,
        })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.clinicId, clinicId),
            gte(appointmentsTable.scheduledAt, todayStart),
            lt(appointmentsTable.scheduledAt, todayEnd),
            notDeleted
          )
        )
        .then(([r]) => r ?? { total: 0, confirmed: 0, pending: 0 })
        .catch((err) => {
          dbLogger.error('Dashboard stats: todayAppointments failed', { error: String(err) })
          return { total: 0, confirmed: 0, pending: 0 }
        }),

      // 2. Last 30 days for confirmation rate — agregação SQL direta
      db
        .select({
          total: sql<number>`count(*)::int`,
          confirmed: sql<number>`count(*) filter (where ${appointmentsTable.status} in ('confirmed', 'completed'))::int`,
        })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.clinicId, clinicId),
            gte(appointmentsTable.scheduledAt, thirtyDaysAgo),
            lt(appointmentsTable.scheduledAt, todayEnd),
            notDeleted
          )
        )
        .then(([r]) => r ?? { total: 0, confirmed: 0 })
        .catch((err) => {
          dbLogger.error('Dashboard stats: recentAppointments failed', { error: String(err) })
          return { total: 0, confirmed: 0 }
        }),

      // 3. Inactive patients (isolated from failures)
      getInactivityStats(clinicId).catch((err) => {
        dbLogger.error('Dashboard stats: inactivityStats failed', { error: String(err) })
        return { totalInactive: 0, bySegment: {}, atRiskRevenue: 0 }
      }),

      // 4. Active campaigns (running or scheduled) — contagem direta SQL
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(campaignsTable)
        .where(
          and(
            eq(campaignsTable.clinicId, clinicId),
            inArray(campaignsTable.status, ['running', 'scheduled'])
          )
        )
        .then(([r]) => r?.count ?? 0)
        .catch((err) => {
          dbLogger.error('Dashboard stats: campaigns failed', { error: String(err) })
          return 0
        }),

      // 5. Open conversations (active + waiting) — contagem direta SQL única
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(
          and(
            eq(conversations.clinicId, clinicId),
            inArray(conversations.status, ['active', 'waiting'] as any)
          )
        )
        .then(([r]) => r?.count ?? 0)
        .catch((err) => {
          dbLogger.error('Dashboard stats: conversations failed', { error: String(err) })
          return 0
        }),

      // 6. Total patients count
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(patientsTable)
        .where(eq(patientsTable.clinicId, clinicId))
        .then(([r]) => r?.count ?? 0)
        .catch((err) => {
          dbLogger.error('Dashboard stats: patients count failed', { error: String(err) })
          return 0
        }),
    ])

    // Valores já agregados no banco — nenhuma linha bruta em memória
    const todayCount = todayAgg.total ?? 0
    const confirmedCount = todayAgg.confirmed ?? 0
    const pendingCount = todayAgg.pending ?? 0

    // Confirmation rate a partir dos agregados de 30 dias
    const totalRecent = recentAgg.total ?? 0
    const confirmedRecent = recentAgg.confirmed ?? 0
    const confirmationRate = totalRecent > 0 ? Math.round((confirmedRecent / totalRecent) * 100) : 0

    return NextResponse.json({
      today: {
        appointments: todayCount,
        confirmed: confirmedCount,
        pending: pendingCount,
      },
      metrics: {
        confirmationRate,
        activeCampaigns: activeCampaignsCount,
        openConversations: openConversationsCount,
        totalPatients: totalPatientsCount,
      },
      inactivePatients: {
        totalInactive: inactiveStats.totalInactive ?? 0,
        bySegment: inactiveStats.bySegment ?? {},
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
