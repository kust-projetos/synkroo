/**
 * P1A-SOFT-CAST — soft-delete active-only em inatividade (unit, DB mockado).
 *
 * Estratégia (mesma de alerts-soft-delete.test.ts): o mock simula semântica
 * SQL dirigida pelo predicado REAL que o serviço passa a `.where()`,
 * renderizado com PgDialect. Cada filtro (clínica, soft-delete) só é aplicado
 * ao seed in-memory SE o predicado o referencia. Consequência: sem o
 * `isNull(deletedAt)`, o seed deletado vaza e as asserções falham.
 */
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb), closeDb: jest.fn() }))

import { getInactivityStats, identifyInactivePatients } from '../inactive-patient.service'
import { patients, appointments, clinics } from '@/lib/db/schema'
import { SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

const CLINIC = 'clinic-inactive-sd'
const OTHER = 'clinic-inactive-other'
const DAY = 24 * 3600 * 1000
const daysAgo = (d: number): Date => new Date(Date.now() - d * DAY)

interface SeedPatient {
  id: string
  clinicId: string
  name: string
  phone: string
  lastVisitAt: Date | null
  riskScore: string
  deletedAt: Date | null
}

const seed: SeedPatient[] = [
  // Ativo 40d → bucket inactive_30 (deve aparecer)
  { id: 'p-active', clinicId: CLINIC, name: 'Ativo', phone: '111', lastVisitAt: daysAgo(40), riskScore: '0', deletedAt: null },
  // Soft-deleted 40d → seria bucket30, mas NÃO pode aparecer
  { id: 'p-deleted', clinicId: CLINIC, name: 'Deletado', phone: '112', lastVisitAt: daysAgo(40), riskScore: '0', deletedAt: daysAgo(1) },
  // Outra clínica 40d → isolamento de tenant
  { id: 'p-other', clinicId: OTHER, name: 'Outra', phone: '113', lastVisitAt: daysAgo(40), riskScore: '0', deletedAt: null },
  // Ativo NULL (nunca visitou) → bucket 180+
  { id: 'p-null', clinicId: CLINIC, name: 'Nulo', phone: '114', lastVisitAt: null, riskScore: '0', deletedAt: null },
  // Recente 5d → fora (não inativo)
  { id: 'p-recent', clinicId: CLINIC, name: 'Recente', phone: '115', lastVisitAt: daysAgo(5), riskScore: '0', deletedAt: null },
]

function renderWhere(w: unknown): { sql: string; params: unknown[] } {
  const q = dialect.sqlToQuery(w as SQL)
  return { sql: q.sql.toLowerCase(), params: (q.params as unknown[]) ?? [] }
}

/** Wheres capturados por tabela, para asserção de presença do predicado. */
const capturedWheres: Array<{ table: string; sql: string; params: unknown[] }> = []

function applyPatientFilter(rendered: { sql: string; params: unknown[] }): SeedPatient[] {
  const { sql: whereText, params } = rendered
  return seed.filter((r) => {
    if (whereText.includes('clinic_id') && !params.includes(r.clinicId)) return false
    // `"deleted_at" is null` — só presente via isNull(deletedAt).
    if (whereText.includes('deleted_at') && r.deletedAt !== null) return false
    return true
  })
}

function bucketOf(lastVisitAt: Date | null): 'inactive_30' | 'inactive_60' | 'inactive_90' | 'inactive_180' | null {
  if (lastVisitAt === null) return 'inactive_180'
  const days = Math.floor((Date.now() - lastVisitAt.getTime()) / DAY)
  if (days < 30) return null
  if (days < 60) return 'inactive_30'
  if (days < 90) return 'inactive_60'
  if (days < 180) return 'inactive_90'
  return 'inactive_180'
}

class Query {
  private fromTable: unknown = null
  private selectArg: unknown = null
  private whereArg: unknown = null
  constructor(selectArg: unknown) {
    this.selectArg = selectArg
  }
  from(t: unknown) { this.fromTable = t; return this }
  leftJoin() { return this }
  where(w: unknown) {
    this.whereArg = w
    const table = this.fromTable === patients ? 'patients' : this.fromTable === appointments ? 'appointments' : 'other'
    capturedWheres.push({ table, ...renderWhere(w) })
    return this
  }
  orderBy() { return this }
  then(onFulfilled: (v: any) => any) {
    // getInactivityStats: select de agregados FILTER por faixa.
    if (this.fromTable === patients && this.selectArg && typeof this.selectArg === 'object'
      && 'inactive30' in (this.selectArg as Record<string, unknown>)) {
      const rows = applyPatientFilter(renderWhere(this.whereArg))
      const bySegment: Record<string, number> = { inactive_30: 0, inactive_60: 0, inactive_90: 0, inactive_180: 0 }
      for (const r of rows) {
        const b = bucketOf(r.lastVisitAt)
        if (b) bySegment[b]++
      }
      return Promise.resolve(onFulfilled([{
        inactive30: bySegment.inactive_30,
        inactive60: bySegment.inactive_60,
        inactive90: bySegment.inactive_90,
        inactive180: bySegment.inactive_180,
      }]))
    }
    // identifyInactivePatients: listagem de pacientes.
    if (this.fromTable === patients) {
      const rows = applyPatientFilter(renderWhere(this.whereArg)).map((r) => ({
        id: r.id, name: r.name, phone: r.phone,
        lastVisitAt: r.lastVisitAt, riskScore: r.riskScore, clinicId: r.clinicId,
      }))
      return Promise.resolve(onFulfilled(rows))
    }
    if (this.fromTable === clinics) {
      return Promise.resolve(onFulfilled([{ name: 'Test Clinic' }]))
    }
    if (this.fromTable === appointments) {
      return Promise.resolve(onFulfilled([]))
    }
    return Promise.resolve(onFulfilled([]))
  }
}

const mockDb = { select: jest.fn((...a: unknown[]) => new Query(a[0])) }

beforeEach(() => {
  jest.clearAllMocks()
  capturedWheres.length = 0
})

describe('inactive-patient soft-delete (DB mockado)', () => {
  it('getInactivityStats exclui deletado e mantém tenant', async () => {
    const stats = await getInactivityStats(CLINIC)
    // p-active (30) + p-null (180); p-deleted fora; p-other fora; p-recent fora.
    expect(stats.bySegment).toEqual({
      inactive_30: 1,
      inactive_60: 0,
      inactive_90: 0,
      inactive_180: 1,
    })
    expect(stats.totalInactive).toBe(2)
  })

  it('identifyInactivePatients não lista deletado', async () => {
    const list = await identifyInactivePatients(CLINIC, 30)
    const ids = list.map((p) => p.patientId)
    expect(ids).toContain('p-active')
    expect(ids).not.toContain('p-deleted')
    expect(ids).not.toContain('p-other')
  })

  it('predicados patients carregam deleted_at IS NULL + vínculo de clínica', async () => {
    await getInactivityStats(CLINIC)
    await identifyInactivePatients(CLINIC, 30)
    const patientWheres = capturedWheres.filter((w) => w.table === 'patients')
    expect(patientWheres.length).toBeGreaterThanOrEqual(2)
    for (const w of patientWheres) {
      expect(w.sql).toContain('deleted_at')
      expect(w.sql).toContain('is null')
      expect(w.params).toContain(CLINIC)
    }
  })
})
