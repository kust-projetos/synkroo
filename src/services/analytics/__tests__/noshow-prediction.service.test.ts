/**
 * Tests for No-Show Prediction Service
 */

import {
  predictNoShowRisk,
  getUpcomingAppointmentRisks,
} from '@/services/analytics/noshow-prediction.service'

// Mock the Supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockSupabase = {
  from: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockReturnValue(mockSupabase)
})

describe('No-Show Prediction Service', () => {
  const patientId = 'patient-123'
  const clinicId = 'clinic-123'

  describe('predictNoShowRisk', () => {
    it('should return prediction with risk factors', async () => {
      const mockPatient = {
        id: patientId,
        name: 'João Silva',
        risk_score: 30,
      }

      const mockAppointments = [
        { status: 'completed', scheduled_at: '2024-01-10T10:00:00Z', created_at: '2024-01-08T10:00:00Z' },
        { status: 'completed', scheduled_at: '2024-01-20T10:00:00Z', created_at: '2024-01-18T10:00:00Z' },
        { status: 'no_show', scheduled_at: '2024-02-01T10:00:00Z', created_at: '2024-01-30T10:00:00Z' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null,
            }),
          }),
        })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)
      const scheduledAt = futureDate.toISOString()

      const prediction = await predictNoShowRisk(patientId, scheduledAt)

      expect(prediction.patient_id).toBe(patientId)
      expect(prediction.patient_name).toBe('João Silva')
      expect(prediction.risk_score).toBeGreaterThanOrEqual(0)
      expect(prediction.risk_score).toBeLessThanOrEqual(100)
      expect(['low', 'medium', 'high']).toContain(prediction.riskLevel)
      expect(prediction.factors.length).toBeGreaterThan(0)
      expect(prediction.recommendations).toBeDefined()
    })

    it('should identify new patient as medium risk', async () => {
      const mockPatient = {
        id: patientId,
        name: 'Maria Santos',
        risk_score: 0,
      }

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)
      const scheduledAt = futureDate.toISOString()

      const prediction = await predictNoShowRisk(patientId, scheduledAt)

      // New patient should have 'new_patient' factor
      const newPatientFactor = prediction.factors.find((f) => f.name === 'new_patient')
      expect(newPatientFactor).toBeDefined()
    })

    it('should return medium risk on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Patient not found' },
            }),
          }),
        }),
      })

      const prediction = await predictNoShowRisk(patientId, '2024-03-01T10:00:00Z')

      // On error, should return safe default
      expect(prediction.riskLevel).toBe('medium')
      expect(prediction.patient_name).toBe('Unknown')
    })

    it('should detect high no-show rate', async () => {
      const mockPatient = {
        id: patientId,
        name: 'Pedro Costa',
        risk_score: 60,
      }

      // 3 no-shows out of 5 appointments = 60% no-show rate
      const mockAppointments = [
        { status: 'completed', scheduled_at: '2024-01-01T10:00:00Z', created_at: '2023-12-30T10:00:00Z' },
        { status: 'no_show', scheduled_at: '2024-01-15T10:00:00Z', created_at: '2024-01-13T10:00:00Z' },
        { status: 'no_show', scheduled_at: '2024-02-01T10:00:00Z', created_at: '2024-01-30T10:00:00Z' },
        { status: 'no_show', scheduled_at: '2024-02-15T10:00:00Z', created_at: '2024-02-13T10:00:00Z' },
        { status: 'cancelled', scheduled_at: '2024-03-01T10:00:00Z', created_at: '2024-02-28T10:00:00Z' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null,
            }),
          }),
        })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)
      const scheduledAt = futureDate.toISOString()

      const prediction = await predictNoShowRisk(patientId, scheduledAt)

      // Should have history factor with high impact
      const historyFactor = prediction.factors.find((f) => f.name === 'patient_history')
      expect(historyFactor).toBeDefined()
      expect(historyFactor!.impact).toBeGreaterThan(0.3) // High no-show rate should have high impact
    })
  })

  describe('getUpcomingAppointmentRisks', () => {
    it('should return predictions for upcoming appointments', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)

      const mockAppointments = [
        {
          id: 'apt-1',
          scheduled_at: futureDate.toISOString(),
          patient_id: 'patient-1',
          patients: { id: 'patient-1', name: 'João Silva', risk_score: 20 },
        },
        {
          id: 'apt-2',
          scheduled_at: new Date(futureDate.getTime() + 86400000).toISOString(),
          patient_id: 'patient-2',
          patients: { id: 'patient-2', name: 'Maria Santos', risk_score: 70 },
        },
      ]

      // Mock for appointments query
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockAppointments,
            error: null,
          }),
        }),
      })

      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)

      expect(Array.isArray(predictions)).toBe(true)
    })

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)

      expect(predictions).toEqual([])
    })

    it('should skip appointments without patient data', async () => {
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)

      const mockAppointments = [
        {
          id: 'apt-1',
          scheduled_at: futureDate.toISOString(),
          patient_id: 'patient-1',
          patients: null, // No patient data
        },
        {
          id: 'apt-2',
          scheduled_at: new Date(futureDate.getTime() + 86400000).toISOString(),
          patient_id: 'patient-2',
          patients: [{ id: 'patient-2', name: 'Maria' }], // Array instead of object
        },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          gte: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockAppointments,
            error: null,
          }),
        }),
      })

      const predictions = await getUpcomingAppointmentRisks(clinicId, 7)

      // Both should be skipped due to invalid patient data
      expect(predictions).toEqual([])
    })
  })

  describe('Timing Risk Factors', () => {
    it('should detect early morning appointment risk', async () => {
      const mockPatient = {
        id: patientId,
        name: 'Ana Lima',
        risk_score: 0,
      }

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ status: 'completed', scheduled_at: '2024-01-01T10:00:00Z', created_at: '2023-12-30T10:00:00Z' }],
              error: null,
            }),
          }),
        })

      // Early morning appointment (7am)
      const scheduledAt = '2024-04-01T07:00:00Z'

      const prediction = await predictNoShowRisk(patientId, scheduledAt)

      const timingFactor = prediction.factors.find((f) => f.name === 'timing')
      expect(timingFactor).toBeDefined()
      expect(timingFactor!.impact).toBeGreaterThan(0)
    })

    it('should detect Monday/Friday risk', async () => {
      const mockPatient = {
        id: patientId,
        name: 'Carlos Oliveira',
        risk_score: 0,
      }

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ status: 'completed', scheduled_at: '2024-01-01T10:00:00Z', created_at: '2023-12-30T10:00:00Z' }],
              error: null,
            }),
          }),
        })

      // Find next Monday
      const monday = new Date()
      while (monday.getDay() !== 1) {
        monday.setDate(monday.getDate() + 1)
      }
      monday.setHours(10, 0, 0, 0)

      const prediction = await predictNoShowRisk(patientId, monday.toISOString())

      const timingFactor = prediction.factors.find((f) => f.name === 'timing')
      expect(timingFactor).toBeDefined()
    })
  })

  describe('Inactivity Risk Factors', () => {
    it('should detect long inactivity period', async () => {
      const mockPatient = {
        id: patientId,
        name: 'Lucia Ferreira',
        risk_score: 0,
      }

      // Last visit was 400 days ago
      const lastVisit = new Date()
      lastVisit.setDate(lastVisit.getDate() - 400)

      const mockAppointments = [
        { status: 'completed', scheduled_at: lastVisit.toISOString(), created_at: new Date(lastVisit.getTime() - 86400000).toISOString() },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null,
            }),
          }),
        })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())

      const inactivityFactor = prediction.factors.find((f) => f.name === 'inactivity')
      expect(inactivityFactor).toBeDefined()
      expect(inactivityFactor!.impact).toBeGreaterThan(0.3) // Long inactivity should have high impact
    })
  })

  describe('Recommendations', () => {
    it('should generate confirmation recommendations for high risk', async () => {
      const mockPatient = {
        id: patientId,
        name: 'Ricardo Alves',
        risk_score: 80, // Already high risk
      }

      // High no-show history
      const mockAppointments = [
        { status: 'no_show', scheduled_at: '2024-01-15T10:00:00Z', created_at: '2024-01-13T10:00:00Z' },
        { status: 'no_show', scheduled_at: '2024-02-01T10:00:00Z', created_at: '2024-01-30T10:00:00Z' },
        { status: 'no_show', scheduled_at: '2024-02-15T10:00:00Z', created_at: '2024-02-13T10:00:00Z' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockPatient,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: mockAppointments,
              error: null,
            }),
          }),
        })

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const prediction = await predictNoShowRisk(patientId, futureDate.toISOString())

      // High risk should have confirmation recommendations
      expect(prediction.recommendations.length).toBeGreaterThan(0)
    })
  })
})