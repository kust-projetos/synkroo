/**
 * Tests for Patient History Service
 * Covers getPatientHistory and getPatientVisitSummary
 */

import { getPatientHistory, getPatientVisitSummary } from '../patient-history.service'

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

const mockSupabase = {
  from: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockResolvedValue(mockSupabase)
})

describe('Patient History Service', () => {
  const mockPatient = {
    id: 'p1',
    name: 'João Silva',
    phone: '11999999999',
    last_visit: '2025-03-15',
    clinics: { name: 'Clínica Sorriso' },
  }

  const mockAppointments = [
    {
      id: 'a1',
      scheduled_at: '2025-03-15T10:00:00Z',
      duration_minutes: 30,
      status: 'completed',
      notes: 'Limpeza realizada',
      procedures: { name: 'Limpeza' },
      dentists: { name: 'Dra. Maria' },
    },
    {
      id: 'a2',
      scheduled_at: '2025-04-15T14:00:00Z',
      duration_minutes: 60,
      status: 'completed',
      notes: null,
      procedures: { name: 'Restauração' },
      dentists: { name: 'Dr. Pedro' },
    },
    {
      id: 'a3',
      scheduled_at: '2025-05-20T09:00:00Z',
      duration_minutes: 30,
      status: 'cancelled',
      notes: 'Paciente desmarcou',
      procedures: { name: 'Limpeza' },
      dentists: { name: 'Dra. Maria' },
    },
    {
      id: 'a4',
      scheduled_at: '2026-06-15T11:00:00Z',
      duration_minutes: 30,
      status: 'scheduled',
      notes: null,
      procedures: { name: 'Clareamento' },
      dentists: { name: 'Dra. Maria' },
    },
    {
      id: 'a5',
      scheduled_at: '2025-02-10T10:00:00Z',
      duration_minutes: 30,
      status: 'no_show',
      notes: null,
      procedures: { name: 'Limpeza' },
      dentists: { name: 'Dr. Pedro' },
    },
  ]

  describe('getPatientHistory', () => {
    it('should return complete patient history', async () => {
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
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: mockAppointments,
                error: null,
              }),
            }),
          }),
        })

      const result = await getPatientHistory('p1')

      expect(result.success).toBe(true)
      expect(result.history).toBeDefined()
      const h = result.history!
      expect(h.patientName).toBe('João Silva')
      expect(h.totalVisits).toBe(5)
      expect(h.completedVisits).toBe(2)
      expect(h.cancelledVisits).toBe(1)
      expect(h.noShowCount).toBe(1)
      expect(h.appointments).toHaveLength(5)
    })

    it('should calculate procedure frequency', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPatient, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockAppointments, error: null }),
            }),
          }),
        })

      const result = await getPatientHistory('p1')
      const h = result.history!

      // Limpeza appears twice in completed, Restauração once
      expect(h.procedures).toHaveLength(2)
      expect(h.procedures[0].name).toBe('Limpeza')
      expect(h.procedures[0].count).toBe(1) // only completed
    })

    it('should detect next appointment', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPatient, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: mockAppointments, error: null }),
            }),
          }),
        })

      const result = await getPatientHistory('p1')
      // a4 is scheduled in 2026-06 which is in the future
      expect(result.history!.nextAppointment).toBeDefined()
    })

    it('should return error when patient not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      })

      const result = await getPatientHistory('nonexistent')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient not found')
    })

    it('should handle array clinic name from join', async () => {
      const patientWithArrayClinic = {
        ...mockPatient,
        clinics: [{ name: 'Clínica Sorriso' }],
      }

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: patientWithArrayClinic, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        })

      const result = await getPatientHistory('p1')
      expect(result.history!.clinicName).toBe('Clínica Sorriso')
    })

    it('should handle empty appointments', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockPatient, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        })

      const result = await getPatientHistory('p1')
      const h = result.history!

      expect(h.totalVisits).toBe(0)
      expect(h.completedVisits).toBe(0)
      expect(h.noShowCount).toBe(0)
      expect(h.lastVisit).toBeUndefined()
      expect(h.nextAppointment).toBeUndefined()
    })
  })

  describe('getPatientVisitSummary', () => {
    it('should return visit summary with no-show rate', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockAppointments.map(a => ({
              scheduled_at: a.scheduled_at,
              status: a.status,
            })),
            error: null,
          }),
        }),
      })

      const summary = await getPatientVisitSummary('p1')

      expect(summary.totalVisits).toBe(5)
      expect(summary.noShowRate).toBe(0.2) // 1/5
    })

    it('should return zero no-show rate for no appointments', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })

      const summary = await getPatientVisitSummary('p1')
      expect(summary.totalVisits).toBe(0)
      expect(summary.noShowRate).toBe(0)
    })
  })
})
