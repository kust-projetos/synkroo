import { NextRequest } from 'next/server'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import {
  agentRuns,
  businessEvents,
  followupJourneyInstances,
  goals,
} from '@/lib/db/schema'
import {
  IA_ACTIVITY_RECENT_LIMIT,
  journeyStateLabel,
  runStatusLabel,
  type IaActivityRecentItem,
} from '@/lib/dashboard/ia-activity'

/**
 * GET /api/dashboard/activity — P8 Slice 1 (read-only, aditivo).
 *
 * Painel de atividade IA real na home: contadores + recentes de runs/goals
 * (P4 OBSERVE) e journeys/outcomes (P7 S1), com a clínica sempre derivada da
 * sessão autenticada — nunca de parâmetro.
 *
 * Invariantes (7 critérios do design):
 * 1. Aditivo: não toca nenhuma métrica existente (endpoint novo, sem
 *    alteração em stats/alerts).
 * 2. Isolamento: TODA query filtra por `clinic_id` da sessão; o join lógico
 *    runs↔events casa (`clinic_id`, `event_id`) em lote (1 query com IN).
 * 3. Literais: `status` expõe o literal do banco (`observed`, ...) e `label`
 *    o rótulo pt-BR (`proposta observada` para `observed`).
 * 4. Queries fixas: no máximo 6 SELECTs independente do volume (3 counts +
 *    runs + events em lote + journeys) — nunca N+1.
 * 5. Allowlist: a resposta só carrega os campos de `IaActivity*`; nunca
 *    `payload`, `result`, `sources`, `subject_*` ou `error_code`.
 * 6. Vazio/falha/ordenação: sem linhas → 200 com arrays vazios e zeros (não
 *    404); falha de DB → 500 (fail-closed, nunca vazio fabricado); recentes
 *    fundidos em `created_at` desc, top 20.
 * 7. Zero mutação: só SELECT. Não chama prepare/tick/transição/envio nem
 *    importa nenhum serviço de mutação P4/P7.
 */
export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const clinicId = authResult.profile!.clinic_id
    void request
    const db = getDb()

    // Q1–Q3 (fixas): contadores por status/state, sempre com tenant.
    const [runGroups, goalGroups, journeyGroups] = await Promise.all([
      db
        .select({ status: agentRuns.status, count: sql<number>`count(*)::int` })
        .from(agentRuns)
        .where(eq(agentRuns.clinicId, clinicId))
        .groupBy(agentRuns.status),
      db
        .select({ status: goals.status, count: sql<number>`count(*)::int` })
        .from(goals)
        .where(eq(goals.clinicId, clinicId))
        .groupBy(goals.status),
      db
        .select({ status: followupJourneyInstances.state, count: sql<number>`count(*)::int` })
        .from(followupJourneyInstances)
        .where(eq(followupJourneyInstances.clinicId, clinicId))
        .groupBy(followupJourneyInstances.state),
    ])

    const runCounts: Record<string, number> = {}
    for (const g of runGroups) runCounts[g.status] = g.count
    const goalCounts: Record<string, number> = {}
    for (const g of goalGroups) goalCounts[g.status] = g.count
    const journeyCounts: Record<string, number> = {}
    for (const g of journeyGroups) journeyCounts[g.status] = g.count

    // Q4 (fixa): 20 runs mais recentes — projeção allowlist, sem
    // result/sources/error_code.
    const recentRuns = await db
      .select({
        id: agentRuns.id,
        eventId: agentRuns.eventId,
        status: agentRuns.status,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(eq(agentRuns.clinicId, clinicId))
      .orderBy(desc(agentRuns.createdAt))
      .limit(IA_ACTIVITY_RECENT_LIMIT)

    // Q5 (fixa, condicional): envelopes dos eventos em LOTE por
    // (clinic_id, event_id) — 1 query para N runs, nunca N+1. Pulada quando
    // não há runs (mantém o total fixo em 5 nesse caso).
    const eventIds = [...new Set(recentRuns.map((r) => r.eventId))]
    const eventById = new Map<string, { type: string; occurredAt: Date }>()
    if (eventIds.length > 0) {
      const eventRows = await db
        .select({
          eventId: businessEvents.eventId,
          type: businessEvents.type,
          occurredAt: businessEvents.occurredAt,
        })
        .from(businessEvents)
        .where(
          and(
            eq(businessEvents.clinicId, clinicId),
            inArray(businessEvents.eventId, eventIds),
          ),
        )
      for (const e of eventRows) {
        if (!eventById.has(e.eventId)) {
          eventById.set(e.eventId, { type: e.type, occurredAt: e.occurredAt })
        }
      }
    }

    // Q6 (fixa): 20 journeys mais recentes — projeção allowlist, sem
    // appointment_id/source_event_id (correlação interna, sem valor p/ UI).
    const recentJourneys = await db
      .select({
        id: followupJourneyInstances.id,
        journeyKind: followupJourneyInstances.journeyKind,
        state: followupJourneyInstances.state,
        outcome: followupJourneyInstances.outcome,
        createdAt: followupJourneyInstances.createdAt,
      })
      .from(followupJourneyInstances)
      .where(eq(followupJourneyInstances.clinicId, clinicId))
      .orderBy(desc(followupJourneyInstances.createdAt))
      .limit(IA_ACTIVITY_RECENT_LIMIT)

    const items: IaActivityRecentItem[] = [
      ...recentRuns.map((r) => {
        const env = eventById.get(r.eventId) ?? null
        return {
          key: `run:${r.id}`,
          kind: 'run' as const,
          status: r.status,
          label: runStatusLabel(r.status),
          eventType: env?.type ?? null,
          occurredAt: env ? env.occurredAt.toISOString() : null,
          createdAt: (r.createdAt ?? new Date()).toISOString(),
          detail: null,
        }
      }),
      ...recentJourneys.map((j) => ({
        key: `journey:${j.id}`,
        kind: 'journey' as const,
        status: j.state,
        label: journeyStateLabel(j.state),
        eventType: j.journeyKind,
        occurredAt: null,
        createdAt: (j.createdAt ?? new Date()).toISOString(),
        detail: j.outcome,
      })),
    ]
    items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    const recent = items.slice(0, IA_ACTIVITY_RECENT_LIMIT)

    // R12: soma transversal apenas informativa (runs + goals + journeys são
    // entidades distintas — NUNCA rotular como "eventos observados" na UI;
    // o painel exibe contadores separados por entidade/status).
    const total =
      Object.values(runCounts).reduce((acc, n) => acc + n, 0) +
      Object.values(goalCounts).reduce((acc, n) => acc + n, 0) +
      Object.values(journeyCounts).reduce((acc, n) => acc + n, 0)

    return apiSuccess({
      counts: { runs: runCounts, goals: goalCounts, journeys: journeyCounts, total },
      recent,
    })
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
