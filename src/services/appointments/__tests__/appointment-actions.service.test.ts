/**
 * Tests for Appointment Actions Service
 * Tests cancel, reschedule, confirm, and no-show flows
 */

import {
  getAppointmentInfo,
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  markNoShow,
} from '../appointment-actions.service'

// Mock the Supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

// Mock the waitlist service
jest.mock('@/services/waitlist/waitlist.service', () => ({
  processWaitlistOnCancellation: jest.fn().mockResolvedValue({ notified: 0 }),
}))

// Mock fetch for WhatsApp notifications
global.fetch = jest.fn().mockResolvedValue({ ok: true })

const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn(),
}

beforeEach(() => {
  jest.resetAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockReturnValue(mockSupabase)

  // Reconfigure waitlist mock after reset
  const { processWaitlistOnCancellation } = require('@/services/waitlist/waitlist.service')
  processWaitlistOnCancellation.mockResolvedValue({ notified: 0 })
})

describe('Appointment Actions Service', () => {
  const mockAppointment = {
    id: 'apt-123',
    clinic_id: 'clinic-123',
    patient_id: 'patient-123',
    dentist_id: 'dentist-123',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    duration_minutes: 60,
    status: 'scheduled',
    patients: { id: 'patient-123', name: 'João Silva', phone: '11999999999' },
    dentists: { name: 'Dra. Maria' },
    procedures: { name: 'Limpeza' },
  }

  describe('getAppointmentInfo', () => {
    it('should return appointment info with related data', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAppointment,
              error: null,
            }),
          }),
        }),
      })

      const info = await getAppointmentInfo('apt-123')

      expect(info).not.toBeNull()
      expect(info!.id).toBe('apt-123')
      expect(info!.patientName).toBe('João Silva')
      expect(info!.dentistName).toBe('Dra. Maria')
      expect(info!.procedureName).toBe('Limpeza')
    })

    it('should handle array format from joins', async () => {
      const appointmentWithArrays = {
        ...mockAppointment,
        patients: [{ id: 'patient-123', name: 'João Silva', phone: '11999999999' }],
        dentists: [{ name: 'Dra. Maria' }],
        procedures: [{ name: 'Limpeza' }],
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: appointmentWithArrays,
              error: null,
            }),
          }),
        }),
      })

      const info = await getAppointmentInfo('apt-123')

      expect(info!.patientName).toBe('João Silva')
      expect(info!.dentistName).toBe('Dra. Maria')
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      })

      const info = await getAppointmentInfo('nonexistent')

      expect(info).toBeNull()
    })
  })

  describe('confirmAppointment', () => {
    it('should confirm a scheduled appointment', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockAppointment,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await confirmAppointment('apt-123', 'clinic')

      expect(result.success).toBe(true)
    })

    it('should fail for non-scheduled appointments', async () => {
      const confirmedAppointment = {
        ...mockAppointment,
        status: 'confirmed',
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: confirmedAppointment,
              error: null,
            }),
          }),
        }),
      })

      const result = await confirmAppointment('apt-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only scheduled appointments')
    })

    it('should fail for non-existent appointment', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      })

      const result = await confirmAppointment('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Appointment not found')
    })

    it('should accept different confirmation sources', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockAppointment,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await confirmAppointment('apt-123', 'whatsapp')

      expect(result.success).toBe(true)
    })
  })

  describe('cancelAppointment', () => {
    it('should cancel a scheduled appointment', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockAppointment,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await cancelAppointment('apt-123', 'Patient requested')

      expect(result.success).toBe(true)
    })

    it('should fail for completed appointments', async () => {
      const completedAppointment = {
        ...mockAppointment,
        status: 'completed',
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: completedAppointment,
              error: null,
            }),
          }),
        }),
      })

      const result = await cancelAppointment('apt-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only scheduled or confirmed')
    })

    it('should return waitlist notified count', async () => {
      const { processWaitlistOnCancellation } = require('@/services/waitlist/waitlist.service')
      processWaitlistOnCancellation.mockResolvedValueOnce({ notified: 2 })

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockAppointment,
                error: null,
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await cancelAppointment('apt-123')

      expect(result.success).toBe(true)
      expect(result.waitlistNotified).toBe(2)
    })
  })

  describe('rescheduleAppointment', () => {
    it('should reschedule to a new valid time', async () => {
      const newDate = new Date(Date.now() + 172800000) // 2 days from now
      const dateStr = newDate.toISOString().split('T')[0]
      const timeStr = '10:00'

      // Mock getAppointmentInfo
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockAppointment,
                error: null,
              }),
            }),
          }),
        })
      // Mock conflict check
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                neq: jest.fn().mockReturnValue({
                  or: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        })
      // Mock update
      mockSupabase.from
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
      // Mock RPC for reschedule
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      })

      const result = await rescheduleAppointment('apt-123', dateStr, timeStr)

      expect(result.success).toBe(true)
      expect(result.newScheduledAt).toBeDefined()
    })

    it('should fail for past dates', async () => {
      const pastDate = '2020-01-01'
      const pastTime = '10:00'

      // Mock getAppointmentInfo
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAppointment,
              error: null,
            }),
          }),
        }),
      })

      const result = await rescheduleAppointment('apt-123', pastDate, pastTime)

      expect(result.success).toBe(false)
      expect(result.error).toContain('futuros')
    })

    it('should fail on schedule conflict', async () => {
      const newDate = new Date(Date.now() + 172800000)
      const dateStr = newDate.toISOString().split('T')[0]
      const timeStr = '10:00'

      // Mock getAppointmentInfo
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockAppointment,
              error: null,
            }),
          }),
        }),
      })
      // Mock RPC conflict check
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: false, error: 'Horário indisponível' },
        error: null,
      })

      const result = await rescheduleAppointment('apt-123', dateStr, timeStr)

      expect(result.success).toBe(false)
      expect(result.error).toContain('indisponível')
    })
  })

  describe('markNoShow', () => {
    it('should mark scheduled appointment as no-show', async () => {
      // Mock getAppointmentInfo
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: mockAppointment,
              error: null,
            }),
          }),
        }),
      })
      // Mock appointment status update
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      })
      // Mock patient select
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: { no_show_count: 0, risk_score: 10 },
              error: null,
            }),
          }),
        }),
      })
      // Mock patient update
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      })

      const result = await markNoShow('apt-123')

      expect(result.success).toBe(true)
    })

    it('should increase patient risk score', async () => {
      // Mock getAppointmentInfo
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: mockAppointment,
              error: null,
            }),
          }),
        }),
      })
      // Mock appointment status update
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      })
      // Mock patient select with existing no-shows
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: { no_show_count: 2, risk_score: 30 },
              error: null,
            }),
          }),
        }),
      })
      // Mock patient update
      mockSupabase.from.mockReturnValueOnce({
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      })

      const result = await markNoShow('apt-123')

      expect(result.success).toBe(true)
      // Verify patient update was called (risk score increased by 10)
      expect(mockSupabase.from).toHaveBeenCalledWith('patients')
    })

    it('should fail for already completed appointments', async () => {
      const completedAppointment = {
        ...mockAppointment,
        status: 'completed',
      }

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({
              data: completedAppointment,
              error: null,
            }),
          }),
        }),
      })

      const result = await markNoShow('apt-123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Only scheduled or confirmed')
    })
  })
})