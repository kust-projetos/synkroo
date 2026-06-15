/** Tests for Analytics Service — Drizzle mocks */
jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

let results: any[][] = [], counter = 0
const mdb = {
  select: jest.fn(function (this: any) { return this }), from: jest.fn(function (this: any) { return this }), where: jest.fn(function (this: any) { return this }),
  orderBy: jest.fn(function (this: any) { return this }), limit: jest.fn(function (this: any) { return this }),
  then: jest.fn(function (this: any, onF: any) { const d = results[counter++] ?? results[results.length - 1] ?? []; return Promise.resolve(typeof onF === 'function' ? onF(d) : d) }),
} as any
jest.mock('@/lib/db/client', () => { let d: any = null; return { getDb: jest.fn(() => { if (!d) d = mdb; return d }) } })

function seed(...s: any[][]) { counter = 0; results = s }
beforeEach(() => { counter = 0; results = []; jest.clearAllMocks() })

import { getAppointmentTrends, getHourlyDistribution, getDayOfWeekDistribution, getHighRiskPatients, getDemandForecast, getClinicInsights } from '../analytics.service'

const mk = (status: string, date?: Date) => ({ scheduledAt: date || new Date('2026-06-01T10:00:00Z'), status })
const mkApt = (patientId: string, status: string) => ({ patientId, status })
const mkPatient = (over: any = {}) => ({ id: 'p1', name: 'João', phone: '119', lastVisitAt: new Date('2026-01-01'), riskScore: '8', ...over })

describe('Analytics Service', () => {
  describe('getAppointmentTrends', () => {
    it('groups by date', async () => {
      seed([mk('confirmed', new Date('2026-06-01')), mk('completed', new Date('2026-06-01')), mk('cancelled', new Date('2026-06-02'))])
      const r = await getAppointmentTrends('c1', 30); expect(r.length).toBeGreaterThanOrEqual(2)
    })
  })
  describe('getHourlyDistribution', () => {
    it('returns 24 hours', async () => { seed([mk('confirmed')]); const r = await getHourlyDistribution('c1'); expect(r).toHaveLength(24) })
  })
  describe('getDayOfWeekDistribution', () => {
    it('returns 7 days', async () => { seed([mk('confirmed')]); const r = await getDayOfWeekDistribution('c1'); expect(r).toHaveLength(7) })
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
  })
  describe('getClinicInsights', () => {
    it('aggregates metrics', async () => {
      seed([mk('confirmed')], [mk('confirmed')], [mk('confirmed')], // trends, hourly, dow
        [mkPatient()], [], // patients + appointments for risk
        [], // demand forecast
        []) // avg confirmation
      const r = await getClinicInsights('c1'); expect(r.metrics.avgAppointmentsPerDay).toBeGreaterThanOrEqual(0); expect(r.appointmentTrends).toHaveLength(1)
    })
    it('returns safe defaults with empty data', async () => {
      seed([], [], [], [], [], [], [])
      const r = await getClinicInsights('c1'); expect(r.appointmentTrends).toEqual([]); expect(r.metrics.cancellationRate).toBe(0)
    })
  })
})
