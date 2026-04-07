/**
 * Tests for Patient Deduplication Service
 * Covers detectDuplicates and mergePatients with Supabase mocks
 */

import { detectDuplicates, mergePatients } from '../patient-dedup.service'

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

describe('Patient Dedup Service', () => {
  describe('detectDuplicates', () => {
    it('should detect duplicate by CPF', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '111', email: null, cpf: '12345678901', created_at: '2025-01-01' },
        { id: 'p2', name: 'Joao S.', phone: '222', email: null, cpf: '12345678901', created_at: '2025-02-01' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: patients, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].match_reason).toBe('cpf')
      expect(duplicates[0].confidence).toBe(0.95)
    })

    it('should detect duplicate by phone with similar name', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '11999999999', email: null, cpf: null, created_at: '2025-01-01' },
        { id: 'p2', name: 'João Silva Souza', phone: '11999999999', email: null, cpf: null, created_at: '2025-02-01' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: patients, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].match_reason).toBe('name_phone')
      expect(duplicates[0].confidence).toBe(0.9)
    })

    it('should detect duplicate by phone alone', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '11999999999', email: null, cpf: null, created_at: '2025-01-01' },
        { id: 'p2', name: 'Maria Santos', phone: '11999999999', email: null, cpf: null, created_at: '2025-02-01' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: patients, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].match_reason).toBe('phone')
      expect(duplicates[0].confidence).toBe(0.7)
    })

    it('should not detect duplicates when none exist', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '111', email: 'j@e.com', cpf: '111', created_at: '2025-01-01' },
        { id: 'p2', name: 'Maria Santos', phone: '222', email: 'm@e.com', cpf: '222', created_at: '2025-02-01' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: patients, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        })

      const duplicates = await detectDuplicates('c1')
      expect(duplicates).toHaveLength(0)
    })

    it('should handle DB error gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            is: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      })

      const duplicates = await detectDuplicates('c1')
      expect(duplicates).toEqual([])
    })

    it('should choose primary by appointment count', async () => {
      const patients = [
        { id: 'p1', name: 'João', phone: '11999999999', email: null, cpf: null, created_at: '2025-01-01' },
        { id: 'p2', name: 'João S.', phone: '11999999999', email: null, cpf: null, created_at: '2025-06-01' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockResolvedValue({ data: patients, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: [{ patient_id: 'p1' }, { patient_id: 'p1' }, { patient_id: 'p2' }],
              error: null,
            }),
          }),
        })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates[0].primary.id).toBe('p1')
      expect(duplicates[0].primary.appointment_count).toBe(2)
    })
  })

  describe('mergePatients', () => {
    it('should merge secondary into primary', async () => {
      const primary = {
        id: 'p1', name: 'João Silva', email: null, cpf: null,
        birth_date: null, address: null, tags: ['VIP'],
      }
      const secondary = {
        id: 'p2', name: 'Joao', email: 'joao@example.com', cpf: '12345678901',
        birth_date: '1990-01-01', address: 'Rua A', tags: ['Novo'],
      }

      mockSupabase.from
        // Get both patients
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [primary, secondary],
                error: null,
              }),
            }),
          }),
        })
        // Update primary with merged data
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Reassign appointments
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Reassign conversations
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Reassign leads
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        // Soft-delete secondary
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await mergePatients('p1', 'p2', 'c1')
      expect(result.success).toBe(true)
    })

    it('should fail when patient not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      })

      const result = await mergePatients('p1', 'p2', 'c1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient not found')
    })

    it('should handle DB error gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
          }),
        }),
      })

      const result = await mergePatients('p1', 'p2', 'c1')
      expect(result.success).toBe(false)
      // Non-Error thrown objects result in 'Unknown error'
      expect(result.error).toBe('Unknown error')
    })
  })
})
