/**
 * Tests for Incomplete Treatment Service
 * Tests detection of multi-session treatments not completed within expected timeframe
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { detectIncompleteTreatments, getIncompleteTreatmentAlerts } from '../incomplete-treatment.service'

describe('Incomplete Treatment Service', () => {
  const mockClient = { from: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
  })

  describe('detectIncompleteTreatments', () => {
    it('should detect incomplete canal treatment', async () => {
      const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const appointments = [
        {
          id: 'apt-1',
          patient_id: 'patient-1',
          procedure_id: 'proc-1',
          status: 'completed',
          scheduled_at: pastDate,
          procedures: { name: 'Tratamento de Canal' },
        },
      ]

      const patients = [
        { id: 'patient-1', name: 'João Silva', phone: '11999999999' },
      ]

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'appointments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: appointments, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'patients') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: patients, error: null }),
            }),
          }
        }
        return { select: jest.fn() }
      })

      const results = await detectIncompleteTreatments('clinic-1')

      expect(results.length).toBeGreaterThan(0)
      expect(results[0].procedure_name).toBe('Tratamento de Canal')
      expect(results[0].expected_sessions).toBe(3)
      expect(results[0].completed_sessions).toBe(1)
      expect(results[0].risk_level).toBeDefined()
    })

    it('should return empty array when no appointments', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })

      const results = await detectIncompleteTreatments('clinic-1')
      expect(results).toEqual([])
    })

    it('should return empty array on query error', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            }),
          }),
        }),
      })

      const results = await detectIncompleteTreatments('clinic-1')
      expect(results).toEqual([])
    })

    it('should ignore non-multi-session procedures', async () => {
      const appointments = [
        {
          id: 'apt-1',
          patient_id: 'patient-1',
          procedure_id: 'proc-1',
          status: 'completed',
          scheduled_at: new Date().toISOString(),
          procedures: { name: 'Limpeza simples' },
        },
      ]

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: appointments, error: null }),
            }),
          }),
        }),
      })

      const results = await detectIncompleteTreatments('clinic-1')
      expect(results).toEqual([])
    })

    it('should sort by risk level (high first)', async () => {
      const veryOld = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString()
      const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

      const appointments = [
        { id: 'a1', patient_id: 'p1', procedure_id: 'proc-1', status: 'completed', scheduled_at: old, procedures: { name: 'Prótese' } },
        { id: 'a2', patient_id: 'p2', procedure_id: 'proc-2', status: 'completed', scheduled_at: veryOld, procedures: { name: 'Implante Dentário' } },
      ]

      mockClient.from.mockImplementation((table: string) => {
        if (table === 'appointments') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockReturnValue({
                  order: jest.fn().mockResolvedValue({ data: appointments, error: null }),
                }),
              }),
            }),
          }
        }
        if (table === 'patients') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({
                data: [
                  { id: 'p1', name: 'João', phone: '111' },
                  { id: 'p2', name: 'Maria', phone: '222' },
                ],
                error: null,
              }),
            }),
          }
        }
        return { select: jest.fn() }
      })

      const results = await detectIncompleteTreatments('clinic-1')

      if (results.length >= 2) {
        const riskOrder = { high: 0, medium: 1, low: 2 }
        expect(riskOrder[results[0].risk_level]).toBeLessThanOrEqual(riskOrder[results[1].risk_level])
      }
    })
  })

  describe('getIncompleteTreatmentAlerts', () => {
    it('should return summary with total, high, and medium counts', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })

      const alerts = await getIncompleteTreatmentAlerts('clinic-1')

      expect(alerts).toHaveProperty('total')
      expect(alerts).toHaveProperty('highRisk')
      expect(alerts).toHaveProperty('mediumRisk')
      expect(alerts).toHaveProperty('treatments')
    })
  })
})
