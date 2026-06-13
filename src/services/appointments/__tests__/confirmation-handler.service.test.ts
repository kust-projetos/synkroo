/**
 * Tests for Confirmation Handler Service
 * Tests appointment confirmation/cancellation intent detection
 * Migrated from Supabase mock to Drizzle mock
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import {
  detectConfirmationIntent,
  processConfirmationResponse,
} from '../confirmation-handler.service'

describe('Confirmation Handler Service', () => {
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
    beforeEach(() => {
      jest.clearAllMocks()
    })

    function makeMockDb(patientRows: unknown[], appointmentRows: unknown[]) {
      // Patient query: select().where() → thenable
      const patientWhereFn = jest.fn().mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r: any = Promise.resolve(patientRows)
        r.limit = jest.fn().mockReturnValue(r)
        r.orderBy = jest.fn().mockReturnValue(r)
        return r
      })
      const patientFromFn = jest.fn().mockImplementation(() => ({
        where: patientWhereFn,
      }))
      const patientSelectFn = jest.fn().mockImplementation(() => ({ from: patientFromFn }))

      // Appointment query: select().where() → thenable
      const apptWhereFn = jest.fn().mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r: any = Promise.resolve(appointmentRows)
        r.limit = jest.fn().mockReturnValue(r)
        r.orderBy = jest.fn().mockReturnValue(r)
        return r
      })
      const apptFromFn = jest.fn().mockImplementation(() => ({ where: apptWhereFn }))
      const apptSelectFn = jest.fn().mockImplementation(() => ({ from: apptFromFn }))

      // Counter-based select
      let selectCount = 0
      const selectFn = jest.fn().mockImplementation(() => {
        selectCount++
        if (selectCount === 1) return { from: patientFromFn }
        return { from: apptFromFn }
      })

      return {
        select: selectFn,
        from: jest.fn().mockImplementation(() => ({ where: patientWhereFn })),
        insert: jest.fn().mockReturnValue({ returning: jest.fn().mockResolvedValue([]) }),
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
        }),
      }
    }

    it('should confirm appointment', async () => {
      const patientData = { id: 'patient-1', name: 'João', phone: '11999999999' }
      const appointmentData = { id: 'apt-123', status: 'scheduled', scheduledAt: new Date(), clinicId: 'clinic-1', patientId: 'patient-1' }

      const mockDb = makeMockDb([patientData], [appointmentData])
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await processConfirmationResponse('clinic-1', '11999999999', 'sim')

      expect(result.processed).toBe(true)
      expect(result.action).toBe('confirmed')
      expect(result.appointmentId).toBe('apt-123')
      expect(result.responseMessage).toContain('Confirmado')
    })

    it('should cancel appointment', async () => {
      const patientData = { id: 'patient-1', name: 'Maria', phone: '11988888888' }
      const appointmentData = { id: 'apt-456', status: 'confirmed', scheduledAt: new Date(), clinicId: 'clinic-1', patientId: 'patient-1' }

      const mockDb = makeMockDb([patientData], [appointmentData])
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await processConfirmationResponse('clinic-1', '11988888888', 'não')
      expect(result.processed).toBe(true)
      expect(result.action).toBe('cancelled')
      expect(result.appointmentId).toBe('apt-456')
    })

    it('should handle no pending appointment', async () => {
      const mockDb = makeMockDb([], [])
      jest.spyOn(require('@/lib/db/client'), 'getDb').mockReturnValue(mockDb)

      const result = await processConfirmationResponse('clinic-1', '11999999999', 'sim')
      expect(result.processed).toBe(false)
      expect(result.action).toBe('no_action')
    })
  })
})