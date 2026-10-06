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

const DAY = 24 * 3600 * 1000

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
})
