/**
 * Tests for Pipeline Stages Service
 */

import {
  getDefaultStageId,
  getPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
} from '@/services/pipeline/stages.service'

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { error: jest.fn(), info: jest.fn() },
}))

const mockSupabase = { from: jest.fn() }

beforeEach(() => {
  jest.clearAllMocks()
  require('@/lib/supabase/typed').createTypedClient.mockReturnValue(mockSupabase)
})

describe('Pipeline Stages Service', () => {
  const clinicId = 'clinic-123'

  describe('getDefaultStageId', () => {
    it('should return default stage id', async () => {
      // Chain: .select().eq().eq().single()
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({ data: { id: 'stage-default' }, error: null }),
            }),
          }),
        }),
      })

      const result = await getDefaultStageId(clinicId)
      expect(result).toBe('stage-default')
    })

    it('should return null when not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({ data: null, error: {} }),
            }),
          }),
        }),
      })

      const result = await getDefaultStageId(clinicId)
      expect(result).toBeNull()
    })
  })

  describe('getPipelineStages', () => {
    it('should return stages ordered by sort_order', async () => {
      const mockStages = [
        { id: 's1', name: 'Novo', color: '#3B82F6', sort_order: 0 },
        { id: 's2', name: 'Contatado', color: '#8B5CF6', sort_order: 1 },
      ]

      // Chain: .select().eq().eq().order() - 2 eqs, then order
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: jest.fn().mockResolvedValue({ data: mockStages, error: null }),
            }),
          }),
        }),
      })

      const result = await getPipelineStages(clinicId)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Novo')
    })

    it('should throw on database error', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: jest.fn().mockRejectedValue(new Error('Database error')),
            }),
          }),
        }),
      })

      await expect(getPipelineStages(clinicId)).rejects.toThrow()
    })
  })

  describe('createPipelineStage', () => {
    it('should create a new stage', async () => {
      const mockCreated = {
        id: 's-new', clinic_id: clinicId, name: 'Novo', color: '#fff', sort_order: 0,
        is_default: false, is_system: false, created_at: '2024-01-01', updated_at: '2024-01-01',
      }

      let callCount = 0
      mockSupabase.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: check for existing name - .select().eq().eq().single()
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }
        } else if (callCount === 2) {
          // Second call: get last sort_order - .select().eq().order().limit()
          return {
            select: () => ({
              eq: () => ({
                order: () => ({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }
        } else {
          // Third call: insert - .insert().select().single()
          return {
            insert: () => ({
              select: () => ({
                single: jest.fn().mockResolvedValue({ data: mockCreated, error: null }),
              }),
            }),
          }
        }
      })

      const result = await createPipelineStage({ clinicId, name: 'Novo', color: '#fff' })

      expect(result).not.toBeNull()
      expect(result.name).toBe('Novo')
    })

    it('should throw if stage name exists', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
            }),
          }),
        }),
      })

      await expect(createPipelineStage({ clinicId, name: 'Novo', color: '#fff' }))
        .rejects.toThrow('Stage with name "Novo" already exists')
    })
  })

  describe('updatePipelineStage', () => {
    it('should update a stage', async () => {
      const mockUpdated = {
        id: 's1', clinic_id: clinicId, name: 'Updated', color: '#fff', sort_order: 0,
        is_default: false, is_system: false, created_at: '2024-01-01', updated_at: '2024-01-02',
      }

      let callCount = 0
      mockSupabase.from.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: select stage - .select().eq().single()
          return {
            select: () => ({
              eq: () => ({
                single: jest.fn().mockResolvedValue({ data: { is_default: false }, error: null }),
              }),
            }),
          }
        } else {
          // Second call: update stage - .update().eq().select().single()
          return {
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
                }),
              }),
            }),
          }
        }
      })

      const result = await updatePipelineStage('s1', { name: 'Updated' })

      expect(result).not.toBeNull()
      expect(result.name).toBe('Updated')
    })

    it('should throw when updating default stage', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: { is_default: true }, error: null }),
          }),
        }),
      })

      await expect(updatePipelineStage('s1', { name: 'Updated' }))
        .rejects.toThrow('Cannot update default stage')
    })

    it('should throw when stage not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: null, error: {} }),
          }),
        }),
      })

      await expect(updatePipelineStage('nonexistent', { name: 'Test' }))
        .rejects.toThrow('Stage not found')
    })
  })

  describe('deletePipelineStage', () => {
    it('should throw when deleting default stage', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: jest.fn().mockResolvedValue({ data: { is_default: true, name: 'Default' }, error: null }),
          }),
        }),
      })

      await expect(deletePipelineStage('s1')).rejects.toThrow('Cannot delete default stage')
    })
  })

  describe('reorderPipelineStages', () => {
    it('should throw for empty array', async () => {
      await expect(reorderPipelineStages([], clinicId)).rejects.toThrow('stages array required')
    })
  })
})
