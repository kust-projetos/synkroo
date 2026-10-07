import { NextRequest } from 'next/server'
import { eq, and, gte, lt, inArray, sql, isNull } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
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
 *
 * P1 money-path fail-closed: cada agregado que falha resolve para `null`
 * (desconhecido) em vez de zero fabricado. Zeros com `stale: true` significam
 * "valor desconhecido por falha técnica"; zeros sem a flag significam vazio
 * legítimo (EXPECTED_EMPTY). Se TODOS os agregados falharem, a resposta
 * global é falha (500), nunca `success` com zeros.
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
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
          pending: sql<number>`count(*) filter (where ${appointmentsTable.status} = 'scheduled')::int`,
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
          return null // P1: DEGRADED — unknown, never fabricated zero
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
          return null // P1: DEGRADED — unknown, never fabricated zero
        }),

      // 3. Inactive patients (isolated from failures)
      getInactivityStats(clinicId).catch((err) => {
        dbLogger.error('Dashboard stats: inactivityStats failed', { error: String(err) })
        return null // P1: DEGRADED — unknown, never fabricated zero (atRiskRevenue is money-path)
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
          return null // P1: DEGRADED — unknown, never fabricated zero
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
          return null // P1: DEGRADED — unknown, never fabricated zero
        }),

      // 6. Total patients count
      // P1: active-only — soft-deleted fora da métrica.
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(patientsTable)
        .where(and(eq(patientsTable.clinicId, clinicId), isNull(patientsTable.deletedAt)))
        .then(([r]) => r?.count ?? 0)
        .catch((err) => {
          dbLogger.error('Dashboard stats: patients count failed', { error: String(err) })
          return null // P1: DEGRADED — unknown, never fabricated zero
        }),
    ])

    // P1 fail-closed: track which aggregates are unknown. Zeros below are
    // only legitimate when their aggregate resolved (EXPECTED_EMPTY); failed
    // aggregates are explicitly flagged stale, and a total failure is a
    // global error — never success:true with fabricated zeros.
    const failedParts: string[] = []
    if (todayAgg === null) failedParts.push('todayAppointments')
    if (recentAgg === null) failedParts.push('recentAppointments')
    if (inactiveStats === null) failedParts.push('inactivityStats')
    if (activeCampaignsCount === null) failedParts.push('activeCampaigns')
    if (openConversationsCount === null) failedParts.push('openConversations')
    if (totalPatientsCount === null) failedParts.push('totalPatients')
    if (failedParts.length === 6) {
      return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
    }

    // Valores já agregados no banco — nenhuma linha bruta em memória.
    // P1: `?.` + `?? 0` — o zero só é legítimo quando o agregado resolveu;
    // agregado `null` (falho) é sinalizado via `stale` abaixo.
    const todayCount = todayAgg?.total ?? 0
    const confirmedCount = todayAgg?.confirmed ?? 0
    const pendingCount = todayAgg?.pending ?? 0

    // Confirmation rate a partir dos agregados de 30 dias
    const totalRecent = recentAgg?.total ?? 0
    const confirmedRecent = recentAgg?.confirmed ?? 0
    const confirmationRate = totalRecent > 0 ? Math.round((confirmedRecent / totalRecent) * 100) : 0
    const metricsStale =
      recentAgg === null ||
      activeCampaignsCount === null ||
      openConversationsCount === null ||
      totalPatientsCount === null

    return apiSuccess({
      today: {
        appointments: todayCount,
        confirmed: confirmedCount,
        pending: pendingCount,
        stale: todayAgg === null,
      },
      metrics: {
        confirmationRate,
        activeCampaigns: activeCampaignsCount ?? 0,
        openConversations: openConversationsCount ?? 0,
        totalPatients: totalPatientsCount ?? 0,
        stale: metricsStale,
      },
      inactivePatients: {
        totalInactive: inactiveStats?.totalInactive ?? 0,
        bySegment: inactiveStats?.bySegment ?? {},
        stale: inactiveStats === null,
      },
      // P1: zeros acompanhados de stale:true significam "desconhecido por
      // falha técnica", nunca vazio legítimo nem success mascarado.
      degraded: failedParts.length > 0,
      failedParts,
    })
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
