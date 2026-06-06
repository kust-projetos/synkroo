/**
 * Tests for Pipeline Analytics Service
 * Mocks: Supabase client (createTypedClient)
 */

const mockSupabaseClient = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }),
  }),
}

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn().mockResolvedValue(mockSupabaseClient),
}))

import {
  getConversionByStage,
} from '../pipeline-analytics.service'

describe('Pipeline Analytics Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getConversionByStage()', () => {
    it('should return empty array when no stages exist', async () => {
      ;(mockSupabaseClient.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          eq: jest.fn().mockReturnValueOnce({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })

      const result = await getConversionByStage('clinic-123')
      expect(result).toEqual([])
    })

    it('should return zeros for empty pipeline (no leads)', async () => {
      const stages = [
        { id: 'stage-1', name: 'Novo', color: '#3B82F6', sort_order: 1 },
        { id: 'stage-2', name: 'Qualificado', color: '#10B981', sort_order: 2 },
      ]
      ;(mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockResolvedValue({ data: stages, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })

      const result = await getConversionByStage('clinic-123')
      expect(result).toHaveLength(2)
      expect(result[0].totalLeads).toBe(0)
      expect(result[0].conversionRate).toBe(0)
      expect(result[1].totalLeads).toBe(0)
      expect(result[1].conversionRate).toBe(0)
    })

    it('should calculate conversion rates correctly', async () => {
      const stages = [{ id: 'stage-1', name: 'Novo', color: '#3B82F6', sort_order: 1 }]
      const leads = [
        { stage_id: 'stage-1', converted_at: '2026-01-01' }, // converted
        { stage_id: 'stage-1', converted_at: null }, // not converted
        { stage_id: 'stage-1', converted_at: null }, // not converted
      ]
      ;(mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockResolvedValue({ data: stages, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockResolvedValue({ data: leads, error: null }),
          }),
        })

      const result = await getConversionByStage('clinic-123')
      expect(result).toHaveLength(1)
      expect(result[0].totalLeads).toBe(3)
      expect(result[0].convertedLeads).toBe(1)
      expect(result[0].conversionRate).toBeCloseTo(33.33, 1)
    })

    it('should handle incomplete lead data gracefully', async () => {
      const stages = [{ id: 'stage-1', name: 'Novo', color: '#3B82F6', sort_order: 1 }]
      const leads = [
        { stage_id: null, converted_at: null }, // no stage
        { stage_id: 'stage-other', converted_at: null }, // different stage
      ]
      ;(mockSupabaseClient.from as jest.Mock)
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockReturnValueOnce({
              order: jest.fn().mockResolvedValue({ data: stages, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValueOnce({
            eq: jest.fn().mockResolvedValue({ data: leads, error: null }),
          }),
        })

      const result = await getConversionByStage('clinic-123')
      expect(result).toHaveLength(1)
      expect(result[0].totalLeads).toBe(0) // leads with null stage_id are not counted
      expect(result[0].conversionRate).toBe(0)
    })
  })
})