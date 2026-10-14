/**
 * P8 Slice 1 — GET /api/dashboard/activity (painel read-only).
 *
 * Estratégia (mesma de alerts-soft-delete): o db mockado simula semântica SQL
 * dirigida pelo predicado REAL que o handler passa a `.where()` — cada filtro
 * (clínica, eventId) só é aplicado ao seed quando o SQL serializado o
 * referencia. Consequência: se o handler soltar o predicado de tenant (ou o
 * join em lote deixar de filtrar por clínica), linhas da outra clínica vazam
 * e os asserts falham.
 *
 * Zero mutação: `mockDb` é um Proxy que só expõe `select` — qualquer acesso a
 * insert/update/delete (ou a prepare/tick/transição via db) lança, e o GET
 * cairia em 500. Todo teste de sucesso (200) prova leitura pura.
 */
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }))

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

import { GET } from '../activity'
import { validateApiAuth } from '@/lib/auth/session'
import {
  agentRuns,
  businessEvents,
  followupJourneyInstances,
  goals,
} from '@/lib/db/schema'
import { SQL, is } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

const CLINIC_A = 'clinic-activity-a'
const CLINIC_B = 'clinic-activity-b'
/** Mesmo eventId determinístico nas duas clínicas (UNIQUE é por tenant). */
const SHARED_EVENT = 'evt-shared-across-tenants'

const at = (h: number, m = 0) => new Date(2026, 9, 14, h, m, 0)

interface RunSeed {
  id: string
  clinicId: string
  eventId: string
  status: string
  createdAt: Date
}
interface EventSeed {
  clinicId: string
  eventId: string
  type: string
  occurredAt: Date
}
interface GoalSeed {
  clinicId: string
  status: string
}
interface JourneySeed {
  id: string
  clinicId: string
  journeyKind: string
  state: string
  outcome: string | null
  createdAt: Date
}

/** NOTA: semente de B ANTES da de A nos events — sem o predicado de tenant no
 * lookup em lote, o evento errado (`appointment.created` de B) venceria no Map
 * e o teste de isolamento falharia. Com o predicado, só A é visível. */
const runSeeds: RunSeed[] = [
  { id: 'run-b1', clinicId: CLINIC_B, eventId: SHARED_EVENT, status: 'failed', createdAt: at(7) },
  { id: 'run-a1', clinicId: CLINIC_A, eventId: SHARED_EVENT, status: 'observed', createdAt: at(10, 10) },
  { id: 'run-a2', clinicId: CLINIC_A, eventId: 'evt-a2', status: 'queued', createdAt: at(10) },
]
const eventSeeds: EventSeed[] = [
  { clinicId: CLINIC_B, eventId: SHARED_EVENT, type: 'appointment.created', occurredAt: at(6, 55) },
  { clinicId: CLINIC_A, eventId: SHARED_EVENT, type: 'lead.created', occurredAt: at(9, 55) },
  { clinicId: CLINIC_A, eventId: 'evt-a2', type: 'lead.created', occurredAt: at(9, 50) },
]
const goalSeeds: GoalSeed[] = [
  { clinicId: CLINIC_B, status: 'queued' },
  { clinicId: CLINIC_A, status: 'queued' },
]
const journeySeeds: JourneySeed[] = [
  { id: 'jor-b1', clinicId: CLINIC_B, journeyKind: 'post_visit', state: 'completed', outcome: 'feedback_observed', createdAt: at(8) },
  { id: 'jor-a1', clinicId: CLINIC_A, journeyKind: 'post_visit', state: 'waiting_feedback', outcome: null, createdAt: at(10, 5) },
  { id: 'jor-a2', clinicId: CLINIC_A, journeyKind: 'post_visit', state: 'completed', outcome: 'feedback_observed', createdAt: at(10, 2) },
]

let selectCount = 0
const capturedWheres: Array<{ sql: string; params: unknown[] }> = []
const capturedColumns: string[] = []

function renderExpr(w: unknown): { sql: string; params: unknown[] } {
  const q = dialect.sqlToQuery(w as SQL)
  return { sql: q.sql.toLowerCase(), params: (q.params as unknown[]) ?? [] }
}

function clinicVisible(sql: string, rowClinic: string): boolean {
  // Filtro de tenant só existe se o predicado o referencia (fiel ao Postgres).
  if (sql.includes('clinic_id')) return rowClinic === CLINIC_A
  return true
}

class Query {
  private fromTable: unknown = null
  private whereArg: unknown = null
  private grouped = false
  private limitN: number | null = null
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
  from(t: unknown) { this.fromTable = t; return this }
  where(w: unknown) {
    this.whereArg = w
    capturedWheres.push(renderExpr(w))
    return this
  }
  groupBy() { this.grouped = true; return this }
  orderBy() { return this }
  limit(n: number) { this.limitN = n; return this }
  then(onFulfilled: (v: any) => any) {
    const rendered = renderExpr(this.whereArg)
    const { sql: whereText, params } = rendered
    if (this.fromTable === agentRuns) {
      const rows = runSeeds.filter((r) => {
        if (!clinicVisible(whereText, r.clinicId)) return false
        return true
      })
      if (this.grouped) {
        const agg = new Map<string, number>()
        for (const r of rows) agg.set(r.status, (agg.get(r.status) ?? 0) + 1)
        return Promise.resolve(onFulfilled([...agg].map(([status, count]) => ({ status, count }))))
      }
      const ordered = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const sliced = this.limitN == null ? ordered : ordered.slice(0, this.limitN)
      return Promise.resolve(
        onFulfilled(sliced.map((r) => ({ id: r.id, eventId: r.eventId, status: r.status, createdAt: r.createdAt }))),
      )
    }
    if (this.fromTable === businessEvents) {
      const rows = eventSeeds.filter((e) => {
        if (!clinicVisible(whereText, e.clinicId)) return false
        // IN em lote: o eventId precisa viajar nos params (nunca interpolado).
        if (whereText.includes('event_id') && !params.includes(e.eventId)) return false
        return true
      })
      return Promise.resolve(
        onFulfilled(rows.map((e) => ({ eventId: e.eventId, type: e.type, occurredAt: e.occurredAt }))),
      )
    }
    if (this.fromTable === goals) {
      const rows = goalSeeds.filter((g) => clinicVisible(whereText, g.clinicId))
      const agg = new Map<string, number>()
      for (const r of rows) agg.set(r.status, (agg.get(r.status) ?? 0) + 1)
      return Promise.resolve(onFulfilled([...agg].map(([status, count]) => ({ status, count }))))
    }
    if (this.fromTable === followupJourneyInstances) {
      const rows = journeySeeds.filter((j) => clinicVisible(whereText, j.clinicId))
      if (this.grouped) {
        const agg = new Map<string, number>()
        for (const r of rows) agg.set(r.state, (agg.get(r.state) ?? 0) + 1)
        return Promise.resolve(onFulfilled([...agg].map(([status, count]) => ({ status, count }))))
      }
      const ordered = [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      const sliced = this.limitN == null ? ordered : ordered.slice(0, this.limitN)
      return Promise.resolve(
        onFulfilled(
          sliced.map((j) => ({ id: j.id, journeyKind: j.journeyKind, state: j.state, outcome: j.outcome, createdAt: j.createdAt })),
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
      // Zero mutação: só `select` existe — insert/update/delete lançam.
      if (typeof p !== 'string' || p === 'select') return (t as Record<string | symbol, unknown>)[p]
      throw new Error(`painel read-only: db.${p} proibido`)
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
  capturedWheres.length = 0
  capturedColumns.length = 0
  ;(mockDb.select as jest.Mock).mockImplementation(selectImpl)
  authedAsA()
})

describe('GET /api/dashboard/activity — P8 Slice 1', () => {
  it('retorna 401 sem sessão', async () => {
    ;(validateApiAuth as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: { message: 'Não autenticado', status: 401 },
    })
    const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    expect(res.status).toBe(401)
  })

  it('isola 2 clínicas com eventId igual (counts + join em lote)', async () => {
    const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    // Counts só de A: 1 observed + 1 queued (run-b1/failed de B fora).
    expect(body.data.counts.runs).toEqual({ observed: 1, queued: 1 })
    expect(body.data.counts.goals).toEqual({ queued: 1 })
    expect(body.data.counts.journeys).toEqual({ waiting_feedback: 1, completed: 1 })
    // Join em lote tenant-scoped: o evento de A (lead.created), nunca o de B.
    const runItems = (body.data.recent as Array<{ kind: string; eventType: string | null }>).filter(
      (i) => i.kind === 'run',
    )
    expect(runItems).toHaveLength(2)
    for (const item of runItems) expect(item.eventType).toBe('lead.created')
    // Journeys só de A.
    const journeyKeys = (body.data.recent as Array<{ key: string }>)
      .filter((i) => i.key.startsWith('journey:'))
      .map((i) => i.key)
    expect(journeyKeys).toEqual(expect.arrayContaining(['journey:jor-a1', 'journey:jor-a2']))
    expect(journeyKeys).not.toContain('journey:jor-b1')
  })

  it('expõe os literais observed e proposta observada', async () => {
    const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    const body = await res.json()
    const observed = (body.data.recent as Array<{ status: string; label: string }>).find(
      (i) => i.status === 'observed',
    )
    expect(observed).toBeDefined()
    expect(observed!.label).toBe('proposta observada')
  })

  it('toda query vincula a clínica autenticada', async () => {
    await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    // 3 counts + runs + events em lote + journeys = 6 queries fixas.
    expect(selectCount).toBe(6)
    expect(capturedWheres).toHaveLength(6)
    for (const w of capturedWheres) {
      expect(w.sql).toContain('clinic_id')
      expect(w.params).toContain(CLINIC_A)
    }
  })

  it('queries fixas sem N+1: volume não multiplica SELECTs', async () => {
    for (let i = 0; i < 25; i += 1) {
      runSeeds.push({ id: `run-bulk-${i}`, clinicId: CLINIC_A, eventId: `evt-bulk-${i}`, status: 'queued', createdAt: at(9, i % 60) })
      eventSeeds.push({ clinicId: CLINIC_A, eventId: `evt-bulk-${i}`, type: 'lead.created', occurredAt: at(9, i % 60) })
    }
    try {
      const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
      const body = await res.json()
      expect(res.status).toBe(200)
      // Mesmo com 27 runs: ainda 6 SELECTs, e o lookup de events continua 1.
      expect(selectCount).toBe(6)
      expect(body.data.recent).toHaveLength(20)
    } finally {
      for (let i = 0; i < 25; i += 1) {
        runSeeds.pop()
        eventSeeds.pop()
      }
    }
  })

  it('allowlist: resposta e projeções sem PII/payload/result/sources', async () => {
    const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    const body = await res.json()
    const dumped = JSON.stringify(body.data)
    for (const banned of [
      '"payload"',
      '"result"',
      '"sources"',
      '"subject',
      'error_code',
      'errorCode',
      'appointment',
    ]) {
      expect(dumped).not.toContain(banned)
    }
    const bannedColumns = new Set([
      'payload',
      'result',
      'sources',
      'subject_type',
      'subject_id',
      'error_code',
      'appointment_id',
      'source_event_id',
      'run_event_id',
      'version',
    ])
    for (const col of capturedColumns) {
      expect(bannedColumns.has(col)).toBe(false)
    }
  })

  it('fusão runs+journeys ordenada por createdAt desc', async () => {
    const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    const body = await res.json()
    const keys = (body.data.recent as Array<{ key: string }>).map((i) => i.key)
    // 10:10 run-a1 > 10:05 jor-a1 > 10:02 jor-a2 > 10:00 run-a2.
    expect(keys).toEqual(['run:run-a1', 'journey:jor-a1', 'journey:jor-a2', 'run:run-a2'])
  })

  it('vazio legítimo: 200 com zeros e lista vazia (não 404)', async () => {
    const savedRuns = runSeeds.splice(0, runSeeds.length)
    const savedEvents = eventSeeds.splice(0, eventSeeds.length)
    const savedGoals = goalSeeds.splice(0, goalSeeds.length)
    const savedJourneys = journeySeeds.splice(0, journeySeeds.length)
    try {
      const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
      const body = await res.json()
      expect(res.status).toBe(200)
      expect(body.data.counts).toEqual({ runs: {}, goals: {}, journeys: {}, total: 0 })
      expect(body.data.recent).toEqual([])
      // Sem runs, o lookup em lote é pulado: 5 queries fixas.
      expect(selectCount).toBe(5)
    } finally {
      runSeeds.push(...savedRuns)
      eventSeeds.push(...savedEvents)
      goalSeeds.push(...savedGoals)
      journeySeeds.push(...savedJourneys)
    }
  })

  it('falha de DB é fail-closed (500, nunca vazio fabricado)', async () => {
    ;(mockDb.select as jest.Mock).mockImplementationOnce(() => {
      throw new Error('db down')
    })
    const res = await GET({ url: 'http://localhost/api/dashboard/activity' } as any)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
