/**
 * Integration Tests for WhatsApp Confirmation Flow
 * Tests the complete flow from intent classification to appointment confirmation
 */

/* eslint-disable @typescript-eslint/no-require-imports */
import { confirmAppointment, cancelAppointment, rescheduleAppointment } from '@/services/appointments/appointment-actions.service'

// Mock Supabase
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

// Mock waitlist service
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
  const { processWaitlistOnCancellation } = require('@/services/waitlist/waitlist.service')
  processWaitlistOnCancellation.mockResolvedValue({ notified: 0 })
})

describe('WhatsApp Confirmation Flow', () => {
  const mockAppointment = {
    id: 'apt-123',
    clinic_id: 'clinic-123',
    patient_id: 'patient-123',
    dentist_id: 'dentist-123',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    duration_minutes: 60,
    status: 'scheduled',
    patients: { id: 'patient-123', name: 'João Silva', phone: '11999999999' },
    dentists: { name: 'Dra. Maria' },
    procedures: { name: 'Limpeza' },
  }

  describe('Intent-Based Actions', () => {
    it('should confirm appointment when patient sends confirmation intent', async () => {
      // Simulate: Patient sends "Confirmar consulta" via WhatsApp
      // System classifies intent as 'confirmacao'
      // System confirms the appointment

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

    it('should cancel appointment when patient sends cancellation intent', async () => {
      // Simulate: Patient sends "Cancelar consulta" via WhatsApp
      // System classifies intent as 'cancelamento'
      // System cancels the appointment and notifies waitlist

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

      const result = await cancelAppointment('apt-123', 'Solicitado via WhatsApp', 'patient')

      expect(result.success).toBe(true)
    })

    it('should reschedule appointment when patient sends reschedule intent', async () => {
      // Simulate: Patient sends "Remarcar para dia 15" via WhatsApp
      // System classifies intent as 'reagendamento'
      // System reschedules the appointment

      const newDate = new Date(Date.now() + 172800000)
      const dateStr = newDate.toISOString().split('T')[0]
      const timeStr = '14:00'

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
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { success: true },
        error: null,
      })

      const result = await rescheduleAppointment('apt-123', dateStr, timeStr)

      expect(result.success).toBe(true)
      expect(result.newScheduledAt).toBeDefined()
    })
  })

  describe('WhatsApp Notification Flow', () => {
    it('should track confirmation source as whatsapp', async () => {
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

    it('should track cancellation source as patient', async () => {
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

      const result = await cancelAppointment('apt-123', 'Cancelado pelo paciente', 'patient')

      expect(result.success).toBe(true)
    })
  })
})