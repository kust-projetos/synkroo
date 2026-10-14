/**
 * P8 Slice 2a — GET /api/dashboard/ai-queue (fila de exceções + Approval
 * Inbox, SOMENTE LEITURA).
 *
 * Estratégia (mesma de activity.test.ts): o db mockado simula semântica SQL
 * dirigida pelo predicado REAL que o handler passa a `.where()` — cada
 * filtro (clínica, decisão, execução, outcome, risco, estado) só é aplicado
 * ao seed quando o SQL serializado o referencia. Consequência: se o handler
 * soltar o predicado de tenant (ou filtrar a decisão no JS em vez do WHERE),
 * linhas da outra clínica — ou buckets errados — vazam e os asserts falham.
 *
 * Zero mutação: `mockDb` é um Proxy que só expõe `select` — qualquer acesso a
 * insert/update/delete lança, e o GET cairia em 500. Todo teste de sucesso
 * (200) prova leitura pura. Um teste estático adicional proíbe imports de
 * mutação P4/P7 no handler e no lib.
 */
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }))

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

import fs from 'node:fs'
import path from 'node:path'
import { GET } from '../ai-queue'
import {
  projectJourneyToQueueItem,
  projectRunToQueueItem,
  sortAiQueueItems,
} from '@/lib/dashboard/ai-queue'
import { validateApiAuth } from '@/lib/auth/session'
import {
  agentRuns,
  followupJourneyInstances,
  pendingActions,
} from '@/lib/db/schema'
import { SQL, is } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

const CLINIC_A = 'clinic-queue-a'
const CLINIC_B = 'clinic-queue-b'

const NOW = Date.now()
const HOUR = 60 * 60 * 1000
const OVERDUE_WINDOW_MS = 24 * HOUR
const at = (offsetMs: number) => new Date(NOW + offsetMs)

interface RunSeed {
  id: string
  clinicId: string
  eventId: string
  status: string
  errorCode: string | null
  result: unknown
  createdAt: Date
}
interface ActionSeed {
  id: string
  clinicId: string
  actionType: string
  riskLevel: string
  status: string
  undoDeadline: Date
  createdAt: Date
}
interface JourneySeed {
  id: string
  clinicId: string
  journeyKind: string
  state: string
  outcome: string | null
  dueAt: Date
  sourceEventId: string
  definitionVersion: string
  createdAt: Date
}

const approvalDecision = (reason = 'approval_required') => ({
  decision: 'APPROVAL',
  riskClass: 'approval',
  reason,
  policy_version: 'p4-policy-v1',
  action_id: 'operacional.agendarConsulta',
})
const confirmDecision = () => ({
  decision: 'CONFIRM',
  riskClass: 'standard',
  reason: 'confirm_consequential',
  policy_version: 'p4-policy-v1',
  action_id: 'operacional.listarConsultas',
})

const runSeeds: RunSeed[] = [
  {
    id: 'run-susp', clinicId: CLINIC_A, eventId: 'evt-susp', status: 'observed', errorCode: null,
    result: {
      execution_receipt: { idempotency_key: 'k1', action_id: 'operacional.obterPaciente' },
      execution_outcome: { status: 'suspended', evidence: { reason: 'unknown_effect' } },
    },
    createdAt: at(-6 * HOUR),
  },
  {
    id: 'run-fail-prep', clinicId: CLINIC_A, eventId: 'evt-fp', status: 'failed',
    errorCode: 'AI_CONTROL_PREPARE_MODE_OFF', result: null, createdAt: at(-5 * HOUR),
  },
  {
    id: 'run-fail-exec', clinicId: CLINIC_A, eventId: 'evt-fe', status: 'observed', errorCode: null,
    result: {
      execution_outcome: { status: 'failed', evidence: { reason: 'execution_failed' } },
    },
    createdAt: at(-4 * HOUR),
  },
  {
    id: 'run-fw', clinicId: CLINIC_A, eventId: 'evt-fw', status: 'observed', errorCode: null,
    result: {
      execution_outcome: { status: 'failed', evidence: { reason: 'execution_failed' } },
      outcome_telemetry: { type: 'failed_workflow', status: 'failed', evidence: {} },
    },
    createdAt: at(-3.5 * HOUR),
  },
  {
    id: 'run-appr', clinicId: CLINIC_A, eventId: 'evt-appr', status: 'observed', errorCode: null,
    result: { next_step: 'Observar X.', policy_decision: approvalDecision() },
    createdAt: at(-3 * HOUR),
  },
  {
    id: 'run-conf', clinicId: CLINIC_A, eventId: 'evt-conf', status: 'observed', errorCode: null,
    result: { next_step: 'Observar Y.', policy_decision: confirmDecision() },
    createdAt: at(-2.5 * HOUR),
  },
  {
    id: 'run-deny', clinicId: CLINIC_A, eventId: 'evt-deny', status: 'observed', errorCode: null,
    result: {
      next_step: 'Observar Z.',
      policy_decision: {
        decision: 'DENY', riskClass: 'deny_non_human', reason: 'forbidden',
        policy_version: 'p4-policy-v1', action_id: 'financeiro.registrarPagamento',
      },
    },
    createdAt: at(-2 * HOUR),
  },
  {
    id: 'run-na', clinicId: CLINIC_A, eventId: 'evt-na', status: 'observed', errorCode: null,
    result: {
      execution_receipt: { idempotency_key: 'k2', action_id: 'operacional.listarConsultas' },
      execution_outcome: { status: 'business_success', evidence: { reason: 'postcondition_verified' } },
      outcome_telemetry: { type: 'conversation_resolved', status: 'not_attributed', evidence: { reason: 'window_expired' } },
    },
    createdAt: at(-1.5 * HOUR),
  },
  {
    id: 'run-fw2', clinicId: CLINIC_A, eventId: 'evt-fw2', status: 'observed', errorCode: null,
    result: {
      outcome_telemetry: { type: 'failed_workflow', status: 'failed', evidence: { reason: 'unknown_effect' } },
    },
    createdAt: at(-1 * HOUR),
  },
  {
    id: 'run-healthy', clinicId: CLINIC_A, eventId: 'evt-ok', status: 'observed', errorCode: null,
    result: {
      next_step: 'Observar W.',
      policy_decision: {
        decision: 'AUTO', riskClass: 'standard', reason: 'auto_standard',
        policy_version: 'p4-policy-v1', action_id: 'operacional.listarConsultas',
      },
    },
    createdAt: at(-0.5 * HOUR),
  },
  {
    // PII e texto livre no result: NUNCA podem atravessar (sanitização).
    id: 'run-pii', clinicId: CLINIC_A, eventId: 'evt-pii', status: 'observed', errorCode: null,
    result: {
      next_step: 'Ligar para João da Silva (11999999999) sobre o retorno.',
      payload: { phone: '11999999999' },
      sources: [{ id: 's1', title: 'Prontuário completo' }],
      policy_decision: {
        decision: 'APPROVAL', riskClass: 'approval', reason: 'needs human review ASAP!',
        policy_version: 'v1 elimine tudo',
        action_id: 'DROP TABLE agent_runs',
      },
    },
    createdAt: at(-0.25 * HOUR),
  },
  {
    id: 'run-evil', clinicId: CLINIC_B, eventId: 'evt-evil', status: 'observed', errorCode: null,
    result: { next_step: 'Observar B.', policy_decision: approvalDecision() },
    createdAt: at(-7 * HOUR),
  },
]

const actionSeeds: ActionSeed[] = [
  {
    id: 'act-high', clinicId: CLINIC_A, actionType: 'operacional.reagendarConsulta',
    riskLevel: 'HIGH', status: 'pending', undoDeadline: at(-1 * HOUR), createdAt: at(-5.5 * HOUR),
  },
  {
    id: 'act-low', clinicId: CLINIC_A, actionType: 'operacional.listarConsultas',
    riskLevel: 'LOW', status: 'pending', undoDeadline: at(48 * HOUR), createdAt: at(-5 * HOUR),
  },
  {
    id: 'act-evil', clinicId: CLINIC_B, actionType: 'operacional.reagendarConsulta',
    riskLevel: 'HIGH', status: 'pending', undoDeadline: at(-1 * HOUR), createdAt: at(-7 * HOUR),
  },
]

const journeySeeds: JourneySeed[] = [
  {
    id: 'jor-stop', clinicId: CLINIC_A, journeyKind: 'post_visit', state: 'stopped',
    outcome: 'stopped', dueAt: at(-2 * HOUR), sourceEventId: 'evt-j1',
    definitionVersion: 'p7-s1-v1', createdAt: at(-5.8 * HOUR),
  },
  {
    id: 'jor-exp', clinicId: CLINIC_A, journeyKind: 'post_visit', state: 'expired',
    outcome: 'expired_no_feedback', dueAt: at(-3 * HOUR), sourceEventId: 'evt-j2',
    definitionVersion: 'p7-s1-v1', createdAt: at(-4.5 * HOUR),
  },
  {
    id: 'jor-wait', clinicId: CLINIC_A, journeyKind: 'post_visit', state: 'waiting_feedback',
    outcome: null, dueAt: at(40 * HOUR), sourceEventId: 'evt-j3',
    definitionVersion: 'p7-s1-v1', createdAt: at(-1 * HOUR),
  },
  {
    id: 'jor-evil', clinicId: CLINIC_B, journeyKind: 'post_visit', state: 'stopped',
    outcome: 'stopped', dueAt: at(-2 * HOUR), sourceEventId: 'evt-jb',
    definitionVersion: 'p7-s1-v1', createdAt: at(-7 * HOUR),
  },
]

let selectCount = 0
const fromTables: unknown[] = []
const capturedWheres: Array<{ sql: string; params: unknown[] }> = []
const capturedColumns: string[] = []

function renderExpr(w: unknown): { sql: string; params: unknown[] } {
  const q = dialect.sqlToQuery(w as SQL)
  return { sql: q.sql.toLowerCase(), params: (q.params as unknown[]) ?? [] }
}

function clinicVisible(sql: string, rowClinic: string): boolean {
  if (sql.includes('clinic_id')) return rowClinic === CLINIC_A
  return true
}

function readDecision(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null
  const pd = (result as Record<string, unknown>).policy_decision
  if (typeof pd !== 'object' || pd === null) return null
  const d = (pd as Record<string, unknown>).decision
  return typeof d === 'string' ? d : null
}

function readExecStatus(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null
  const eo = (result as Record<string, unknown>).execution_outcome
  if (typeof eo !== 'object' || eo === null) return null
  const s = (eo as Record<string, unknown>).status
  return typeof s === 'string' ? s : null
}

function readOutcome(result: unknown): { type: string | null; status: string | null } {
  if (typeof result !== 'object' || result === null) return { type: null, status: null }
  const o = (result as Record<string, unknown>).outcome_telemetry
  if (typeof o !== 'object' || o === null) return { type: null, status: null }
  const rec = o as Record<string, unknown>
  return {
    type: typeof rec.type === 'string' ? rec.type : null,
    status: typeof rec.status === 'string' ? rec.status : null,
  }
}

/**
 * Fidelidade ternária SQL (R15 null-safe, R16 por-predicado): `result` anulável e `->>` sobre
 * chave ausente devolvem NULL; `NULL = 'x'` é NULL. O mock antigo usava
 * booleanos JS puros e aplicava a elegibilidade correta mesmo quando o SQL
 * real (com `NOT (NULL)`) excluiria a linha — mascarando o bug. Agora cada
 * negativa só usa a semântica null-safe (`IS DISTINCT FROM` / `IS NOT TRUE`)
 * quando o WHERE serializado contém o SEU próprio marcador (R16); sem
 * ternário (NULL exclui a linha) para que o teste falhe sem o fix do handler.
 */
function sqlEq(v: string | null, lit: string): boolean | null {
  if (v === null || v === undefined) return null
  return v === lit
}
function sqlOr(...vs: Array<boolean | null>): boolean | null {
  if (vs.includes(true)) return true
  if (vs.includes(null)) return null
  return false
}
function sqlNot(v: boolean | null): boolean | null {
  if (v === null) return null
  return !v
}
/**
 * R17 residual: `is distinct from 'failed_workflow'` ocorre DUAS vezes no
 * WHERE null-safe — uma INTERNA ao composto `failedOutcomeNonFw`
 * (`status = 'failed' AND (type IS DISTINCT FROM ...)`) e uma INDEPENDENTE
 * (`notFailedWorkflow`, conjunct autônomo). `includes` não distingue as
 * duas: com só o composto presente (standalone regredido para `NOT (...)`),
 * o marcador seguia verdadeiro e o mock aplicava semântica null-safe onde
 * o PostgreSQL avalia `NOT (NULL)` = NULL (exclusão) — o composto intacto
 * mascarava a regressão. A negativa independente é identificada pela
 * SEGUNDA ocorrência (contagem >= 2); as demais negativas têm fragmentos
 * únicos e seguem por `includes`.
 */
function countFwDistinct(haystack: string): number {
  return haystack.split("is distinct from 'failed_workflow'").length - 1
}
function hasStandaloneNotFailedWorkflow(whereText: string): boolean {
  return countFwDistinct(whereText) >= 2
}
/** OR desviado da view approvals com semântica NULL real. */
function sqlDiverted(r: RunSeed): boolean | null {
  const out = readOutcome(r.result)
  return sqlOr(
    sqlEq(readExecStatus(r.result), 'suspended'),
    sqlEq(out.type, 'failed_workflow'),
    sqlEq(readExecStatus(r.result), 'failed'),
    r.status === 'failed',
    sqlEq(out.status, 'failed'),
    sqlEq(readDecision(r.result), 'DENY'),
    sqlEq(out.status, 'not_attributed'),
  )
}

/**
 * Espelho EXATO do CASE de rank do SQL (`runRankFragment`, mesma ordem de
 * WHENs) e da precedência de `projectRunToQueueItem` (pós-R14: reconcile >
 * failed_workflow terminal antes das falhas > falhas operacionais >
 * DENY/`not_attributed` terminais > approval/confirm > inelegível). Só vale
 * quando o handler ordena por urgência (detectado no `orderBy`); sem ele,
 * o mock mantém o FIFO puro por `createdAt`. Manter em sincronia com o SQL:
 * qualquer divergência aqui mascara bug de janela (o mock simula a janela
 * que o SQL real escolheria).
 */
function mockRunRank(r: RunSeed): number {
  const out = readOutcome(r.result)
  if (readExecStatus(r.result) === 'suspended') return 0
  if (out.type === 'failed_workflow') return 4
  if (readExecStatus(r.result) === 'failed') return 2
  if (r.status === 'failed') return 2
  if (out.status === 'failed') return 2
  const d = readDecision(r.result)
  if (d === 'DENY') return 4
  if (out.status === 'not_attributed') return 4
  if (d === 'APPROVAL' || d === 'CONFIRM') return 3
  return 5
}

/** Projeção de elegibilidade do mock: a linha entraria na fila? */
function mockRunEligible(r: RunSeed): boolean {
  const out = readOutcome(r.result)
  if (readExecStatus(r.result) === 'suspended') return false
  if (out.type === 'failed_workflow') return false
  if (readExecStatus(r.result) === 'failed') return false
  if (r.status === 'failed') return false
  if (out.status === 'failed') return false
  if (readDecision(r.result) === 'DENY') return false
  if (out.status === 'not_attributed') return false
  return true
}

class Query {
  private fromTable: unknown = null
  private whereArg: unknown = null
  private limitN: number | null = null
  private rankOrdered = false
  private dueOrdered = false
  constructor(private readonly fields: unknown) {
    selectCount += 1
    if (fields && typeof fields === 'object') {
      for (const v of Object.values(fields as Record<string, unknown>)) {
        if (is(v, SQL)) continue
        if (v && typeof (v as { name?: unknown }).name === 'string') {
          capturedColumns.push((v as { name: string }).name.toLowerCase())
        }
      }
    }
  }
  from(t: unknown) { this.fromTable = t; fromTables.push(t); return this }
  where(w: unknown) {
    this.whereArg = w
    capturedWheres.push(renderExpr(w))
    return this
  }
  groupBy() { return this }
  orderBy(...cols: unknown[]) {
    // Fidelidade ao SQL real: o handler ordena runs pelo CASE de urgência e
    // ações pelo prazo antes do teto — o mock só aplica a mesma janela
    // quando detecta essas expressões (coluna simples ⇒ FIFO puro).
    for (const c of cols) {
      if (!is(c, SQL)) continue
      const t = renderExpr(c).sql
      if (t.includes('case')) this.rankOrdered = true
      if (t.includes('undo_deadline')) this.dueOrdered = true
    }
    return this
  }
  limit(n: number) { this.limitN = n; return this }
  then(onFulfilled: (v: any) => any) {
    const rendered = renderExpr(this.whereArg)
    const { sql: whereText, params } = rendered
    const byIdAsc = <T extends { id: string }>(a: T, b: T): number =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    const byCreatedAsc = <T extends { createdAt: Date; id: string }>(rows: T[]): T[] => {
      const ordered = [...rows].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || byIdAsc(a, b),
      )
      return this.limitN == null ? ordered : ordered.slice(0, this.limitN)
    }
    const byRankAsc = (rows: RunSeed[]): RunSeed[] => {
      const ordered = [...rows].sort(
        (a, b) =>
          mockRunRank(a) - mockRunRank(b) ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          byIdAsc(a, b),
      )
      return this.limitN == null ? ordered : ordered.slice(0, this.limitN)
    }
    // Espelho do `actionRankFragment`: rank de prazo (overdue ⇒ 1) + FIFO +
    // identidade — mesma regra de `projectPendingActionToQueueItem`.
    const byDueAsc = (rows: ActionSeed[]): ActionSeed[] => {
      const rank = (a: ActionSeed): number =>
        a.undoDeadline.getTime() - NOW <= OVERDUE_WINDOW_MS ? 1 : 3
      const ordered = [...rows].sort(
        (a, b) =>
          rank(a) - rank(b) ||
          a.createdAt.getTime() - b.createdAt.getTime() ||
          byIdAsc(a, b),
      )
      return this.limitN == null ? ordered : ordered.slice(0, this.limitN)
    }
    if (this.fromTable === agentRuns) {
      let rows = runSeeds.filter((r) => clinicVisible(whereText, r.clinicId))
      if (whereText.includes("'approval'") || whereText.includes("'confirm'")) {
        // Visão approvals: o conjunto de decisões viaja no SQL. Com a guarda
        // de elegibilidade null-safe (pós-R15: o WHERE nega o desvio com
        // `IS NOT TRUE`), linhas desviadas (projetadas para outro bucket)
        // nunca entram na janela; sem ela (código antigo, `NOT (...)`), o OR
        // desviado sobre chaves ausentes é NULL, `NOT NULL` é NULL e até
        // APPROVAL pura é excluída — emulado abaixo para não mascarar.
        const nullSafe = whereText.includes('is not true')
        let want: string[]
        if (whereText.includes('in (')) want = ['APPROVAL', 'CONFIRM']
        else if (whereText.includes("'approval'") && !whereText.includes("'confirm'")) want = ['APPROVAL']
        else if (whereText.includes("'confirm'") && !whereText.includes("'approval'")) want = ['CONFIRM']
        else want = ['APPROVAL', 'CONFIRM']
        rows = rows.filter((r) => {
          if (!want.includes(readDecision(r.result) ?? '')) return false
          if (nullSafe) return mockRunEligible(r)
          return sqlNot(sqlDiverted(r)) === true
        })
      } else if (!whereText.includes('deny') && !whereText.includes('not_attributed')) {
        if (whereText.includes("'failed'")) {
          // Filtro failed: falha operacional pura. Com elegibilidade
          // null-safe (pós-R15: negativas com `IS DISTINCT FROM`),
          // `suspended` (reconcile) e `failed_workflow` (terminal) não entram
          // na janela; sem ela, cada `NOT` sobre chave ausente é NULL e
          // prepare failed com `result` null é excluído — emulado abaixo.
          // (`notSuspended`/`notFailedWorkflow` têm fragmentos
          // distintos: cada marcador null-safe é detectado POR PREDICADO —
          // `notFailedWorkflow` pela SEGUNDA ocorrência de
          // `is distinct from 'failed_workflow'` (a primeira é interna ao
          // composto `failedOutcomeNonFw`).)
          const nsSusp = whereText.includes("is distinct from 'suspended'")
          const nsFw = hasStandaloneNotFailedWorkflow(whereText)
          rows = rows.filter((r) => {
            const out = readOutcome(r.result)
            const failedSig =
              r.status === 'failed' ||
              readExecStatus(r.result) === 'failed' ||
              (out.status === 'failed' && out.type !== 'failed_workflow')
            if (!failedSig) return false
            // R16: cada negativa com sua própria semântica (null-safe com
            // o marcador presente; ternária `NOT (NULL)` exclui sem ele).
            if (nsSusp) {
              if (readExecStatus(r.result) === 'suspended') return false
            } else if (sqlNot(sqlEq(readExecStatus(r.result), 'suspended')) !== true) return false
            if (nsFw) {
              if (out.type === 'failed_workflow') return false
            } else if (sqlNot(sqlEq(out.type, 'failed_workflow')) !== true) return false
            return true
          })
        } else {
          // Filtro reconcile: só `suspended` (sempre elegível).
          rows = rows.filter((r) => readExecStatus(r.result) === 'suspended')
        }
      } else if (whereText.includes('is not true') || whereText.includes('not (')) {
        // R16: marcadores null-safe POR PREDICADO (cada `IS DISTINCT FROM`
        // / `IS NOT TRUE` detectado pelo seu próprio fragmento). Regressão
        // isolada de uma negativa para `NOT (...)` exclui só as linhas com
        // NULL naquele sinal, sem arrastar as demais.
        const nsSusp = whereText.includes("is distinct from 'suspended'")
        // R17: `notFailedWorkflow` independente (2ª ocorrência) — o composto
        // `failedOutcomeNonFw` intacto (1ª ocorrência) não mascara a regressão.
        const nsFw = hasStandaloneNotFailedWorkflow(whereText)
        const nsStatus = whereText.includes('"status" is distinct from \'failed\'')
        const nsExec = whereText.includes("execution_outcome'->>'status' is distinct from 'failed'")
        const nsComposite = whereText.includes('is not true')
        rows = rows.filter((r) => {
          const out = readOutcome(r.result)
          if (readExecStatus(r.result) === 'suspended') return false
          if (out.type === 'failed_workflow') {
            // `and(failedWorkflow, notSuspended)`: só `notSuspended` cerca
            // este ramo — `NOT (NULL)` com exec ausente é NULL e exclui
            // (`run-fw2`: failed_workflow sem execution_outcome).
            if (nsSusp) return true
            return readExecStatus(r.result) !== null
          }
          if (
            r.status === 'failed' ||
            readExecStatus(r.result) === 'failed' ||
            (out.status === 'failed' && out.type !== 'failed_workflow')
          ) {
            return false
          }
          if (readDecision(r.result) !== 'DENY' && out.status !== 'not_attributed') return false
          // DENY puro / `not_attributed` puro: cada negativa regressada
          // (`NOT (...)` sobre NULL dá NULL) exclui a linha naquele sinal.
          // `status` nunca é NULL nas seeds (coluna não-anulável), mas o
          // predicado tem marcador próprio por fidelidade.
          const statusVal: string | null = r.status
          if (!nsSusp && readExecStatus(r.result) === null) return false
          if (!nsExec && readExecStatus(r.result) === null) return false
          if (!nsStatus && statusVal === null) return false
          if (!nsFw && out.type === null) return false
          // `NOT (failedOutcomeNonFw)`: o fragmento é NULL com outcome
          // ausente/parcial (status null); com outcome completo e não falho,
          // é FALSE e o NOT é TRUE.
          if (!nsComposite && out.status === null) return false
          return true
        })
      } else {
        // Visão exceptions (all) ou filtros legados: cada condição atômica
        // só vale se o SQL a referencia.
        rows = rows.filter((r) => {
          const out = readOutcome(r.result)
          if (params.includes('failed') && r.status === 'failed') return true
          if (whereText.includes('suspended') && readExecStatus(r.result) === 'suspended') return true
          if (whereText.includes('execution_outcome') && whereText.includes("= 'failed'") && readExecStatus(r.result) === 'failed') return true
          if (whereText.includes('outcome_telemetry') && whereText.includes("= 'failed'") && out.status === 'failed') return true
          if (whereText.includes('deny') && readDecision(r.result) === 'DENY') return true
          if (whereText.includes('failed_workflow') && out.type === 'failed_workflow') return true
          if (whereText.includes('not_attributed') && out.status === 'not_attributed') return true
          return false
        })
      }
      return Promise.resolve(
        onFulfilled(
          (this.rankOrdered ? byRankAsc(rows) : byCreatedAsc(rows)).map((r) => ({
            id: r.id, eventId: r.eventId, status: r.status,
            errorCode: r.errorCode, result: r.result, createdAt: r.createdAt,
          })),
        ),
      )
    }
    if (this.fromTable === pendingActions) {
      let rows = actionSeeds.filter((a) => {
        if (!clinicVisible(whereText, a.clinicId)) return false
        if (params.includes('pending') && a.status !== 'pending') return false
        return true
      })
      if (whereText.includes('not in')) {
        rows = rows.filter((a) => a.riskLevel !== 'HIGH' && a.riskLevel !== 'CRITICAL')
      } else if (params.includes('HIGH')) {
        rows = rows.filter((a) => a.riskLevel === 'HIGH' || a.riskLevel === 'CRITICAL')
      }
      return Promise.resolve(
        onFulfilled(
          (this.dueOrdered ? byDueAsc(rows) : byCreatedAsc(rows)).map((a) => ({
            id: a.id, actionType: a.actionType, riskLevel: a.riskLevel,
            status: a.status, undoDeadline: a.undoDeadline, createdAt: a.createdAt,
          })),
        ),
      )
    }
    if (this.fromTable === followupJourneyInstances) {
      const states = params.filter((p) => p === 'stopped' || p === 'expired') as string[]
      const rows = journeySeeds.filter((j) => {
        if (!clinicVisible(whereText, j.clinicId)) return false
        if (states.length > 0 && !states.includes(j.state)) return false
        return true
      })
      return Promise.resolve(
        onFulfilled(
          byCreatedAsc(rows).map((j) => ({
            id: j.id, journeyKind: j.journeyKind, state: j.state, outcome: j.outcome,
            dueAt: j.dueAt, sourceEventId: j.sourceEventId,
            definitionVersion: j.definitionVersion, createdAt: j.createdAt,
          })),
        ),
      )
    }
    return Promise.resolve(onFulfilled([]))
  }
}

const selectImpl = (fields: unknown) => new Query(fields)
const mockDb = new Proxy(
  { select: jest.fn(selectImpl) },
  {
    get(t, p) {
      if (typeof p !== 'string' || p === 'select') return (t as Record<string | symbol, unknown>)[p]
      throw new Error(`fila read-only: db.${p} proibido`)
    },
  },
)

const authedAsA = () => {
  ;(validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { clinic_id: CLINIC_A, id: 'u1', role: 'admin' },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  selectCount = 0
  fromTables.length = 0
  capturedWheres.length = 0
  capturedColumns.length = 0
  ;(mockDb.select as jest.Mock).mockImplementation(selectImpl)
  authedAsA()
})

const get = (qs: string) =>
  GET({ url: `http://localhost/api/dashboard/ai-queue${qs}` } as any)

const keys = (items: Array<{ key: string }>) => items.map((i) => i.key)

describe('GET /api/dashboard/ai-queue — P8 Slice 2a', () => {
  it('retorna 401 sem sessão', async () => {
    ;(validateApiAuth as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: { message: 'Não autenticado', status: 401 },
    })
    const res = await get('?view=approvals')
    expect(res.status).toBe(401)
  })

  it('retorna 403 sem a permissão ia:chat (RBAC explícito de leitura)', async () => {
    ;(validateApiAuth as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: { message: 'Insufficient permissions', status: 403 },
    })
    const res = await get('?view=approvals')
    expect(res.status).toBe(403)
    expect(validateApiAuth).toHaveBeenCalledWith('ia:chat')
  })

  it('exige ia:chat mesmo no caminho feliz', async () => {
    await get('?view=approvals')
    expect(validateApiAuth).toHaveBeenCalledWith('ia:chat')
  })

  it('approvals/all: pendentes ordenados (prazo > FIFO), sem terminais', async () => {
    const res = await get('?view=approvals')
    const body = await res.json()
    expect(res.status).toBe(200)
    // act-high (prazo vencido, rank 1) > act-low (08-05h) > run-appr > run-conf > run-pii.
    expect(keys(body.data.items)).toEqual([
      'action:act-high',
      'action:act-low',
      'run:run-appr',
      'run:run-conf',
      'run:run-pii',
    ])
    expect(body.data.total).toBe(5)
    expect(body.data.hasMore).toBe(false)
    // Terminais e falhas NUNCA como pendentes.
    for (const k of keys(body.data.items)) {
      expect(k).not.toMatch(/run-deny|run-susp|run-fail|run-fw|run-na|jor/)
    }
    // Buckets: HIGH ⇒ approval com prazo; LOW ⇒ confirm.
    const byKey = Object.fromEntries(body.data.items.map((i: any) => [i.key, i]))
    expect(byKey['action:act-high'].bucket).toBe('approval')
    expect(byKey['action:act-high'].overdue).toBe(true)
    expect(byKey['action:act-low'].bucket).toBe('confirm')
    expect(byKey['run:run-appr'].bucket).toBe('approval')
    expect(byKey['run:run-appr'].state).toBe('APPROVAL')
    expect(byKey['run:run-conf'].bucket).toBe('confirm')
  })

  it('approvals filtram no servidor (approval vs confirm)', async () => {
    const appr = await (await get('?view=approvals&filter=approval')).json()
    expect(keys(appr.data.items)).toEqual(['action:act-high', 'run:run-appr', 'run:run-pii'])
    const conf = await (await get('?view=approvals&filter=confirm')).json()
    expect(keys(conf.data.items)).toEqual(['action:act-low', 'run:run-conf'])
  })

  it('exceptions/all: reconcile > falhas > terminais, FIFO no rank', async () => {
    const res = await get('?view=exceptions')
    const body = await res.json()
    expect(res.status).toBe(200)
    // `failed_workflow` é terminal mesmo com falha operacional concomitante
    // (run-fw tem execução `failed` + outcome `failed_workflow` ⇒ terminal,
    // ordenado por createdAt entre os terminais, após as journeys).
    expect(keys(body.data.items)).toEqual([
      'run:run-susp',
      'run:run-fail-prep',
      'run:run-fail-exec',
      'journey:jor-stop',
      'journey:jor-exp',
      'run:run-fw',
      'run:run-deny',
      'run:run-na',
      'run:run-fw2',
    ])
    const byKey = Object.fromEntries(body.data.items.map((i: any) => [i.key, i]))
    expect(byKey['run:run-susp'].bucket).toBe('reconcile')
    expect(byKey['run:run-susp'].state).toBe('suspended')
    expect(byKey['run:run-susp'].reason).toBe('unknown_effect')
    expect(byKey['run:run-fail-prep'].bucket).toBe('failed')
    expect(byKey['run:run-fail-prep'].reason).toBe('AI_CONTROL_PREPARE_MODE_OFF')
    expect(byKey['run:run-deny'].bucket).toBe('terminal')
    expect(byKey['run:run-deny'].state).toBe('DENY')
    expect(byKey['run:run-na'].bucket).toBe('terminal')
    expect(byKey['run:run-na'].state).toBe('not_attributed')
    expect(byKey['run:run-na'].reason).toBe('window_expired')
    expect(byKey['journey:jor-stop'].bucket).toBe('terminal')
    // Correlação opaca + versão de política presentes, sem PII.
    expect(byKey['journey:jor-stop'].eventRef).toBe('evt-j1')
    expect(byKey['journey:jor-stop'].policyVersion).toBe('p7-s1-v1')
    expect(byKey['run:run-appr']).toBeUndefined()
  })

  it('exceptions filtram no servidor (reconcile só runs; terminal inclui journeys)', async () => {
    selectCount = 0
    fromTables.length = 0
    const rec = await (await get('?view=exceptions&filter=reconcile')).json()
    expect(keys(rec.data.items)).toEqual(['run:run-susp'])
    // Só 1 SELECT (runs) — journeys nem são consultadas.
    expect(selectCount).toBe(1)
    expect(fromTables).toEqual([agentRuns])

    const term = await (await get('?view=exceptions&filter=terminal')).json()
    expect(keys(term.data.items)).toEqual([
      'journey:jor-stop',
      'journey:jor-exp',
      'run:run-fw',
      'run:run-deny',
      'run:run-na',
      'run:run-fw2',
    ])

    const failed = await (await get('?view=exceptions&filter=failed')).json()
    expect(keys(failed.data.items)).toEqual(['run:run-fail-prep', 'run:run-fail-exec'])
  })

  it('R15 null-safe: chaves ausentes (NULL) não somem das views corretas', async () => {
    // Cobertura explícita do finding HIGH R15 — cada linha tem `result`
    // parcial/nulo, onde `->>` devolve NULL e `NOT (NULL = 'x')` excluiria:
    // APPROVAL pura (sem execution_outcome/outcome) ∈ approvals;
    // prepare failed com result null ∈ exceptions/failed;
    // DENY puro (sem outcome) e failed_workflow sem execution_outcome ∈ terminal.
    // O mock emula a ternária real: sem `IS DISTINCT FROM`/`IS NOT TRUE` no
    // WHERE, estas linhas são excluídas e o teste falha (controle negativo).
    const appr = await (await get('?view=approvals')).json()
    expect(keys(appr.data.items)).toContain('run:run-appr')
    const failed = await (await get('?view=exceptions&filter=failed')).json()
    expect(keys(failed.data.items)).toContain('run:run-fail-prep')
    const term = await (await get('?view=exceptions&filter=terminal')).json()
    expect(keys(term.data.items)).toContain('run:run-deny')
    expect(keys(term.data.items)).toContain('run:run-fw2')
    const all = await (await get('?view=exceptions')).json()
    for (const k of ['run:run-fail-prep', 'run:run-deny', 'run:run-fw2']) {
      expect(keys(all.data.items)).toContain(k)
    }
  })

  it('isola 2 clínicas (runs, ações e journeys de B nunca vazam)', async () => {
    for (const view of ['approvals', 'exceptions']) {
      const body = await (await get(`?view=${view}`)).json()
      const dumped = JSON.stringify(body.data)
      expect(dumped).not.toContain('evil')
    }
  })

  it('toda query vincula a clínica autenticada; queries fixas sem N+1', async () => {
    await get('?view=approvals')
    expect(selectCount).toBe(2)
    expect(capturedWheres).toHaveLength(2)
    for (const w of capturedWheres) {
      expect(w.sql).toContain('clinic_id')
      expect(w.params).toContain(CLINIC_A)
    }
    selectCount = 0
    capturedWheres.length = 0
    await get('?view=exceptions')
    expect(selectCount).toBe(2)
    for (const w of capturedWheres) {
      expect(w.sql).toContain('clinic_id')
      expect(w.params).toContain(CLINIC_A)
    }
  })

  it('paginação no servidor (page/pageSize sobre o conjunto ordenado)', async () => {
    const p1 = await (await get('?view=exceptions&page=1&pageSize=3')).json()
    expect(keys(p1.data.items)).toEqual(['run:run-susp', 'run:run-fail-prep', 'run:run-fail-exec'])
    expect(p1.data).toMatchObject({ page: 1, pageSize: 3, total: 9, hasMore: true })
    const p3 = await (await get('?view=exceptions&page=3&pageSize=3')).json()
    expect(keys(p3.data.items)).toEqual(['run:run-deny', 'run:run-na', 'run:run-fw2'])
    expect(p3.data.hasMore).toBe(false)
  })

  it('query inválida responde 400 sem tocar o DB', async () => {
    for (const qs of [
      '?view=inbox',
      '?view=approvals&filter=terminal',
      '?view=exceptions&filter=approval',
      '?view=approvals&page=0',
      '?view=approvals&pageSize=999',
    ]) {
      selectCount = 0
      const res = await get(qs)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('INVALID_QUERY')
      expect(selectCount).toBe(0)
    }
  })

  it('allowlist: resposta sem PII/texto livre; projeção sem colunas sensíveis', async () => {
    for (const view of ['approvals', 'exceptions']) {
      await get(`?view=${view}`)
    }
    const res = await get('?view=approvals')
    const body = await res.json()
    const dumped = JSON.stringify(body.data)
    for (const banned of [
      'João',
      '11999999999',
      'Prontuário',
      'next_step',
      '"payload"',
      '"sources"',
      '"subject',
      '"result"',
      'reasoning',
      'confidence',
      'snapshot',
      'undo_payload',
      'needs human review',
      'DROP TABLE',
      'elimine',
      'conversation',
      'patient',
      'appointment',
    ]) {
      expect(dumped).not.toContain(banned)
    }
    // A run com motivo/action/version malformados é sanitizada para null.
    const byKey = Object.fromEntries(body.data.items.map((i: any) => [i.key, i]))
    expect(byKey['run:run-pii'].reason).toBeNull()
    expect(byKey['run:run-pii'].actionRef).toBeNull()
    expect(byKey['run:run-pii'].policyVersion).toBeNull()
    // Colunas lidas: só identidade/estado/códigos/prazos — nunca FKs de
    // domínio, payloads ou textos.
    const allowedColumns = new Set([
      'id', 'event_id', 'status', 'error_code', 'result', 'created_at',
      'action_type', 'risk_level', 'undo_deadline',
      'journey_kind', 'state', 'outcome', 'due_at', 'source_event_id',
      'definition_version',
    ])
    for (const col of capturedColumns) {
      expect(allowedColumns.has(col)).toBe(true)
    }
  })

  it('vazio legítimo: 200 com total 0 e lista vazia (não 404)', async () => {
    const savedRuns = runSeeds.splice(0, runSeeds.length)
    const savedActions = actionSeeds.splice(0, actionSeeds.length)
    const savedJourneys = journeySeeds.splice(0, journeySeeds.length)
    try {
      const body = await (await get('?view=approvals')).json()
      expect(body.data.items).toEqual([])
      expect(body.data.total).toBe(0)
      expect(body.data.hasMore).toBe(false)
    } finally {
      runSeeds.push(...savedRuns)
      actionSeeds.push(...savedActions)
      journeySeeds.push(...savedJourneys)
    }
  })

  it('falha de DB é fail-closed (500, nunca vazio fabricado)', async () => {
    ;(mockDb.select as jest.Mock).mockImplementationOnce(() => {
      throw new Error('db down')
    })
    const res = await get('?view=approvals')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('estático: leitura não emite token, não marca visto, não executa nada', async () => {
    const handlerSource = fs.readFileSync(path.join(__dirname, '..', 'ai-queue.ts'), 'utf8')
    const libSource = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'lib', 'dashboard', 'ai-queue.ts'),
      'utf8',
    )
    for (const [label, source] of [['handler', handlerSource], ['lib', libSource]] as const) {
      for (const pattern of [
        /\.insert\(/,
        /\.update\(/,
        /\.delete\(/,
        /from\s+['"]@\/modules\/ia\/services/,
        /dispatch-ai-control/,
        /runAction\(/,
        /\btick\(/,
        /persistPolicy/,
        /evaluateProposal/,
        /executeDecided/,
        /sendMessage|sendByChannel|evolution/i,
        /approve\(|decide\(|confirmAction/i,
        /markAs Seen|markAsSeen|updateSeen|seen_at/i,
      ]) {
        expect(source).not.toMatch(pattern)
      }
    }
    // RBAC explícito de leitura IA está no handler.
    expect(handlerSource).toMatch(/validateApiAuth\('ia:chat'\)/)
    // O lib nunca deixa `next_step`/texto livre atravessar (só escalares).
    expect(libSource).not.toMatch(/next_step/)
  })

  it('HIGH buckets: run APPROVAL com sinal de exceção NUNCA aparece em approvals (nem com filter=all)', async () => {
    // Estados combinados: decisão APPROVAL + execução `suspended`, e decisão
    // APPROVAL + outcome `not_attributed` — projetam reconcile/terminal.
    const combined: RunSeed[] = [
      {
        id: 'run-appr-susp', clinicId: CLINIC_A, eventId: 'evt-as', status: 'observed', errorCode: null,
        result: {
          policy_decision: approvalDecision(),
          execution_outcome: { status: 'suspended', evidence: { reason: 'unknown_effect' } },
        },
        createdAt: at(-0.1 * HOUR),
      },
      {
        id: 'run-appr-na', clinicId: CLINIC_A, eventId: 'evt-an', status: 'observed', errorCode: null,
        result: {
          policy_decision: approvalDecision(),
          execution_outcome: { status: 'business_success', evidence: {} },
          outcome_telemetry: { type: 'conversation_resolved', status: 'not_attributed', evidence: {} },
        },
        createdAt: at(-0.05 * HOUR),
      },
    ]
    runSeeds.push(...combined)
    try {
      // Sem a allowlist da view, `filter=all` (guarda null) vazaria ambas.
      for (const qs of ['?view=approvals', '?view=approvals&filter=approval']) {
        const body = await (await get(qs)).json()
        const dumped = JSON.stringify(body.data.items)
        expect(dumped).not.toContain('run-appr-susp')
        expect(dumped).not.toContain('run-appr-na')
      }
      // …mas continuam visíveis onde pertencem (diagnóstico de exceções).
      const exc = await (await get('?view=exceptions')).json()
      const byKey = Object.fromEntries(exc.data.items.map((i: any) => [i.key, i]))
      expect(byKey['run:run-appr-susp'].bucket).toBe('reconcile')
      expect(byKey['run:run-appr-na'].bucket).toBe('terminal')
    } finally {
      runSeeds.splice(runSeeds.length - combined.length, combined.length)
    }
  })

  it('HIGH teto: 1 reconcile nova sobrevive a 210 falhas antigas (urgência antes do teto)', async () => {
    const old: RunSeed[] = Array.from({ length: 210 }, (_, i) => ({
      id: `run-old-${i}`,
      clinicId: CLINIC_A,
      eventId: `evt-old-${i}`,
      status: 'failed' as const,
      errorCode: 'AI_CONTROL_PREPARE_MODE_OFF',
      result: null,
      createdAt: at(-400 * HOUR - i * HOUR),
    }))
    const urgent: RunSeed = {
      id: 'run-new-urgent', clinicId: CLINIC_A, eventId: 'evt-nu', status: 'observed', errorCode: null,
      result: {
        execution_outcome: { status: 'suspended', evidence: { reason: 'unknown_effect' } },
      },
      createdAt: at(-0.01 * HOUR),
    }
    runSeeds.push(...old, urgent)
    try {
      // Janela por fonte = 200 runs mais urgentes + 2 journeys ⇒ total 202.
      const p1 = await (await get('?view=exceptions&page=1&pageSize=20')).json()
      expect(keys(p1.data.items).slice(0, 2)).toEqual(['run:run-susp', 'run:run-new-urgent'])
      expect(p1.data.total).toBe(202)
      expect(p1.data.hasMore).toBe(true)
      // Última página parcial não alega mais; página além do fim é vazia
      // SEM `hasMore` falso (sem página vazia falsa, sem loop infinito).
      const last = await (await get('?view=exceptions&page=11&pageSize=20')).json()
      expect(last.data.items).toHaveLength(2)
      expect(last.data.hasMore).toBe(false)
      const beyond = await (await get('?view=exceptions&page=12&pageSize=20')).json()
      expect(beyond.data.items).toEqual([])
      expect(beyond.data.total).toBe(202)
      expect(beyond.data.hasMore).toBe(false)
    } finally {
      runSeeds.splice(runSeeds.length - (old.length + 1), old.length + 1)
    }
  })

  it('MEDIUM precedência: failed_workflow terminal preservado com falha operacional concomitante', () => {
    const row = (result: unknown) => ({
      id: 'r', eventId: 'e', status: 'observed', errorCode: null, result, createdAt: new Date(),
    })
    // Execução em falha + `failed_workflow` ⇒ terminal (não falha).
    expect(
      projectRunToQueueItem(
        row({
          execution_outcome: { status: 'failed', evidence: {} },
          outcome_telemetry: { type: 'failed_workflow', status: 'failed', evidence: {} },
        }),
        NOW,
      ),
    ).toMatchObject({ bucket: 'terminal', state: 'failed_workflow' })
    // Prepare em falha + `failed_workflow` ⇒ terminal (não falha).
    expect(
      projectRunToQueueItem(
        {
          id: 'r', eventId: 'e', status: 'failed', errorCode: 'AI_CONTROL_PREPARE_MODE_OFF',
          result: {
            outcome_telemetry: { type: 'failed_workflow', status: 'failed', evidence: {} },
          },
          createdAt: new Date(),
        },
        NOW,
      ),
    ).toMatchObject({ bucket: 'terminal', state: 'failed_workflow' })
    // Outcome `failed` fora de `failed_workflow` continua falha operacional.
    expect(
      projectRunToQueueItem(
        row({
          execution_outcome: { status: 'business_success', evidence: {} },
          outcome_telemetry: { type: 'goal_failed', status: 'failed', evidence: {} },
        }),
        NOW,
      ),
    ).toMatchObject({ bucket: 'failed', state: 'failed' })
    // Execução em falha sem workflow ⇒ falha operacional (controle).
    expect(
      projectRunToQueueItem(
        row({ execution_outcome: { status: 'failed', evidence: {} } }),
        NOW,
      ),
    ).toMatchObject({ bucket: 'failed', state: 'failed' })
  })

  it('HIGH elegibilidade: 210 APPROVAL desviadas não expulsam 1 válida (approvals)', async () => {
    // APPROVAL + `suspended` projeta reconcile: passa no WHERE só-decisão do
    // código antigo (consome a janela com rank 0) e some na guarda JS.
    const diverted: RunSeed[] = Array.from({ length: 210 }, (_, i) => ({
      id: `run-div-${i}`,
      clinicId: CLINIC_A,
      eventId: `evt-div-${i}`,
      status: 'observed',
      errorCode: null,
      result: {
        policy_decision: approvalDecision(),
        execution_outcome: { status: 'suspended', evidence: { reason: 'unknown_effect' } },
      },
      createdAt: at(-500 * HOUR - i * HOUR),
    }))
    const valid: RunSeed = {
      id: 'run-cap-valid', clinicId: CLINIC_A, eventId: 'evt-cap-valid',
      status: 'observed', errorCode: null,
      result: { policy_decision: approvalDecision() },
      createdAt: at(-0.01 * HOUR),
    }
    runSeeds.push(...diverted, valid)
    try {
      for (const qs of ['?view=approvals', '?view=approvals&filter=approval']) {
        const body = await (await get(qs)).json()
        expect(keys(body.data.items)).toContain('run:run-cap-valid')
        expect(JSON.stringify(body.data.items)).not.toContain('run-div-')
      }
    } finally {
      runSeeds.splice(runSeeds.length - (diverted.length + 1), diverted.length + 1)
    }
  })

  it('HIGH elegibilidade: 210 reconcile desviadas não expulsam 1 failed real (exceptions/failed)', async () => {
    // `suspended` + prepare `failed`: passa no WHERE de failed do código
    // antigo (via `status`), projeta reconcile e some na guarda JS.
    const diverted: RunSeed[] = Array.from({ length: 210 }, (_, i) => ({
      id: `run-divf-${i}`,
      clinicId: CLINIC_A,
      eventId: `evt-divf-${i}`,
      status: 'failed',
      errorCode: 'AI_CONTROL_PREPARE_MODE_OFF',
      result: {
        execution_outcome: { status: 'suspended', evidence: { reason: 'unknown_effect' } },
      },
      createdAt: at(-500 * HOUR - i * HOUR),
    }))
    const valid: RunSeed = {
      id: 'run-cap-failed', clinicId: CLINIC_A, eventId: 'evt-cap-failed',
      status: 'failed', errorCode: 'AI_CONTROL_PREPARE_MODE_OFF', result: null,
      createdAt: at(-0.01 * HOUR),
    }
    runSeeds.push(...diverted, valid)
    try {
      const body = await (await get('?view=exceptions&filter=failed')).json()
      expect(keys(body.data.items)).toContain('run:run-cap-failed')
      expect(JSON.stringify(body.data.items)).not.toContain('run-divf-')
    } finally {
      runSeeds.splice(runSeeds.length - (diverted.length + 1), diverted.length + 1)
    }
  })

  it('MEDIUM janela: 220 combinações com ordem SQL idêntica à projeção (exceptions/all)', async () => {
    const denyDecision = () => ({
      decision: 'DENY', riskClass: 'deny_non_human', reason: 'forbidden',
      policy_version: 'p4-policy-v1', action_id: 'financeiro.registrarPagamento',
    })
    const mix: RunSeed[] = Array.from({ length: 220 }, (_, i) => {
      const base = {
        id: `run-mix-${i}`,
        clinicId: CLINIC_A,
        eventId: `evt-mix-${i}`,
        status: 'observed',
        errorCode: null as string | null,
        createdAt: new Date(NOW - i * 5 * 60 * 1000),
      }
      switch (i % 10) {
        case 0: // reconcile (rank 0)
          return { ...base, result: { execution_outcome: { status: 'suspended', evidence: { reason: 'unknown_effect' } } } }
        case 1: // falha de execução (rank 2)
          return { ...base, result: { execution_outcome: { status: 'failed', evidence: { reason: 'execution_failed' } } } }
        case 2: // falha de prepare (rank 2)
          return { ...base, status: 'failed', errorCode: 'AI_CONTROL_PREPARE_MODE_OFF', result: null }
        case 3: // outcome failed fora de workflow (rank 2)
          return { ...base, result: { execution_outcome: { status: 'business_success', evidence: {} }, outcome_telemetry: { type: 'goal_failed', status: 'failed', evidence: { reason: 'goal_failed' } } } }
        case 4: // DENY + falha operacional ⇒ failed (rank 2, precedência)
          return { ...base, result: { policy_decision: denyDecision(), execution_outcome: { status: 'failed', evidence: {} } } }
        case 5: // `not_attributed` + prepare failed ⇒ failed (rank 2, precedência)
          return { ...base, status: 'failed', errorCode: 'AI_CONTROL_PREPARE_MODE_OFF', result: { outcome_telemetry: { type: 'conversation_resolved', status: 'not_attributed', evidence: {} } } }
        case 6: // `failed_workflow` + falha ⇒ terminal preservado (rank 4)
          return { ...base, result: { execution_outcome: { status: 'failed', evidence: {} }, outcome_telemetry: { type: 'failed_workflow', status: 'failed', evidence: {} } } }
        case 7: // DENY puro ⇒ terminal (rank 4)
          return { ...base, result: { policy_decision: denyDecision() } }
        case 8: // `not_attributed` puro ⇒ terminal (rank 4)
          return { ...base, result: { outcome_telemetry: { type: 'conversation_resolved', status: 'not_attributed', evidence: {} } } }
        default: // APPROVAL pura ⇒ inelegível em exceptions (fora da janela)
          return { ...base, result: { policy_decision: approvalDecision() } }
      }
    })
    runSeeds.push(...mix)
    try {
      // Ordem esperada: projeção real + ordenação final do JS sobre TODAS as
      // elegíveis; a janela SQL (200 runs + 2 journeys) deve conter o mesmo
      // prefixo — qualquer divergência de rank/CASE/FIFO quebra a igualdade.
      const projectedRuns = runSeeds
        .filter((r) => r.clinicId === CLINIC_A)
        .map((r) =>
          projectRunToQueueItem(
            { id: r.id, eventId: r.eventId, status: r.status, errorCode: r.errorCode, result: r.result, createdAt: r.createdAt },
            NOW,
          ),
        )
      const projectedJourneys = journeySeeds
        .filter((j) => j.clinicId === CLINIC_A)
        .map((j) =>
          projectJourneyToQueueItem(
            { id: j.id, journeyKind: j.journeyKind, state: j.state, outcome: j.outcome, dueAt: j.dueAt, sourceEventId: j.sourceEventId, definitionVersion: j.definitionVersion, createdAt: j.createdAt },
            NOW,
          ),
        )
      const expected = sortAiQueueItems(
        [...projectedRuns, ...projectedJourneys].filter(
          (x): x is NonNullable<typeof x> =>
            x !== null && (x.bucket === 'reconcile' || x.bucket === 'failed' || x.bucket === 'terminal'),
        ),
      ).map((i) => i.key)
      // 205 runs elegíveis (198 do mix + 7 das seeds) ⇒ janela de 200 + 2 journeys.
      expect(expected).toHaveLength(207)
      const pages: string[] = []
      let total = 0
      for (let page = 1; page <= 5; page += 1) {
        const body = await (await get(`?view=exceptions&page=${page}&pageSize=50`)).json()
        pages.push(...keys(body.data.items))
        total = body.data.total
      }
      expect(total).toBe(202)
      expect(pages).toEqual(expected.slice(0, 202))
      // Precedência explícita: DENY+falha (failed) antes de DENY puro e de
      // `failed_workflow` (terminais), mesmo sendo mais novo na página.
      const idxDenyFail = pages.indexOf('run:run-mix-4')
      const idxDenyPure = pages.indexOf('run:run-mix-197')
      const idxFw = pages.indexOf('run:run-mix-196')
      expect(idxDenyFail).toBeGreaterThanOrEqual(0)
      expect(idxDenyPure).toBeGreaterThanOrEqual(0)
      expect(idxFw).toBeGreaterThanOrEqual(0)
      expect(idxDenyFail).toBeLessThan(idxDenyPure)
      expect(idxDenyFail).toBeLessThan(idxFw)
    } finally {
      runSeeds.splice(runSeeds.length - mix.length, mix.length)
    }
  })

  it('estático: CASE de rank e elegibilidade espelham a projeção (pós-R14)', () => {
    const handlerSource = fs.readFileSync(path.join(__dirname, '..', 'ai-queue.ts'), 'utf8')
    const rankFn = handlerSource
      .slice(handlerSource.indexOf('function runRankFragment'))
      .split('\n}\n')[0]
    // Mesma precedência da projeção: falhas operacionais ANTES de
    // DENY/`not_attributed` (o código antigo tinha o contrário e o mock
    // mascarava a divergência na janela).
    const seq = [
      `execution_outcome'->>'status' = 'suspended'`,
      `outcome_telemetry'->>'type' = 'failed_workflow'`,
      `execution_outcome'->>'status' = 'failed'`,
      `status} = 'failed'`,
      `outcome_telemetry'->>'status' = 'failed'`,
      `policy_decision'->>'decision' = 'DENY'`,
      `outcome_telemetry'->>'status' = 'not_attributed'`,
      `IN ('APPROVAL', 'CONFIRM')`,
    ]
    let prev = -1
    for (const s of seq) {
      const idx = rankFn.indexOf(s)
      expect(idx).toBeGreaterThan(prev)
      prev = idx
    }
    // Elegibilidade no WHERE antes do teto (approvals, R15 null-safe com
    // `IS NOT TRUE` sobre o OR desviado) e rank de prazo nas ações.
    expect(handlerSource).toMatch(/\$\{runDivertedFragment\(\)\} IS NOT TRUE/)
    expect(handlerSource).toMatch(/actionRankFragment\(overdueThreshold\)/)
    // R15 null-safe: negativas com IS DISTINCT FROM / IS NOT TRUE — os
    // padrões ternários antigos (`NOT (...)` sobre `=`) não podem voltar.
    expect(handlerSource).toMatch(/IS DISTINCT FROM 'suspended'/)
    expect(handlerSource).toMatch(/IS DISTINCT FROM 'failed_workflow'/)
    // R17: o mock distingue a negativa independente pela 2ª ocorrência —
    // exatamente 2 (1 interna ao composto + 1 standalone `notFailedWorkflow`).
    expect(handlerSource.match(/IS DISTINCT FROM 'failed_workflow'/g)).toHaveLength(2)
    expect(handlerSource).toMatch(/IS NOT TRUE/)
    expect(handlerSource).not.toMatch(/NOT \$\{runDivertedFragment/)
    expect(handlerSource).not.toMatch(/NOT \(\(\$\{failedOutcomeNonFw/)
  })
})
