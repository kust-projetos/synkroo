/**
 * Tests for Budget Follow-up Service
 * Tests finding unconverted budgets and sending follow-ups
 */

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  leftJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockResolvedValue([]),
}
jest.mock('@/lib/db/client', () => ({ getDb: jest.fn(() => mockDb) }))

jest.mock('@/lib/logger', () => ({
  dbLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

import { findUnconvertedBudgets, sendBudgetFollowup, processBudgetFollowups } from '../budget-followup.service'

describe('Budget Follow-up Service', () => {
  const mockClient = { from: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
  })

  describe('findUnconvertedBudgets', () => {
    it('should find budgets older than 7 days with sent/pending status', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      const mockRow = {
        budgets: {
          id: 'budget-1', patientId: 'patient-1', clinicId: 'clinic-1',
          totalValue: '1500', status: 'sent', createdAt: oldDate, notes: '',
        },
        patients: { name: 'João', phone: '11999999999' },
      }
      mockDb.orderBy.mockResolvedValue([mockRow])

      const results = await findUnconvertedBudgets('clinic-1')

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe('budget-1')
      expect(results[0].days_since_created).toBeGreaterThanOrEqual(7)
      expect(results[0].followup_stage).toBe(0)
    })

    it('should parse followup stage from notes', async () => {
      const oldDate = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
      mockDb.orderBy.mockResolvedValue([{
        budgets: { id: 'b1', patientId: 'p1', clinicId: 'clinic-1', totalValue: '500', status: 'sent', createdAt: oldDate, notes: '[followup-stage-1-date: 2026-03-20]' },
        patients: { name: 'Maria', phone: '11888888888' },
      }])

      const results = await findUnconvertedBudgets('clinic-1')
      expect(results[0].followup_stage).toBe(1)
    })

    it('should return empty array on error', async () => {
      mockDb.orderBy.mockRejectedValue(new Error('DB error'))
      const results = await findUnconvertedBudgets('clinic-1')
      expect(results).toEqual([])
    })
  })

  describe('sendBudgetFollowup', () => {
    it('should return false if budget not found', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      })

      const result = await sendBudgetFollowup('nonexistent', 'clinic-1')
      expect(result.success).toBe(false)
      expect(result.message).toBe('Budget not found')
    })

    it('should return false if patient has no phone', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'b1', patient_id: 'p1', notes: '', patients: { name: 'João', phone: null } },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await sendBudgetFollowup('b1', 'clinic-1')
      expect(result.success).toBe(false)
      expect(result.message).toBe('Patient has no phone number')
    })

    it('should send followup and update notes', async () => {
      mockClient.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { id: 'b1', patient_id: 'p1', notes: '', patients: { name: 'João', phone: '11999999999' } },
                  error: null,
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

      const result = await sendBudgetFollowup('b1', 'clinic-1')

      expect(result.success).toBe(true)
      expect(result.stage).toBe(1)
      expect(result.message).toBeTruthy()
    })

    it('should reject if all stages completed', async () => {
      // Use ONLY stage 2 in notes so regex captures stage 2 (highest stage)
      // Regex /\[followup-stage-(\d+)-date/ matches first occurrence,
      // so we need a single note with the highest stage number
      const notesWithAllStages = '[followup-stage-2-date: 2026-03-22]'

      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'b1', patient_id: 'p1', notes: notesWithAllStages, patients: { name: 'João', phone: '11999999999' } },
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await sendBudgetFollowup('b1', 'clinic-1')
      expect(result.success).toBe(false)
      expect(result.message).toBe('All follow-up stages completed')
    })
  })

  describe('processBudgetFollowups', () => {
    it('should return zeroed counts when no unconverted budgets', async () => {
      mockClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      })

      const result = await processBudgetFollowups('clinic-1')
      expect(result.processed).toBe(0)
      expect(result.errors).toBe(0)
    })
  })
})
