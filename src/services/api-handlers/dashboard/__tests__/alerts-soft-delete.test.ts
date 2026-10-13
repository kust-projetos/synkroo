/**
 * Regression: soft-deleted appointments (deletedAt != null) must be excluded
 * from GET /api/dashboard/alerts — both the unconfirmed list and the
 * today/confirmed counters — consistent with stats.ts (`deletedAt IS NULL`).
 *
 * Strategy: the mocked db simulates SQL semantics driven by the *actual*
 * predicate the handler passes to `.where()`. Each filter (clinic, status,
 * soft-delete) is applied to the in-memory seed ONLY when the serialized
 * predicate references it. Consequence: if the handler drops the
 * `isNull(deletedAt)` predicate, the soft-deleted seed rows leak through and
 * the assertions fail — i.e. this suite FAILS without the fix.
 */
jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }))

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

jest.mock('@/services/appointments/incomplete-treatment.service', () => ({
  getIncompleteTreatmentAlerts: jest.fn(),
}))

jest.mock('@/modules/comercial', () => ({
  listLeadsByClinic: jest.fn(),
}))

jest.mock('@/services/followup/budget-followup.service', () => ({
  findUnconvertedBudgets: jest.fn(),
}))

import { GET } from '../alerts'
import { validateApiAuth } from '@/lib/auth/session'
import { appointments, conversations } from '@/lib/db/schema'
import { SQL, is } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { getIncompleteTreatmentAlerts } from '@/services/appointments/incomplete-treatment.service'
import { listLeadsByClinic } from '@/modules/comercial'
import { findUnconvertedBudgets } from '@/services/followup/budget-followup.service'

const dialect = new PgDialect()

const CLINIC = 'clinic-soft-delete'
const OTHER_CLINIC = 'clinic-other'

const atToday = (h: number) => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, 0, 0)
}

interface SeedRow {
  id: string
  clinicId: string
  status: string
  scheduledAt: Date
  deletedAt: Date | null
  patientId: string
  patientName: string
}

const seed: SeedRow[] = [
  { id: 'apt-ok', clinicId: CLINIC, status: 'scheduled', scheduledAt: atToday(10), deletedAt: null, patientId: 'p1', patientName: 'Paciente Ok' },
  { id: 'apt-deleted', clinicId: CLINIC, status: 'scheduled', scheduledAt: atToday(11), deletedAt: atToday(8), patientId: 'p2', patientName: 'Paciente Excluido' },
  { id: 'apt-other-clinic', clinicId: OTHER_CLINIC, status: 'scheduled', scheduledAt: atToday(10), deletedAt: null, patientId: 'p3', patientName: 'Outra Clinica' },
  { id: 'apt-confirmed', clinicId: CLINIC, status: 'confirmed', scheduledAt: atToday(9), deletedAt: null, patientId: 'p4', patientName: 'Paciente Confirmado' },
  { id: 'apt-confirmed-deleted', clinicId: CLINIC, status: 'confirmed', scheduledAt: atToday(9), deletedAt: atToday(7), patientId: 'p5', patientName: 'Confirmado Excluido' },
]

function isCountSelect(sel: unknown): boolean {
  if (is(sel, SQL)) return true
  return (
    !!sel &&
    typeof sel === 'object' &&
    Object.values(sel as Record<string, unknown>).some((v) => is(v, SQL))
  )
}
/** Where-clauses captured per from-table, for predicate-presence assertions. */
const capturedAppointmentWheres: Array<{ sql: string; params: unknown[] }> = []

/**
 * Renders a drizzle predicate with the real PgDialect — the same SQL text
 * shape Postgres would receive (column refs inline, values as params).
 */
function renderWhere(w: unknown): { sql: string; params: unknown[] } {
  const q = dialect.sqlToQuery(w as SQL)
  return { sql: q.sql.toLowerCase(), params: (q.params as unknown[]) ?? [] }
}

/**
 * Applies a filter to the seed ONLY if the handler's predicate references it,
 * mimicking what Postgres would do with the generated SQL.
 */
function applySeed(rendered: { sql: string; params: unknown[] }): SeedRow[] {
  const { sql: whereText, params } = rendered
  const n = new Date()
  const start = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  const end = new Date(start.getTime() + 24 * 3600 * 1000)
  return seed.filter((r) => {
    if (r.scheduledAt < start || r.scheduledAt >= end) return false
    if (whereText.includes('clinic_id') && r.clinicId !== CLINIC) return false
    // `"deleted_at" is null` — only present via isNull(deletedAt).
    if (whereText.includes('deleted_at') && r.deletedAt !== null) return false
    // Status literals travel as bound params, never as column refs.
    if (params.includes('confirmed')) {
      if (r.status !== 'confirmed') return false
    } else if (params.includes('scheduled')) {
      if (r.status !== 'scheduled') return false
    }
    return true
  })
}

class Query {
  private fromTable: unknown = null
  private selectArgs: unknown[] = []
  private whereArg: unknown = null
  constructor(selectArgs: unknown[]) {
    this.selectArgs = selectArgs
  }
  from(t: unknown) { this.fromTable = t; return this }
  leftJoin() { return this }
  where(w: unknown) {
    this.whereArg = w
    if (this.fromTable === appointments) capturedAppointmentWheres.push(renderWhere(w))
    return this
  }
  orderBy() { return this }
  limit() { return this }
  then(onFulfilled: (v: any) => any) {
    if (this.fromTable === appointments) {
      const rows = applySeed(renderWhere(this.whereArg))
      if (this.selectArgs.length === 1 && isCountSelect(this.selectArgs[0])) {
        return Promise.resolve(onFulfilled([{ count: rows.length }]))
      }
      return Promise.resolve(
        onFulfilled(rows.map((r) => ({
          id: r.id,
          patientId: r.patientId,
          scheduledAt: r.scheduledAt,
          patientName: r.patientName,
        }))),
      )
    }
    // conversations: emergencies list + week counters
    if (this.selectArgs.length === 1 && isCountSelect(this.selectArgs[0])) {
      return Promise.resolve(onFulfilled([{ count: 0 }]))
    }
    return Promise.resolve(onFulfilled([]))
  }
}

const mockDb = { select: jest.fn((...a: unknown[]) => new Query(a)) }

beforeEach(() => {
  jest.clearAllMocks()
  capturedAppointmentWheres.length = 0
  ;(validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { clinic_id: CLINIC, id: 'u1', role: 'admin' },
  })
  ;(getIncompleteTreatmentAlerts as jest.Mock).mockResolvedValue({
    total: 0, highRisk: 0, mediumRisk: 0, treatments: [],
  })
  ;(listLeadsByClinic as jest.Mock).mockResolvedValue([])
  ;(findUnconvertedBudgets as jest.Mock).mockResolvedValue([])
  void conversations
})

describe('GET /api/dashboard/alerts — soft-delete exclusion', () => {
  it('excludes soft-deleted appointments from unconfirmed alerts', async () => {
    const res = await GET({ url: 'http://localhost/api/dashboard/alerts' } as any)
    const body = await res.json()
    expect(res.status).toBe(200)
    const ids = (body.data.alerts as Array<{ id: string }>).map((a) => a.id)
    // (a) normal scheduled entra
    expect(ids).toContain('ns-apt-ok')
    // (b) scheduled + deletedAt excluído
    expect(ids).not.toContain('ns-apt-deleted')
    // (c) isolamento por clínica preservado
    expect(ids).not.toContain('ns-apt-other-clinic')
  })

  it('excludes soft-deleted appointments from today/confirmed counters', async () => {
    const res = await GET({ url: 'http://localhost/api/dashboard/alerts' } as any)
    const body = await res.json()
    // apt-ok + apt-confirmed (soft-deleted e outra clínica fora)
    expect(body.data.stats.todayAppointments).toBe(2)
    // só apt-confirmed
    expect(body.data.stats.confirmedToday).toBe(1)
    expect(body.data.stats.confirmationRate).toBe(50)
  })

  it('passes deletedAt IS NULL in all 3 appointment queries', async () => {
    await GET({ url: 'http://localhost/api/dashboard/alerts' } as any)
    // unconfirmedRows + todayApps + confirmedTodayCount
    expect(capturedAppointmentWheres).toHaveLength(3)
    for (const w of capturedAppointmentWheres) {
      expect(w.sql).toContain('deleted_at')
      expect(w.sql).toContain('is null')
      // tenant binding preservado: o predicado vincula a clínica autenticada
      expect(w.params).toContain(CLINIC)
    }
  })
})
