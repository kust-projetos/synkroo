/**
 * P0-REVENUE-FIX — getInactivityStats buckets mutuamente exclusivos.
 *
 * Regressão do overcount cumulativo: com buckets cumulativos (>=30, >=60,
 * >=90, >=180) e atRiskRevenue = soma dos 4, o mesmo paciente era contado
 * até 4x (4 pacientes em 35/65/100/200d dariam 4+3+2+1=10 e receita 5000).
 * O correto (alinhado a INACTIVITY_SEGMENTS e à rota /api/patients/inactive,
 * que já agrupa por segmento exclusivo): cada paciente conta exatamente 1x,
 * totalInactive = soma dos 4 exclusivos = 4, atRiskRevenue = 4*2*250 = 2000.
 * NULL (nunca visitou) conta SOMENTE no bucket 180+.
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

function createMockDb() {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    then: jest.fn((resolve: any) => resolve(chain.__result ?? [])),
  }
  return chain
}

let mdb = createMockDb()

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => mdb),
  closeDb: jest.fn(),
}))

import {
  getInactivityStats,
  getInactivitySegment,
  calculateDaysSinceLastVisit,
} from '../inactive-patient.service'
import { SQL, sql } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const dialect = new PgDialect()

const DAY = 24 * 3600 * 1000

/** Renderiza um fragmento SQL Drizzle com o PgDialect real (mesmo padrão de alerts-soft-delete.test.ts). */
function renderFragment(v: unknown): { sql: string; params: unknown[] } {
  const q = dialect.sqlToQuery(v as SQL)
  return { sql: q.sql.toLowerCase(), params: (q.params as unknown[]) ?? [] }
}

/** `>` standalone (upper exclusivo) — não casa `>=`. */
function hasStandaloneGt(sqlText: string): boolean {
  return /(^|[^=>])>([^=]|$)/.test(sqlText)
}

/** `<` standalone — não casa `<=`. */
function hasStandaloneLt(sqlText: string): boolean {
  return /<(?!=)/.test(sqlText)
}

beforeEach(() => {
  mdb = createMockDb()
  jest.clearAllMocks()
})

describe('getInactivityStats — exclusive buckets (P0-REVENUE-FIX)', () => {
  it('conta 4 pacientes (35d, 65d, 100d, 200d) exatamente 1x cada: bySegment 1/1/1/1, total=4, receita=2000', async () => {
    // Linha agregada que o Postgres retornaria com FILTERs exclusivos.
    mdb.__result = [{ inactive30: 1, inactive60: 1, inactive90: 1, inactive180: 1 }]

    const stats = await getInactivityStats('clinic-123')

    // Nível paciente: cada fixture cai num segmento distinto e exclusivo.
    const segments = [35, 65, 100, 200].map(
      (d) => getInactivitySegment(d)?.segment,
    )
    expect(segments).toEqual(['inactive_30', 'inactive_60', 'inactive_90', 'inactive_180'])

    expect(stats.bySegment).toEqual({
      inactive_30: 1,
      inactive_60: 1,
      inactive_90: 1,
      inactive_180: 1,
    })
    expect(stats.totalInactive).toBe(4)
    expect(stats.atRiskRevenue).toBe(4 * 2 * 250)

    // Invariante nova: soma dos buckets == total (cada paciente 1x).
    const bucketSum =
      stats.bySegment['inactive_30'] +
      stats.bySegment['inactive_60'] +
      stats.bySegment['inactive_90'] +
      stats.bySegment['inactive_180']
    expect(stats.totalInactive).toBe(bucketSum)
  })

  it('diverge do comportamento cumulativo antigo (10 buckets / receita 5000)', async () => {
    mdb.__result = [{ inactive30: 1, inactive60: 1, inactive90: 1, inactive180: 1 }]

    const stats = await getInactivityStats('clinic-123')

    // O que o código antigo computaria para os mesmos 4 pacientes:
    // cumulativos >=30d:4, >=60d:3, >=90d:2, >=180d:1 → soma 10, receita 5000.
    const days = [35, 65, 100, 200]
    const cumulative = {
      inactive30: days.filter((d) => d >= 30).length, // 4
      inactive60: days.filter((d) => d >= 60).length, // 3
      inactive90: days.filter((d) => d >= 90).length, // 2
      inactive180: days.filter((d) => d >= 180).length, // 1
    }
    expect(cumulative).toEqual({ inactive30: 4, inactive60: 3, inactive90: 2, inactive180: 1 })
    const oldBucketSum = 4 + 3 + 2 + 1
    const oldRevenue = oldBucketSum * 2 * 250
    expect(oldBucketSum).toBe(10)
    expect(oldRevenue).toBe(5000)

    // O novo resultado NÃO pode reproduzir o overcount antigo.
    expect(stats.totalInactive).toBe(4)
    expect(stats.totalInactive).not.toBe(oldBucketSum)
    expect(stats.atRiskRevenue).toBe(2000)
    expect(stats.atRiskRevenue).not.toBe(oldRevenue)
  })

  it('NULL (nunca visitou ≈ 999 dias) cai somente no bucket 180+', async () => {
    expect(calculateDaysSinceLastVisit(null)).toBe(999)
    expect(getInactivitySegment(999)?.segment).toBe('inactive_180')

    mdb.__result = [{ inactive30: 0, inactive60: 0, inactive90: 0, inactive180: 2 }]
    const stats = await getInactivityStats('clinic-123')
    expect(stats.totalInactive).toBe(2)
    expect(stats.bySegment['inactive_180']).toBe(2)
    expect(stats.atRiskRevenue).toBe(2 * 2 * 250)
  })

  it('aplica escopo de tenant (where por clinicId) em query agregada única', async () => {
    mdb.__result = [{ inactive30: 1, inactive60: 0, inactive90: 0, inactive180: 0 }]

    await getInactivityStats('clinic-123')

    // Query agregada única com filtro de tenant.
    expect(mdb.select).toHaveBeenCalledTimes(1)
    expect(mdb.from).toHaveBeenCalledTimes(1)
    expect(mdb.where).toHaveBeenCalledTimes(1)
    expect(mdb.where.mock.calls[0][0]).toBeDefined()
  })

  it('SQL usa faixas exclusivas: NULL só no 180+ (3x "is not null", 1x "is null or")', async () => {
    mdb.__result = [{ inactive30: 1, inactive60: 1, inactive90: 1, inactive180: 1 }]

    await getInactivityStats('clinic-123')

    const selectArg = mdb.select.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(selectArg).sort()).toEqual(
      ['inactive180', 'inactive30', 'inactive60', 'inactive90'].sort(),
    )
    const dumped = Object.values(selectArg)
      .map((v: any) => {
        const chunks = v?.queryChunks ?? null
        if (Array.isArray(chunks)) {
          return chunks
            .map((c: any) => {
              if (typeof c === 'string') return c
              if (typeof c?.value === 'string') return c.value
              if (Array.isArray(c?.value)) return c.value.join('')
              return '?'
            })
            .join('')
        }
        try {
          return String(v)
        } catch {
          return ''
        }
      })
      .join(' | ')
      .toLowerCase()
    // Buckets 30/60/90 excluem NULL (lower-bound exclusivo); só o 180+ inclui NULL.
    expect(dumped.match(/is not null/g)?.length ?? 0).toBe(3)
    expect(dumped.match(/is null or/g)?.length ?? 0).toBe(1)
  })

  it('P0-BOUNDARY-FIX: cada predicado usa lower inclusivo (<=) + upper exclusivo (>) com cutoffs na ordem correta', async () => {
    mdb.__result = [{ inactive30: 1, inactive60: 1, inactive90: 1, inactive180: 1 }]

    const before = Date.now()
    await getInactivityStats('clinic-123')
    const after = Date.now()

    const selectArg = mdb.select.mock.calls[0][0] as Record<string, unknown>
    const inWindow = (p: unknown, daysAgo: number): boolean => {
      if (!(p instanceof Date)) return false
      const t = p.getTime()
      return t >= before - daysAgo * DAY && t <= after - daysAgo * DAY
    }

    // bucket30: <= cutoff30 AND > cutoff60 (faixa [30,60) dias; exatamente 30d conta)
    const b30 = renderFragment(selectArg['inactive30'])
    expect(b30.sql).toContain('is not null')
    expect(b30.sql).toContain('<=')
    expect(hasStandaloneGt(b30.sql)).toBe(true)
    expect(b30.sql).not.toContain('>=')
    expect(hasStandaloneLt(b30.sql)).toBe(false)
    expect(b30.params).toHaveLength(2)
    expect(inWindow(b30.params[0], 30)).toBe(true)
    expect(inWindow(b30.params[1], 60)).toBe(true)

    // bucket60: <= cutoff60 AND > cutoff90 (faixa [60,90) dias)
    const b60 = renderFragment(selectArg['inactive60'])
    expect(b60.sql).toContain('is not null')
    expect(b60.sql).toContain('<=')
    expect(hasStandaloneGt(b60.sql)).toBe(true)
    expect(b60.sql).not.toContain('>=')
    expect(hasStandaloneLt(b60.sql)).toBe(false)
    expect(b60.params).toHaveLength(2)
    expect(inWindow(b60.params[0], 60)).toBe(true)
    expect(inWindow(b60.params[1], 90)).toBe(true)

    // bucket90: <= cutoff90 AND > cutoff180 (faixa [90,180) dias)
    const b90 = renderFragment(selectArg['inactive90'])
    expect(b90.sql).toContain('is not null')
    expect(b90.sql).toContain('<=')
    expect(hasStandaloneGt(b90.sql)).toBe(true)
    expect(b90.sql).not.toContain('>=')
    expect(hasStandaloneLt(b90.sql)).toBe(false)
    expect(b90.params).toHaveLength(2)
    expect(inWindow(b90.params[0], 90)).toBe(true)
    expect(inWindow(b90.params[1], 180)).toBe(true)
  })

  it('P0-BOUNDARY-FIX: bucket180 usa `is null or ... <= cutoff180` (sem upper, sem >=)', async () => {
    mdb.__result = [{ inactive30: 0, inactive60: 0, inactive90: 0, inactive180: 2 }]

    const before = Date.now()
    await getInactivityStats('clinic-123')
    const after = Date.now()

    const selectArg = mdb.select.mock.calls[0][0] as Record<string, unknown>
    const b180 = renderFragment(selectArg['inactive180'])
    expect(b180.sql).toContain('is null or')
    expect(b180.sql).not.toContain('is not null')
    expect(b180.sql).toContain('<=')
    expect(b180.sql).not.toContain('>=')
    expect(hasStandaloneGt(b180.sql)).toBe(false)
    expect(hasStandaloneLt(b180.sql)).toBe(false)
    expect(b180.params).toHaveLength(1)
    const p = b180.params[0]
    expect(p instanceof Date).toBe(true)
    if (p instanceof Date) {
      expect(p.getTime()).toBeGreaterThanOrEqual(before - 180 * DAY)
      expect(p.getTime()).toBeLessThanOrEqual(after - 180 * DAY)
    }
  })

  it('P0-BOUNDARY-FIX: predicado cumulativo (`< cutoff30`, sem segundo limite) NÃO satisfaz o assert', async () => {
    mdb.__result = [{ inactive30: 1, inactive60: 1, inactive90: 1, inactive180: 1 }]

    await getInactivityStats('clinic-123')

    const selectArg = mdb.select.mock.calls[0][0] as Record<string, unknown>
    const b30 = renderFragment(selectArg['inactive30'])

    // O predicado cumulativo antigo: 1 param, `<` standalone, sem `<=`, sem `>`.
    const cutoff30 = new Date(Date.now() - 30 * DAY)
    const cumulative = renderFragment(
      sql`count(*) filter (where last_visit_at < ${cutoff30})::int`,
    )
    expect(cumulative.params).toHaveLength(1)
    expect(cumulative.sql).not.toContain('<=')
    expect(hasStandaloneLt(cumulative.sql)).toBe(true)
    expect(hasStandaloneGt(cumulative.sql)).toBe(false)

    // …enquanto o predicado real tem 2 params, `<=` e `>` standalone:
    // prova que o assert acima o rejeitaria (sensibilidade à regressão).
    expect(b30.params).toHaveLength(2)
    expect(b30.sql).toContain('<=')
    expect(hasStandaloneGt(b30.sql)).toBe(true)
    expect(hasStandaloneLt(b30.sql)).toBe(false)
  })

  it('P0-BOUNDARY-FIX: bordas 30/60/90/180 mapeiam para o segmento lower-inclusivo (alinhado ao SQL)', async () => {
    expect(getInactivitySegment(29)).toBeNull()
    expect(getInactivitySegment(30)?.segment).toBe('inactive_30')
    expect(getInactivitySegment(59)?.segment).toBe('inactive_30')
    expect(getInactivitySegment(60)?.segment).toBe('inactive_60')
    expect(getInactivitySegment(89)?.segment).toBe('inactive_60')
    expect(getInactivitySegment(90)?.segment).toBe('inactive_90')
    expect(getInactivitySegment(179)?.segment).toBe('inactive_90')
    expect(getInactivitySegment(180)?.segment).toBe('inactive_180')
  })
})
