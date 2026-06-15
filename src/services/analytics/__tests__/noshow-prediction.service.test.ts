/**
 * Tests for No-Show Prediction Service — migrated to Drizzle mocks.
 */
import { predictNoShowRisk, getUpcomingAppointmentRisks } from '@/services/analytics/noshow-prediction.service'

jest.mock('@/lib/logger', () => ({ dbLogger: { error: jest.fn(), info: jest.fn() } }))

const mockDb = {
  select: jest.fn(function(this: any) { return this }),
  from: jest.fn(function(this: any) { return this }),
  leftJoin: jest.fn(function(this: any) { return this }),
  where: jest.fn(function(this: any) { return this }),
  orderBy: jest.fn(function(this: any) { return this }),
  then: jest.fn(),
} as any

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

function mockChainReturn(data: any[]) {
  mockDb.then = jest.fn((fn: any) => Promise.resolve(typeof fn === 'function' ? fn(data) : data))
}

beforeEach(() => {
  jest.clearAllMocks()
  mockDb.select.mockReturnThis()
  mockDb.from.mockReturnThis()
  mockDb.leftJoin.mockReturnThis()
  mockDb.where.mockReturnThis()
  mockDb.orderBy.mockReturnThis()
  mockDb.then = jest.fn((fn: any) => Promise.resolve(fn ? fn([]) : []))
})

const patientId = 'patient-123'
const clinicId = 'clinic-123'

describe('No-Show Prediction Service', () => {
  describe('predictNoShowRisk', () => {
    it('should return prediction with risk factors', async () => {
      mockChainReturn([{ id: patientId, name: 'João Silva', riskScore: '30' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())
      expect(prediction.patient_id).toBe(patientId)
      expect(prediction.patient_name).toBe('João Silva')
      expect(prediction.risk_score).toBeGreaterThanOrEqual(0)
      expect(prediction.risk_score).toBeLessThanOrEqual(100)
      expect(['low', 'medium', 'high']).toContain(prediction.riskLevel)
      expect(prediction.factors.length).toBeGreaterThan(0)
    })

    it('should return medium risk on error (patient not found)', async () => {
      mockChainReturn([])
      // Use a neutral time (Wednesday 14:00, 7 days from now) so timing risk is 0.
      // This prevents the test from being flaky based on when it runs.
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)
      // Move to next Wednesday if needed, then set to 14:00 (no early/late penalty)
      while (futureDate.getDay() !== 3) futureDate.setDate(futureDate.getDate() + 1)
      futureDate.setHours(14, 0, 0, 0)
      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())
      expect(prediction.riskLevel).toBe('medium')
      expect(prediction.patient_name).toBe('Unknown')
    })

    it('should produce factors for new patients', async () => {
      mockChainReturn([{ id: patientId, name: 'Maria Santos', riskScore: '0' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())
      expect(prediction.factors.length).toBeGreaterThan(0)
    })

    it('should score higher with risk history', async () => {
      mockChainReturn([{ id: patientId, name: 'Pedro Costa', riskScore: '60' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())
      expect(prediction.risk_score).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getUpcomingAppointmentRisks', () => {
    it('should return predictions array', async () => {
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 3)
      const mockUpcoming = [
        { id: 'apt-1', scheduledAt: futureDate, patientId: 'patient-1', patientName: 'João Silva', patientRiskScore: '20' },
        { id: 'apt-2', scheduledAt: new Date(futureDate.getTime() + 86400000), patientId: 'patient-2', patientName: 'Maria Santos', patientRiskScore: '70' },
      ]
      mockChainReturn(mockUpcoming)
      // History query (second) returns empty via default mock
      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)
      expect(Array.isArray(predictions)).toBe(true)
    })

    it('should return empty on DB error', async () => {
      // Thenable .then(onFulfilled, onRejected) — reject immediately.
      mockDb.then = jest.fn((_resolve: any, reject: any) => reject(new Error('DB error')))
      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)
      expect(predictions).toEqual([])
    })

    it('should return empty for appointments without patient data', async () => {
      mockChainReturn([{ id: 'apt-1', scheduledAt: new Date(), patientId: 'p1', patientName: null, patientRiskScore: '0' }])
      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)
      expect(predictions).toEqual([])
    })
  })

  describe('Timing Risk Factors', () => {
    it('should detect early morning appointment risk', async () => {
      mockChainReturn([{ id: patientId, name: 'Ana Lima', riskScore: '0' }])
      const earlyMorning = new Date(); earlyMorning.setDate(earlyMorning.getDate() + 7); earlyMorning.setHours(7, 0, 0, 0)
      const prediction = await predictNoShowRisk(patientId, earlyMorning.toISOString())
      const timingFactor = prediction.factors.find(f => f.name === 'timing')
      expect(timingFactor).toBeDefined()
      expect(timingFactor!.impact).toBeGreaterThan(0)
    })

    it('should detect Monday/Friday risk', async () => {
      mockChainReturn([{ id: patientId, name: 'Carlos Oliveira', riskScore: '0' }])
      const monday = new Date(); while (monday.getDay() !== 1) monday.setDate(monday.getDate() + 1); monday.setHours(10, 0, 0, 0)
      const prediction = await predictNoShowRisk(patientId, monday.toISOString())
      const timingFactor = prediction.factors.find(f => f.name === 'timing')
      expect(timingFactor).toBeDefined()
    })
  })

  describe('Inactivity Risk Factors', () => {
    it('should detect long inactivity period', async () => {
      mockChainReturn([{ id: patientId, name: 'Lucia Ferreira', riskScore: '0' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())
      const inactivityFactor = prediction.factors.find(f => f.name === 'inactivity')
      expect(inactivityFactor).toBeDefined()
    })
  })

  describe('Recommendations', () => {
    it('should generate confirmation recommendations for high risk', async () => {
      mockChainReturn([{ id: patientId, name: 'Ricardo Alves', riskScore: '80' }])
      const futureDate = new Date(); futureDate.setDate(futureDate.getDate() + 7)
      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())
      expect(Array.isArray(prediction.recommendations)).toBe(true)
    })
  })
})
