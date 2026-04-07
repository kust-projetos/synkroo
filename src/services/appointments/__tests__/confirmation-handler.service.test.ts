/**
 * Tests for Confirmation Handler Service
 * Tests appointment confirmation/cancellation intent detection
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  detectConfirmationIntent,
  processConfirmationResponse,
} from '../confirmation-handler.service'

function setupPatientChain(data: any): any {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data, error: null }),
    }),
  }
}

function setupAppointmentChain(data: any): any {
  return {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        in: jest.fn().mockReturnValue({
          gte: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data, error: null }),
            }),
          }),
        }),
      }),
    }),
  }
}

describe('Confirmation Handler Service', () => {
  const mockClient = { from: jest.fn() } as { from: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
  })

  describe('detectConfirmationIntent', () => {
    it('should detect "sim" as confirmation', () => {
      const result = detectConfirmationIntent('sim')
      expect(result.isConfirmation).toBe(true)
      expect(result.isCancellation).toBe(false)
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should detect "confirmo" as confirmation', () => {
      const result = detectConfirmationIntent('confirmo a consulta')
      expect(result.isConfirmation).toBe(true)
    })

    it('should detect "ok" as confirmation', () => {
      const result = detectConfirmationIntent('ok, tudo certo')
      expect(result.isConfirmation).toBe(true)
    })

    it('should detect "não" as cancellation', () => {
      const result = detectConfirmationIntent('não')
      expect(result.isCancellation).toBe(true)
      expect(result.isConfirmation).toBe(false)
    })

    it('should detect "cancelar" as cancellation', () => {
      const result = detectConfirmationIntent('quero cancelar')
      expect(result.isCancellation).toBe(true)
    })

    it('should detect "desmarcar" as cancellation', () => {
      const result = detectConfirmationIntent('desmarcar')
      expect(result.isCancellation).toBe(true)
    })

    it('should detect "desmarcar" as cancellation', () => {
      const result = detectConfirmationIntent('quero desmarcar minha consulta')
      expect(result.isCancellation).toBe(true)
    })

    it('should return no intent for unrelated message', () => {
      const result = detectConfirmationIntent('bom dia, quero agendar')
      expect(result.isConfirmation).toBe(false)
      expect(result.isCancellation).toBe(false)
      expect(result.confidence).toBe(0)
    })

    it('should handle case-insensitive matching', () => {
      const result = detectConfirmationIntent('SIM')
      expect(result.isConfirmation).toBe(true)
    })

    it('should handle accented characters', () => {
      const result = detectConfirmationIntent('Não posso comparecer')
      expect(result.isCancellation).toBe(true)
    })
  })

  describe('processConfirmationResponse', () => {
    it('should confirm appointment', async () => {
      // findPendingAppointment: patients query → appointments query
      // processConfirmation: update appointment
      const patientData = { id: 'patient-1', name: 'João', phone: '11999999999' }
      const appointmentData = { id: 'apt-123', status: 'scheduled', scheduled_at: new Date().toISOString(), clinic_id: 'clinic-1', patient_id: 'patient-1' }

      mockClient.from
        // findPendingAppointment - patients query
        .mockReturnValueOnce(setupPatientChain([patientData]))
        // findPendingAppointment - appointments query
        .mockReturnValueOnce(setupAppointmentChain([appointmentData]))
        // confirm - update appointments
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await processConfirmationResponse('clinic-1', '11999999999', 'sim')

      expect(result.processed).toBe(true)
      expect(result.action).toBe('confirmed')
      expect(result.appointmentId).toBe('apt-123')
      expect(result.responseMessage).toContain('Confirmado')
    })

    it('should cancel appointment', async () => {
      const patientData = { id: 'patient-1', name: 'Maria', phone: '11988888888' }
      const appointmentData = { id: 'apt-456', status: 'confirmed', scheduled_at: new Date().toISOString(), clinic_id: 'clinic-1', patient_id: 'patient-1' }

      mockClient.from
        .mockReturnValueOnce(setupPatientChain([patientData]))
        .mockReturnValueOnce(setupAppointmentChain([appointmentData]))
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await processConfirmationResponse('clinic-1', '11988888888', 'não')
      expect(result.processed).toBe(true)
      expect(result.action).toBe('cancelled')
      expect(result.appointmentId).toBe('apt-456')
    })

    it('should handle no pending appointment', async () => {
      mockClient.from
        .mockReturnValueOnce(setupPatientChain(null)) // no patients
        .mockReturnValueOnce(setupAppointmentChain([])) // no appointments

      const result = await processConfirmationResponse('clinic-1', '11999999999', 'sim')
      expect(result.processed).toBe(false)
      expect(result.action).toBe('no_action')
    })
  })
})
