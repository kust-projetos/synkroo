import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lt, inArray, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { dbLogger } from '@/lib/logger'
import { getDb } from '@/lib/db/client'
import { patients as patientsTable, conversations } from '@/lib/db/schema'
import * as apptRepo from '@/repositories/appointments'
import * as campRepo from '@/repositories/campaigns'
import { getInactivityStats } from '@/services/followup/inactive-patient.service'

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for a clinic — migrated from Supabase to Drizzle.
 * All independent queries run in parallel via Promise.all().
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

    // Run all independent queries in parallel
    const [
      todayAppointments,
      recentAppointments,
      inactiveStats,
      activeCampaignsCount,
      openConversationsCount,
      totalPatientsCount,
    ] = await Promise.all([
      // 1. Today's appointments
      apptRepo.findByDateRange(clinicId, undefined, todayStart, todayEnd).catch((err) => {
        dbLogger.error('Dashboard stats: todayAppointments failed', { error: String(err) })
        return null
      }),

      // 2. Last 30 days for confirmation rate
      apptRepo.findByDateRange(clinicId, undefined, thirtyDaysAgo, todayEnd).catch((err) => {
        dbLogger.error('Dashboard stats: recentAppointments failed', { error: String(err) })
        return null
      }),

      // 3. Inactive patients (isolated from failures)
      getInactivityStats(clinicId).catch((err) => {
        dbLogger.error('Dashboard stats: inactivityStats failed', { error: String(err) })
        return { totalInactive: 0, bySegment: {}, atRiskRevenue: 0 }
      }),

      // 4. Active campaigns (running or scheduled)
      campRepo.findCampaignsByClinic(clinicId).then((campaigns) =>
        (campaigns || []).filter((c: any) => c.status === 'running' || c.status === 'scheduled').length
      ).catch((err) => {
        dbLogger.error('Dashboard stats: campaigns failed', { error: String(err) })
        return 0
      }),

      // 5. Open conversations (active + waiting)
      Promise.all([
        db.select({ count: sql<number>`count(*)::int` })
          .from(conversations)
          .where(and(eq(conversations.clinicId, clinicId), eq(conversations.status, 'active')))
          .then(([r]) => r?.count ?? 0),
        db.select({ count: sql<number>`count(*)::int` })
          .from(conversations)
          .where(and(eq(conversations.clinicId, clinicId), eq(conversations.status, 'waiting')))
          .then(([r]) => r?.count ?? 0),
      ]).then(([a, w]) => (a ?? 0) + (w ?? 0)).catch((err) => {
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

    // Process today's appointments
    const todayCount = todayAppointments?.length || 0
    const confirmedCount = todayAppointments?.filter((a: any) => a.status === 'confirmed').length || 0
    const pendingCount = todayAppointments?.filter((a: any) => a.status === 'pending' || a.status === 'scheduled').length || 0

    // Process confirmation rate
    const totalRecent = recentAppointments?.length || 0
    const confirmedRecent = recentAppointments?.filter(
      (a: any) => a.status === 'confirmed' || a.status === 'completed'
    ).length || 0
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
