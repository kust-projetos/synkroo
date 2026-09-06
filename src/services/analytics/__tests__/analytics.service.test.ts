/** Tests for Analytics Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }), limit: jest.fn(function (this: any) { return this }),
  groupBy: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { getAppointmentTrends, getHourlyDistribution, getDayOfWeekDistribution, getHighRiskPatients, getDemandForecast, getClinicInsights } from '../analytics.service'

// Linhas já agregadas no SQL (DATE/FILTER, EXTRACT/GROUP BY, AVG)
const trendRow = (date: string, over: any = {}) => ({ date, total: 2, confirmed: 1, cancelled: 0, no_show: 0, completed: 1, ...over })
const mkApt = (patientId: string, status: string) => ({ patientId, status })
const mkPatient = (over: any = {}) => ({ id: 'p1', name: 'João', phone: '119', lastVisitAt: new Date('2026-01-01'), riskScore: '8', ...over })

describe('Analytics Service', () => {
  describe('getAppointmentTrends', () => {
    it('maps SQL-aggregated rows by date', async () => {
      seed([trendRow('2026-06-01'), trendRow('2026-06-02', { total: 1, confirmed: 0, cancelled: 1 })])
      const r = await getAppointmentTrends('c1', 30)
      expect(r).toHaveLength(2)
      expect(r[0]).toMatchObject({ date: '2026-06-01', total: 2, confirmed: 1 })
      expect(mdb.groupBy).toHaveBeenCalled()
    })
  })
  describe('getHourlyDistribution', () => {
    it('returns 24 hours', async () => {
      seed([{ hour: 10, count: 3 }])
      const r = await getHourlyDistribution('c1')
      expect(r).toHaveLength(24)
      expect(r[10].count).toBe(3)
      expect(mdb.groupBy).toHaveBeenCalled()
    })
  })
  describe('getDayOfWeekDistribution', () => {
    it('returns 7 days', async () => {
      seed([{ dow: 1, count: 2 }])
      const r = await getDayOfWeekDistribution('c1')
      expect(r).toHaveLength(7)
      expect(r[1].count).toBe(2)
      expect(mdb.groupBy).toHaveBeenCalled()
    })
  })
  describe('getHighRiskPatients', () => {
    it('returns patients with risk data', async () => {
      seed([mkPatient()], [mkApt('p1', 'confirmed'), mkApt('p1', 'cancelled'), mkApt('p1', 'completed')])
      const r = await getHighRiskPatients('c1'); expect(r).toHaveLength(1); expect(r[0].total_visits).toBe(3)
    })
    it('returns empty when no patients', async () => { seed([]); const r = await getHighRiskPatients('c1'); expect(r).toEqual([]) })
  })
  describe('getDemandForecast', () => {
    it('returns forecasts', async () => { seed([]); const r = await getDemandForecast('c1', 3); expect(r).toHaveLength(3); expect(r[0].confidence).toBeGreaterThanOrEqual(0) })
    it('averages SQL-aggregated day/dow buckets', async () => {
      seed([{ date: '2026-05-05', dow: new Date('2026-05-05T12:00:00Z').getDay(), count: 4 }])
      const r = await getDemandForecast('c1', 3); expect(r).toHaveLength(3)
    })
  })
  describe('getClinicInsights', () => {
    it('aggregates metrics', async () => {
      seed([trendRow('2026-06-01')], [{ hour: 10, count: 2 }], [{ dow: 1, count: 2 }], // trends, hourly, dow
        [mkPatient()], [], // patients + appointments for risk
        [], // demand forecast
        [{ avgHours: 5.2 }]) // avg confirmation (AVG no SQL)
      const r = await getClinicInsights('c1'); expect(r.metrics.avgAppointmentsPerDay).toBeGreaterThanOrEqual(0); expect(r.appointmentTrends).toHaveLength(1)
    })
    it('returns safe defaults with empty data', async () => {
      seed([], [], [], [], [], [], [])
      const r = await getClinicInsights('c1'); expect(r.appointmentTrends).toEqual([]); expect(r.metrics.cancellationRate).toBe(0)
    })
  })
})
