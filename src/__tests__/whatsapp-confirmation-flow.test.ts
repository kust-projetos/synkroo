/**
 * Integration Tests for WhatsApp Confirmation Flow
 * Tests the complete flow from intent classification to appointment confirmation
 * Migrated from Supabase mock to Drizzle repository mocks
 */

import {
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
} from '@/services/appointments/appointment-actions.service'

// Mock appointments repository — the service now uses this instead of Supabase
jest.mock('@/repositories/appointments', () => ({
  findById: jest.fn(),
  updateStatus: jest.fn(),
  update: jest.fn(),
  rescheduleAppointmentSlot: jest.fn(),
}))

// Mock waitlist service
jest.mock('@/services/waitlist/waitlist.service', () => {
  const mockFn = jest.fn().mockResolvedValue({ notified: 0 })
  return { processWaitlistOnCancellation: mockFn }
})

// Mock logger
jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  whatsappLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

// Mock fetch for WhatsApp notifications
global.fetch = jest.fn().mockResolvedValue({ ok: true })

const {
  findById,
  updateStatus,
  update,
  rescheduleAppointmentSlot,
} = require('@/repositories/appointments')

describe('WhatsApp Confirmation Flow', () => {
  const mockAppointmentRow = {
    id: 'apt-123',
    clinicId: 'clinic-123',
    patientId: 'patient-123',
    dentistId: 'dentist-123',
    procedureId: null,
    scheduledAt: new Date(Date.now() + 86400000),
    durationMinutes: 60,
    status: 'scheduled',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(findById as jest.Mock).mockResolvedValue(mockAppointmentRow)
    ;(updateStatus as jest.Mock).mockResolvedValue({ id: 'apt-123' })
    ;(update as jest.Mock).mockResolvedValue({ id: 'apt-123' })
    ;(rescheduleAppointmentSlot as jest.Mock).mockResolvedValue({ success: true })
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    // Re-require to get fresh reference after clearAllMocks
    const { processWaitlistOnCancellation } = require('@/services/waitlist/waitlist.service')
    ;(processWaitlistOnCancellation as jest.Mock).mockResolvedValue({ notified: 0 })
  })

  describe('Intent-Based Actions', () => {
    it('should confirm appointment when patient sends confirmation intent', async () => {
      const result = await confirmAppointment('apt-123', 'whatsapp')
      expect(result.success).toBe(true)
      expect(updateStatus).toHaveBeenCalledWith('apt-123', 'confirmed')
    })

    it('should cancel appointment when patient sends cancellation intent', async () => {
      const result = await cancelAppointment('apt-123', 'Solicitado via WhatsApp', 'patient')
      expect(result.success).toBe(true)
      expect(updateStatus).toHaveBeenCalledWith('apt-123', 'cancelled', expect.any(Object))
    })

    it('should reschedule appointment when patient sends reschedule intent', async () => {
      const newDate = new Date(Date.now() + 172800000)
      const dateStr = newDate.toISOString().split('T')[0]
      const timeStr = '14:00'

      ;(findById as jest.Mock).mockResolvedValue(mockAppointmentRow)
      ;(rescheduleAppointmentSlot as jest.Mock).mockResolvedValue({ success: true })

      const result = await rescheduleAppointment('apt-123', dateStr, timeStr)

      expect(result.success).toBe(true)
      expect(result.newScheduledAt).toBeDefined()
    })
  })

  describe('WhatsApp Notification Flow', () => {
    it('should track confirmation source as whatsapp', async () => {
      const result = await confirmAppointment('apt-123', 'whatsapp')
      expect(result.success).toBe(true)
    })

    it('should track cancellation source as patient', async () => {
      const result = await cancelAppointment('apt-123', 'Cancelado pelo paciente', 'patient')
      expect(result.success).toBe(true)
    })

    it('should return error when appointment not found', async () => {
      ;(findById as jest.Mock).mockResolvedValue(null)

      const result = await confirmAppointment('nonexistent', 'whatsapp')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Appointment not found')
    })

    it('should return error when cancelling already completed appointment', async () => {
      ;(findById as jest.Mock).mockResolvedValue({ ...mockAppointmentRow, status: 'completed' })

      const result = await cancelAppointment('apt-123', 'test', 'patient')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Only scheduled or confirmed')
    })
  })
})