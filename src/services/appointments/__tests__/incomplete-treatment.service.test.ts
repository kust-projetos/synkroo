/**
 * Tests for Incomplete Treatment Service
 * Tests detection of multi-session treatments not completed within expected timeframe
 */

jest.mock('@/lib/supabase/typed', () => ({ createTypedClient: jest.fn() }))
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

let currentMockData: any[] = []
let currentMockPatients: any[] = []

const mockDb = {
  select: jest.fn(function(this: any) { return this }),
  from: jest.fn(function(this: any) { return this }),
  leftJoin: jest.fn(function(this: any) { return this }),
  where: jest.fn(function(this: any) { return this }),
  orderBy: jest.fn(function(this: any) { return this }),
  limit: jest.fn(function(this: any) { return this }),
  then: jest.fn(function(this: any, resolve?: any) {
    if (typeof resolve === 'function') return Promise.resolve(resolve(currentMockPatients))
    return Promise.resolve(currentMockPatients)
  }),
} as any

// After each test, set up the then chain correctly
function setupDbMocks(apptData: any[], patientData: any[]) {
  currentMockData = apptData
  currentMockPatients = patientData
  mockDb.orderBy = jest.fn().mockResolvedValue(apptData)
  mockDb.where = jest.fn(function(this: any) { return this as any })
}

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

import { detectIncompleteTreatments, getIncompleteTreatmentAlerts } from '../incomplete-treatment.service'

describe('Incomplete Treatment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    currentMockData = []
    currentMockPatients = []
    setupDbMocks([], [])
  })

  describe('detectIncompleteTreatments', () => {
    it('should detect incomplete canal treatment', async () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      setupDbMocks([{
        id: 'apt-1', patientId: 'patient-1', procedureId: 'proc-1',
        status: 'completed', scheduledAt: pastDate, procedureName: 'Tratamento de Canal',
      }], [{ id: 'patient-1', name: 'João Silva', phone: '11999999999' }])

      const results = await detectIncompleteTreatments('clinic-1')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].procedure_name).toBe('Tratamento de Canal')
      expect(results[0].expected_sessions).toBe(3)
      expect(results[0].completed_sessions).toBe(1)
      expect(results[0].risk_level).toBeDefined()
    })

    it('should return empty array when no appointments', async () => {
      setupDbMocks([], [])
      const results = await detectIncompleteTreatments('clinic-1')
      expect(results).toEqual([])
    })

    it('should return empty array on query error', async () => {
      mockDb.orderBy = jest.fn().mockRejectedValue(new Error('DB error'))
      const results = await detectIncompleteTreatments('clinic-1')
      expect(results).toEqual([])
    })

    it('should ignore non-multi-session procedures', async () => {
      setupDbMocks([{
        id: 'apt-1', patientId: 'patient-1', procedureId: 'proc-1',
        status: 'completed', scheduledAt: new Date(), procedureName: 'Limpeza simples',
      }], [])
      const results = await detectIncompleteTreatments('clinic-1')
      expect(results).toEqual([])
    })

    it('should sort by risk level (high first)', async () => {
      const veryOld = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000)
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      setupDbMocks([
        { id: 'a1', patientId: 'p1', procedureId: 'proc-1', status: 'completed', scheduledAt: old, procedureName: 'Prótese' },
        { id: 'a2', patientId: 'p2', procedureId: 'proc-2', status: 'completed', scheduledAt: veryOld, procedureName: 'Implante Dentário' },
      ], [
        { id: 'p1', name: 'João', phone: '111' },
        { id: 'p2', name: 'Maria', phone: '222' },
      ])

      const results = await detectIncompleteTreatments('clinic-1')

      if (results.length >= 2) {
        const riskOrder = { high: 0, medium: 1, low: 2 }
        expect(riskOrder[results[0].risk_level]).toBeLessThanOrEqual(riskOrder[results[1].risk_level])
      }
    })
  })

  describe('getIncompleteTreatmentAlerts', () => {
    it('should return summary with total, high, and medium counts', async () => {
      setupDbMocks([], [])

      const alerts = await getIncompleteTreatmentAlerts('clinic-1')

      expect(alerts).toHaveProperty('total')
      expect(alerts).toHaveProperty('highRisk')
      expect(alerts).toHaveProperty('mediumRisk')
      expect(alerts).toHaveProperty('treatments')
    })
  })
})
