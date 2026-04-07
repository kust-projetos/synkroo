/**
 * Tests for Smart Triggers Service
 * Tests automated follow-up trigger logic
 */

function createChain(finalResult: any): any {
  const c: any = {
    then(resolve?: (v: any) => any) { return resolve?.(finalResult) },
  }
  const methods = [
    'insert', 'select', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'gt', 'lt',
    'order', 'limit', 'single', 'contains', 'overlaps', 'upsert', 'not', 'in',
  ]
  for (const m of methods) {
    if (m === 'single') {
      c[m] = jest.fn(() => Promise.resolve(finalResult))
    } else {
      c[m] = jest.fn(() => c)
    }
  }
  return c
}

const mockFrom = jest.fn()
const mockClient = { from: mockFrom }

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn().mockResolvedValue(mockClient),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/services/whatsapp', () => ({
  sendWhatsAppMessage: jest.fn().mockResolvedValue({ success: true }),
}))

import { smartTriggersService } from '../smart-triggers.service'

describe('Smart Triggers Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkCooldown', () => {
    it('should return false if cooldown not expired', async () => {
      mockFrom.mockReturnValue(createChain({ data: [{ id: 'recent-1' }], error: null }))

      const result = await smartTriggersService.checkCooldown('patient-1', 'no_show_recovery_1h', 1440)
      expect(result).toBe(false)
    })

    it('should return false if monthly quota exceeded', async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [{ id: 'm1' }, { id: 'm2' }], error: null }))

      const result = await smartTriggersService.checkCooldown('patient-1', 'no_show_recovery_1h', 1440)
      expect(result).toBe(false)
    })

    it('should return true if cooldown passed and quota available', async () => {
      mockFrom
        .mockReturnValueOnce(createChain({ data: [], error: null }))
        .mockReturnValueOnce(createChain({ data: [], error: null }))

      const result = await smartTriggersService.checkCooldown('patient-1', 'satisfaction_survey_7d', 10080)
      expect(result).toBe(true)
    })

    it('should return false on query error', async () => {
      mockFrom.mockReturnValue(createChain({ data: null, error: { message: 'DB error' } }))

      const result = await smartTriggersService.checkCooldown('patient-1', 'no_show_recovery_1h', 1440)
      expect(result).toBe(false)
    })
  })

  describe('logTrigger', () => {
    it('should log trigger without throwing', async () => {
      mockFrom.mockReturnValue(createChain({ error: null }))

      await expect(
        smartTriggersService.logTrigger({
          clinicId: 'clinic-1',
          patientId: 'patient-1',
          triggerType: 'no_show_recovery_1h',
          messageSent: 'Oi João, senti sua falta hoje!',
        })
      ).resolves.not.toThrow()
    })
  })

  describe('recordResponse', () => {
    it('should record patient response without throwing', async () => {
      mockFrom.mockReturnValue(createChain({ error: null }))

      await expect(
        smartTriggersService.recordResponse('trigger-1', 'sim, quero remarcar')
      ).resolves.not.toThrow()
    })
  })

  describe('processNoShowRecovery', () => {
    it('should return summary with sent=0 when no appointments', async () => {
      mockFrom.mockReturnValue(createChain({ data: [], error: null }))

      const summary = await smartTriggersService.processNoShowRecovery()

      expect(summary.triggerType).toBe('no_show_recovery_1h')
      expect(summary.sent).toBe(0)
      expect(summary.skipped).toBe(0)
    })

    it('should handle query error gracefully', async () => {
      mockFrom.mockReturnValue(createChain({ data: null, error: { message: 'DB error' } }))

      const summary = await smartTriggersService.processNoShowRecovery()

      expect(summary.errors).toBe(1)
    })
  })

  describe('processAll', () => {
    it('should run all triggers and return summaries', async () => {
      // All appointment queries return empty data, patient/inactive queries also return empty
      mockFrom.mockReturnValue(createChain({ data: [], error: null }))

      const results = await smartTriggersService.processAll()

      expect(results.length).toBeGreaterThan(0)
      results.forEach(summary => {
        expect(summary).toHaveProperty('triggerType')
        expect(summary).toHaveProperty('sent')
        expect(summary).toHaveProperty('skipped')
        expect(summary).toHaveProperty('errors')
      })
    })
  })
})
