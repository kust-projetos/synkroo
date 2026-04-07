/**
 * Tests for Budget Service
 * Covers calculateBudgetTotals (pure), createBudget, getBudgetById, updateBudgetStatus, deleteBudget
 */

import {
  calculateBudgetTotals,
  createBudget,
  getBudgetById,
  updateBudgetStatus,
  deleteBudget,
  getBudgetStats,
} from '../budget.service'

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

describe('Budget Service', () => {
  describe('calculateBudgetTotals (pure)', () => {
    it('should calculate totals for single item without discount', () => {
      const items = [{ quantity: 2, unit_price: 100, discount_percent: 0 }]
      const result = calculateBudgetTotals(items)

      expect(result.total_value).toBe(200)
      expect(result.discount_value).toBe(0)
      expect(result.final_value).toBe(200)
    })

    it('should calculate totals with item-level discount', () => {
      const items = [{ quantity: 1, unit_price: 200, discount_percent: 10 }]
      const result = calculateBudgetTotals(items)

      expect(result.total_value).toBe(180)
      expect(result.discount_value).toBe(0)
      expect(result.final_value).toBe(180)
    })

    it('should calculate totals with overall discount', () => {
      const items = [{ quantity: 1, unit_price: 100, discount_percent: 0 }]
      const result = calculateBudgetTotals(items, 20)

      expect(result.total_value).toBe(100)
      expect(result.discount_value).toBe(20)
      expect(result.final_value).toBe(80)
    })

    it('should calculate totals with both item and overall discount', () => {
      const items = [{ quantity: 2, unit_price: 100, discount_percent: 10 }]
      const result = calculateBudgetTotals(items, 15)

      // item total: 2 * 100 = 200, item disc 10% = 20, total = 180
      // overall disc: 180 * 15% = 27
      // final: 180 - 27 = 153
      expect(result.total_value).toBe(180)
      expect(result.discount_value).toBe(27)
      expect(result.final_value).toBe(153)
    })

    it('should handle multiple items correctly', () => {
      const items = [
        { quantity: 1, unit_price: 100, discount_percent: 0 },
        { quantity: 2, unit_price: 50, discount_percent: 0 },
      ]
      const result = calculateBudgetTotals(items)

      expect(result.total_value).toBe(200)
      expect(result.final_value).toBe(200)
    })

    it('should round to 2 decimal places', () => {
      const items = [{ quantity: 3, unit_price: 33.33, discount_percent: 0 }]
      const result = calculateBudgetTotals(items)

      // 3 * 33.33 = 99.99
      expect(result.total_value).toBe(99.99)
      expect(result.final_value).toBe(99.99)
    })
  })

  describe('createBudget', () => {
    it('should create budget with items', async () => {
      const mockBudget = { id: 'budget-1', clinic_id: 'c1', patient_id: 'p1', status: 'pending' }

      mockSupabase.from
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockBudget, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: [{ id: 'item-1', procedure_name: 'Limpeza' }],
              error: null,
            }),
          }),
        })

      const result = await createBudget({
        clinic_id: 'c1',
        patient_id: 'p1',
        items: [
          { procedure_name: 'Limpeza', quantity: 1, unit_price: 100, discount_percent: 0 },
        ],
      })

      expect(result.id).toBe('budget-1')
      expect(result.items).toHaveLength(1)
    })

    it('should throw on budget creation error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      })

      await expect(createBudget({
        clinic_id: 'c1',
        patient_id: 'p1',
        items: [],
      })).rejects.toThrow('Failed to create budget')
    })

    it('should cleanup budget when items fail', async () => {
      const mockBudget = { id: 'budget-1', clinic_id: 'c1', patient_id: 'p1' }

      mockSupabase.from
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockBudget, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: null, error: { message: 'Items error' } }),
          }),
        })
        // cleanup: .from('budgets').delete().eq('id', budget.id)
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      await expect(createBudget({
        clinic_id: 'c1',
        patient_id: 'p1',
        items: [{ procedure_name: 'Limpeza', quantity: 1, unit_price: 100, discount_percent: 0 }],
      })).rejects.toThrow('Failed to create budget items')

      expect(mockSupabase.from).toHaveBeenCalledWith('budgets')
    })
  })

  describe('getBudgetById', () => {
    it('should return budget with patient and items', async () => {
      const mockData = {
        id: 'b1', clinic_id: 'c1', patient_id: 'p1',
        patients: { id: 'p1', name: 'João', phone: '11999999999' },
        budget_items: [{ id: 'i1', procedure_name: 'Limpeza' }],
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockData, error: null }),
          }),
        }),
      })

      const result = await getBudgetById('b1')
      expect(result).not.toBeNull()
      expect(result!.id).toBe('b1')
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      })

      const result = await getBudgetById('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('updateBudgetStatus', () => {
    it('should update status with metadata', async () => {
      const mockUpdated = { id: 'b1', status: 'accepted' }

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
            }),
          }),
        }),
      })

      const result = await updateBudgetStatus('b1', 'accepted', {
        responded_at: new Date().toISOString(),
      })

      expect(result).not.toBeNull()
      expect(result!.status).toBe('accepted')
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
            }),
          }),
        }),
      })

      const result = await updateBudgetStatus('b1', 'accepted')
      expect(result).toBeNull()
    })
  })

  describe('deleteBudget', () => {
    it('should soft delete by default', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })

      const result = await deleteBudget('b1')
      expect(result).toBe(true)
    })

    it('should hard delete when specified', async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await deleteBudget('b1', true)
      expect(result).toBe(true)
    })
  })

  describe('getBudgetStats', () => {
    it('should calculate stats from budgets', async () => {
      const mockData = [
        { status: 'pending', final_value: 100 },
        { status: 'sent', final_value: 200 },
        { status: 'accepted', final_value: 150 },
        { status: 'rejected', final_value: 50 },
        { status: 'converted', final_value: 300 },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockData, error: null }),
        }),
      })

      const stats = await getBudgetStats('c1')

      expect(stats.total).toBe(5)
      expect(stats.pending).toBe(1)
      expect(stats.converted).toBe(1)
      expect(stats.total_value).toBe(800)
      // conversion_rate = converted / (accepted + rejected + converted) * 100 = 1/3 * 100
      expect(stats.conversion_rate).toBeGreaterThanOrEqual(33)
    })

    it('should return zeros on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
        }),
      })

      const stats = await getBudgetStats('c1')
      expect(stats.total).toBe(0)
      expect(stats.conversion_rate).toBe(0)
    })
  })
})
