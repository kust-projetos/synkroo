import { NextRequest } from 'next/server'
import { and, asc, eq, or, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getDb } from '@/lib/db/client'
import {
  agentRuns,
  followupJourneyInstances,
  pendingActions,
} from '@/lib/db/schema'
import {
  AI_QUEUE_SOURCE_CAP,
  OVERDUE_WINDOW_MS,
  parseAiQueueQuery,
  projectJourneyToQueueItem,
  projectPendingActionToQueueItem,
  projectRunToQueueItem,
  sortAiQueueItems,
  type AiQueueBucket,
  type AiQueueItem,
} from '@/lib/dashboard/ai-queue'

/**
 * GET /api/dashboard/ai-queue — P8 Slice 2a (read-only, aditivo).
 *
 * Fila de exceções + Approval Inbox SOMENTE LEITURA: projeta sinais P4
 * (decisão APPROVAL/CONFIRM/DENY, execução suspended/failed, outcome
 * failed_workflow/not_attributed, prepare failed) e P7 (journeys
 * stopped/expired) mais `pending_actions` (risco + prazo), com a clínica
 * sempre derivada da sessão autenticada — nunca de parâmetro.
 *
 * Uma rota com filtros (`?view=approvals|exceptions&filter=&page=&pageSize=`),
 * em vez de dois endpoints, porque as duas visões compartilham seams,
 * maquinaria de tenant/paginação/priorização e allowlist — dois handlers
 * duplicariam exatamente o código que isola o tenant.
 *
 * Invariantes:
 * 1. Aditivo: endpoint novo; nada existente é tocado.
 * 2. Isolamento: TODA query filtra por `clinic_id` da sessão (RBAC explícito
 *    `ia:chat` — nível de leitura IA, não `ia:manage`). Sem joins: cada
 *    fonte é um seam single-table (runs, pending_actions, journeys).
 * 3. Literais + sanitização: `state` expõe o literal do banco; `reason` só
 *    viaja em forma de código (`^[A-Za-z][A-Za-z0-9_]{1,63}$`); `actionRef`
 *    só em forma de nome de catálogo (`modulo.nome`); `next_step`,
 *    `payload`, `sources`, `subject_*`, `reasoning` e texto livre NUNCA
 *    atravessam (o `result` jsonb é lido só para derivar escalares).
 * 4. Queries fixas: 1–2 SELECTs por request (runs + [pending_actions |
 *    journeys] conforme a view), cada um com WHERE de elegibilidade no
 *    servidor (só o bucket projetado entra — inelegível nunca consome a
 *    janela) + urgência antes do teto (runs: CASE de rank na precedência
 *    exata da projeção; ações: rank de prazo `overdue`; depois FIFO por
 *    `createdAt` e identidade) + teto fixo (`AI_QUEUE_SOURCE_CAP`) — nunca
 *    N+1, nunca derivação dos 20 recentes. A janela contém os mais urgentes; `total`/`hasMore` refletem
 *    só itens reais da janela (página parcial/vazia ⇒ `hasMore: false`).
 * 5. Nunca pendente por engano: a allowlist da VIEW vale SEMPRE (inclusive
 *    `filter=all`) — reconcile/failed/terminal NUNCA em `approvals`,
 *    approval/confirm NUNCA em `exceptions`; a guarda JS por bucket vale
 *    mesmo se o WHERE derivar errado.
 * 6. Priorização determinística anti-starvation: reconcile (0) > prazo (1) >
 *    falha (2) > pendente (3) > terminal (4); FIFO por `createdAt` no rank.
 * 7. Zero mutação: só SELECT. Não importa — e nunca chama — prepare, tick,
 *    transição, execução, aprovação ou qualquer serviço de mutação P4/P7.
 */

function runDecisionFragment(filter: string) {
  if (filter === 'approval') {
    return sql`(${agentRuns.result}->'policy_decision'->>'decision' = 'APPROVAL')`
  }
  if (filter === 'confirm') {
    return sql`(${agentRuns.result}->'policy_decision'->>'decision' = 'CONFIRM')`
  }
  return sql`(${agentRuns.result}->'policy_decision'->>'decision' IN ('APPROVAL', 'CONFIRM'))`
}

function runExceptionFragment(filter: string) {
  const suspended = sql`(${agentRuns.result}->'execution_outcome'->>'status' = 'suspended')`
  const failedExec = sql`(${agentRuns.result}->'execution_outcome'->>'status' = 'failed')`
  const failedStatus = eq(agentRuns.status, 'failed')
  const failedOutcomeNonFw = sql`(${agentRuns.result}->'outcome_telemetry'->>'status' = 'failed' AND (${agentRuns.result}->'outcome_telemetry'->>'type' IS DISTINCT FROM 'failed_workflow'))`
  const denied = sql`(${agentRuns.result}->'policy_decision'->>'decision' = 'DENY')`
  const failedWorkflow = sql`(${agentRuns.result}->'outcome_telemetry'->>'type' = 'failed_workflow')`
  const notAttributed = sql`(${agentRuns.result}->'outcome_telemetry'->>'status' = 'not_attributed')`
  // Negativas de elegibilidade (R15 null-safe): espelham a precedência de
  // `projectRunToQueueItem` para que linhas desviadas (projetadas para outro
  // bucket) nunca consumam a janela do teto. `result` é jsonb anulável e
  // `->>` sobre chave ausente devolve NULL — `NOT (NULL = 'x')` é NULL e o
  // WHERE descartaria a linha (APPROVAL pura, prepare failed com result
  // null, DENY puro e failed_workflow sem execution_outcome sumiriam).
  // `IS DISTINCT FROM` trata NULL como "diferente" (TRUE), preservando-as.
  const notSuspended = sql`(${agentRuns.result}->'execution_outcome'->>'status' IS DISTINCT FROM 'suspended')`
  const notFailedWorkflow = sql`(${agentRuns.result}->'outcome_telemetry'->>'type' IS DISTINCT FROM 'failed_workflow')`
  if (filter === 'reconcile') return suspended
  if (filter === 'failed') {
    // Falha operacional pura: `suspended` projeta reconcile e
    // `failed_workflow` projeta terminal mesmo com falha concomitante.
    return and(or(failedStatus, failedExec, failedOutcomeNonFw), notSuspended, notFailedWorkflow)
  }
  if (filter === 'terminal') {
    // Terminal puro: `failed_workflow` vence falha concomitante, mas
    // DENY/`not_attributed` perdem para `suspended` e para falha operacional.
    return or(
      and(failedWorkflow, notSuspended),
      and(
        or(denied, notAttributed),
        notSuspended,
        notFailedWorkflow,
        sql`(${agentRuns.status} IS DISTINCT FROM 'failed')`,
        sql`(${agentRuns.result}->'execution_outcome'->>'status' IS DISTINCT FROM 'failed')`,
        sql`((${failedOutcomeNonFw}) IS NOT TRUE)`,
      ),
    )
  }
  return or(
    failedStatus,
    suspended,
    failedExec,
    sql`(${agentRuns.result}->'outcome_telemetry'->>'status' = 'failed')`,
    denied,
    failedWorkflow,
    notAttributed,
  )
}

const FILTER_BUCKETS: Record<string, readonly AiQueueBucket[] | null> = {
  all: null,
  approval: ['approval'],
  confirm: ['confirm'],
  reconcile: ['reconcile'],
  failed: ['failed'],
  terminal: ['terminal'],
}

/**
 * Allowlist por view — aplicada SEMPRE (inclusive `filter=all`): `approvals`
 * só carrega pendentes acionáveis; `exceptions` só carrega diagnóstico.
 * Sem ela, uma run APPROVAL com execução `suspended` (ou outcome
 * `not_attributed`) projetaria `reconcile`/`terminal` e vazaria para o inbox
 * de aprovações quando `filter=all` (guarda por filtro = null).
 */
const VIEW_BUCKETS: Record<'approvals' | 'exceptions', readonly AiQueueBucket[]> = {
  approvals: ['approval', 'confirm'],
  exceptions: ['reconcile', 'failed', 'terminal'],
}

/**
 * Sinais que desviam a projeção para fora de approval/confirm (precedência
 * de `projectRunToQueueItem`): qualquer um deles projeta reconcile, failed
 * ou terminal — nunca pendente acionável. Usado negado (`IS NOT TRUE`) no
 * WHERE da view approvals para que linhas inelegíveis nunca consumam a
 * janela do teto.
 */
function runDivertedFragment() {
  return sql` ((${agentRuns.result}->'execution_outcome'->>'status' = 'suspended')
    OR (${agentRuns.result}->'outcome_telemetry'->>'type' = 'failed_workflow')
    OR (${agentRuns.result}->'execution_outcome'->>'status' = 'failed')
    OR (${agentRuns.status} = 'failed')
    OR (${agentRuns.result}->'outcome_telemetry'->>'status' = 'failed')
    OR (${agentRuns.result}->'policy_decision'->>'decision' = 'DENY')
    OR (${agentRuns.result}->'outcome_telemetry'->>'status' = 'not_attributed'))`
}

/**
 * Rank de urgência espelhado no SQL para priorizar ANTES do teto por fonte:
 * a janela `AI_QUEUE_SOURCE_CAP` contém as linhas mais urgentes (não só as
 * mais antigas), senão 1 reconcile nova some atrás de 200+ falhas antigas.
 * A ordem final entre fontes continua no JS (`sortAiQueueItems`); o SQL só
 * escolhe a janela. Espelho EXATO da precedência de `projectRunToQueueItem`
 * + `aiQueueRank` (suspended 0 > failed_workflow terminal 4 antes das falhas
 * > falhas operacionais 2 > DENY/`not_attributed` terminais 4 >
 * APPROVAL/CONFIRM 3 > inelegível 5); o mock de teste (`mockRunRank`)
 * replica esta mesma ordem — qualquer divergência mascara bug de janela.
 */
function runRankFragment() {
  return sql`CASE
    WHEN (${agentRuns.result}->'execution_outcome'->>'status' = 'suspended') THEN 0
    WHEN (${agentRuns.result}->'outcome_telemetry'->>'type' = 'failed_workflow') THEN 4
    WHEN (${agentRuns.result}->'execution_outcome'->>'status' = 'failed') THEN 2
    WHEN (${agentRuns.status} = 'failed') THEN 2
    WHEN (${agentRuns.result}->'outcome_telemetry'->>'status' = 'failed') THEN 2
    WHEN (${agentRuns.result}->'policy_decision'->>'decision' = 'DENY') THEN 4
    WHEN (${agentRuns.result}->'outcome_telemetry'->>'status' = 'not_attributed') THEN 4
    WHEN (${agentRuns.result}->'policy_decision'->>'decision' IN ('APPROVAL', 'CONFIRM')) THEN 3
    ELSE 5 END`
}

/**
 * Rank de prazo das ações espelhado no SQL: `overdue` (prazo vencido ou
 * dentro de `OVERDUE_WINDOW_MS`, mesma regra de
 * `projectPendingActionToQueueItem`) rank 1, demais rank 3 — depois FIFO por
 * `createdAt` e identidade. Sem ele, a janela do teto ordena por prazo
 * absoluto e diverge da ordenação final do JS (`aiQueueRank`).
 */
function actionRankFragment(overdueThreshold: Date) {
  return sql`CASE WHEN (${pendingActions.undoDeadline} IS NOT NULL AND ${pendingActions.undoDeadline} <= ${overdueThreshold}) THEN 1 ELSE 3 END`
}

export async function GET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    // RBAC explícito: leitura IA (`ia:chat`), nunca gestão (`ia:manage`).
    const authResult = await validateApiAuth('ia:chat')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const params = new URL(request.url).searchParams
    const parsed = parseAiQueueQuery(params)
    if ('error' in parsed) {
      return apiFailure('INVALID_QUERY', parsed.error, requestId, 400)
    }
    const { view, filter, page, pageSize } = parsed.query

    const clinicId = authResult.profile!.clinic_id
    const db = getDb()
    const nowMs = Date.now()
    // Mesmo limiar de `overdue` da projeção JS: prazo ≤ agora+24h ⇒ rank 1.
    const overdueThreshold = new Date(nowMs + OVERDUE_WINDOW_MS)

    let items: AiQueueItem[] = []

    if (view === 'approvals') {
      // Q1+Q2 (fixas): runs com decisão acionável + ações pendentes.
      // Runs: urgência antes do teto (janela = mais urgentes, FIFO no rank).
      // Ações: prazo mais próximo antes do teto (`overdue` primeiro), FIFO
      // depois — 1 ação urgente nova sobrevive a 200+ antigas frias.
      const [runRows, actionRows] = await Promise.all([
        db
          .select({
            id: agentRuns.id,
            eventId: agentRuns.eventId,
            status: agentRuns.status,
            errorCode: agentRuns.errorCode,
            result: agentRuns.result,
            createdAt: agentRuns.createdAt,
          })
          .from(agentRuns)
          .where(
            and(
              eq(agentRuns.clinicId, clinicId),
              runDecisionFragment(filter),
              // R15 null-safe: o OR desviado sobre jsonb anulável é NULL
              // quando todos os sinais estão ausentes (APPROVAL/CONFIRM
              // puras) — `NOT NULL` excluiria a linha. `IS NOT TRUE`
              // inclui FALSE e NULL (só desvia o que é TRUE).
              sql`(${runDivertedFragment()} IS NOT TRUE)`,
            ),
          )
          .orderBy(runRankFragment(), asc(agentRuns.createdAt), asc(agentRuns.id))
          .limit(AI_QUEUE_SOURCE_CAP),
        db
          .select({
            id: pendingActions.id,
            actionType: pendingActions.actionType,
            riskLevel: pendingActions.riskLevel,
            status: pendingActions.status,
            undoDeadline: pendingActions.undoDeadline,
            createdAt: pendingActions.createdAt,
          })
          .from(pendingActions)
          .where(
            filter === 'approval'
              ? and(
                  eq(pendingActions.clinicId, clinicId),
                  eq(pendingActions.status, 'pending'),
                  or(eq(pendingActions.riskLevel, 'HIGH'), eq(pendingActions.riskLevel, 'CRITICAL')),
                )
              : filter === 'confirm'
                ? and(
                    eq(pendingActions.clinicId, clinicId),
                    eq(pendingActions.status, 'pending'),
                    sql`${pendingActions.riskLevel} NOT IN ('HIGH', 'CRITICAL')`,
                  )
                : and(eq(pendingActions.clinicId, clinicId), eq(pendingActions.status, 'pending')),
          )
          .orderBy(
            actionRankFragment(overdueThreshold),
            asc(pendingActions.createdAt),
            asc(pendingActions.id),
          )
          .limit(AI_QUEUE_SOURCE_CAP),
      ])
      for (const r of runRows) {
        const item = projectRunToQueueItem(
          {
            id: r.id,
            eventId: r.eventId,
            status: r.status,
            errorCode: r.errorCode,
            result: r.result,
            createdAt: r.createdAt,
          },
          nowMs,
        )
        if (item !== null) items.push(item)
      }
      for (const a of actionRows) {
        items.push(
          projectPendingActionToQueueItem(
            {
              id: a.id,
              actionType: a.actionType,
              riskLevel: a.riskLevel,
              status: a.status ?? 'pending',
              undoDeadline: a.undoDeadline,
              createdAt: a.createdAt,
            },
            nowMs,
          ),
        )
      }
    } else {
      // Q1[+Q2] (fixas): runs de exceção + journeys terminais (só quando o
      // filtro pode contê-las: `all` ou `terminal`). Runs com urgência antes
      // do teto (mesmo CASE da view approvals); journeys são todas terminais
      // (FIFO basta — mesmo rank, sem starvation entre si).
      const wantJourneys = filter === 'all' || filter === 'terminal'
      const runRows = await db
        .select({
          id: agentRuns.id,
          eventId: agentRuns.eventId,
          status: agentRuns.status,
          errorCode: agentRuns.errorCode,
          result: agentRuns.result,
          createdAt: agentRuns.createdAt,
        })
        .from(agentRuns)
        .where(and(eq(agentRuns.clinicId, clinicId), runExceptionFragment(filter)))
        .orderBy(runRankFragment(), asc(agentRuns.createdAt), asc(agentRuns.id))
        .limit(AI_QUEUE_SOURCE_CAP)
      const journeyRows = wantJourneys
        ? await db
            .select({
              id: followupJourneyInstances.id,
              journeyKind: followupJourneyInstances.journeyKind,
              state: followupJourneyInstances.state,
              outcome: followupJourneyInstances.outcome,
              dueAt: followupJourneyInstances.dueAt,
              sourceEventId: followupJourneyInstances.sourceEventId,
              definitionVersion: followupJourneyInstances.definitionVersion,
              createdAt: followupJourneyInstances.createdAt,
            })
            .from(followupJourneyInstances)
            .where(
              and(
                eq(followupJourneyInstances.clinicId, clinicId),
                or(
                  eq(followupJourneyInstances.state, 'stopped'),
                  eq(followupJourneyInstances.state, 'expired'),
                ),
              ),
            )
            .orderBy(asc(followupJourneyInstances.createdAt), asc(followupJourneyInstances.id))
            .limit(AI_QUEUE_SOURCE_CAP)
        : []
      for (const r of runRows) {
        const item = projectRunToQueueItem(
          {
            id: r.id,
            eventId: r.eventId,
            status: r.status,
            errorCode: r.errorCode,
            result: r.result,
            createdAt: r.createdAt,
          },
          nowMs,
        )
        if (item !== null) items.push(item)
      }
      for (const j of journeyRows) {
        const item = projectJourneyToQueueItem(
          {
            id: j.id,
            journeyKind: j.journeyKind,
            state: j.state,
            outcome: j.outcome,
            dueAt: j.dueAt,
            sourceEventId: j.sourceEventId,
            definitionVersion: j.definitionVersion,
            createdAt: j.createdAt,
          },
          nowMs,
        )
        if (item !== null) items.push(item)
      }
    }

    // Guarda JS por bucket, em duas camadas (vale mesmo se o WHERE derivar
    // errado): (1) allowlist da VIEW sempre — reconcile/failed/terminal
    // NUNCA vazam para `approvals`, approval/confirm NUNCA para `exceptions`
    // (inclusive `filter=all`); (2) allowlist do filtro específico.
    const viewKeep = new Set<string>(VIEW_BUCKETS[view])
    items = items.filter((i) => viewKeep.has(i.bucket))
    const allowed = FILTER_BUCKETS[filter]
    if (allowed !== null) {
      const keep = new Set<string>(allowed)
      items = items.filter((i) => keep.has(i.bucket))
    }

    // Paginação real sobre o conjunto ordenado: `hasMore` só com itens reais
    // (página parcial/vazia NUNCA alega mais — sem página vazia falsa e sem
    // loop infinito quando a janela do teto esgota). `total` é o tamanho da
    // janela ordenada (limitada ao teto por fonte, ver `AI_QUEUE_SOURCE_CAP`).
    const sorted = sortAiQueueItems(items)
    const total = sorted.length
    const start = (page - 1) * pageSize
    const paged = sorted.slice(start, start + pageSize)

    return apiSuccess({
      items: paged,
      page,
      pageSize,
      total,
      hasMore: start + pageSize < total,
    })
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
