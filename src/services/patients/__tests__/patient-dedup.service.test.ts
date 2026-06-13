/**
 * Tests for Patient Deduplication Service
 * Migrated from Supabase mock to Drizzle mock
 */

jest.mock('@/lib/logger', () => ({
  dbLogger: {
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  },
}))

import { detectDuplicates, mergePatients } from '../patient-dedup.service'
import { mockDb } from '@/test-utils/db-mock'

describe('Patient Dedup Service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockDb.select as jest.Mock).mockReset()
    ;(mockDb.update as jest.Mock).mockReset()
    // Default: return safe dummy chain so unexpected calls don't throw
    const dummyWhere = jest.fn().mockResolvedValue([])
    const dummyFrom = jest.fn().mockReturnValue({ where: dummyWhere })
    ;(mockDb.select as jest.Mock).mockReturnValue({ from: dummyFrom })
    ;(mockDb.update as jest.Mock).mockReturnValue({ set: jest.fn().mockReturnValue({ where: dummyWhere }) })
  })

  describe('detectDuplicates', () => {
    it('should detect duplicate by CPF', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '111', email: null, cpf: '12345678901', createdAt: new Date('2025-01-01') },
        { id: 'p2', name: 'Joao S.', phone: '222', email: null, cpf: '12345678901', createdAt: new Date('2025-02-01') },
      ]
      const emptyAppointments: { patientId: string }[] = []

      // First select: patients
      const mockWhere1 = jest.fn().mockResolvedValue(patients)
      const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom1 })

      // Second select: appointments
      const mockWhere2 = jest.fn().mockResolvedValue(emptyAppointments)
      const mockFrom2 = jest.fn().mockReturnValue({ where: mockWhere2 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom2 })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].match_reason).toBe('cpf')
      expect(duplicates[0].confidence).toBe(0.95)
    })

    it('should detect duplicate by phone with similar name', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '11999999999', email: null, cpf: null, createdAt: new Date('2025-01-01') },
        { id: 'p2', name: 'João Silva Souza', phone: '11999999999', email: null, cpf: null, createdAt: new Date('2025-02-01') },
      ]

      const mockWhere1 = jest.fn().mockResolvedValue(patients)
      const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom1 })

      const mockWhere2 = jest.fn().mockResolvedValue([])
      const mockFrom2 = jest.fn().mockReturnValue({ where: mockWhere2 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom2 })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].match_reason).toBe('name_phone')
      expect(duplicates[0].confidence).toBe(0.9)
    })

    it('should detect duplicate by phone alone', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '11999999999', email: null, cpf: null, createdAt: new Date('2025-01-01') },
        { id: 'p2', name: 'Maria Santos', phone: '11999999999', email: null, cpf: null, createdAt: new Date('2025-02-01') },
      ]

      const mockWhere1 = jest.fn().mockResolvedValue(patients)
      const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom1 })

      const mockWhere2 = jest.fn().mockResolvedValue([])
      const mockFrom2 = jest.fn().mockReturnValue({ where: mockWhere2 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom2 })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates).toHaveLength(1)
      expect(duplicates[0].match_reason).toBe('phone')
      expect(duplicates[0].confidence).toBe(0.7)
    })

    it('should not detect duplicates when none exist', async () => {
      const patients = [
        { id: 'p1', name: 'João Silva', phone: '111', email: 'j@e.com', cpf: '111', createdAt: new Date('2025-01-01') },
        { id: 'p2', name: 'Maria Santos', phone: '222', email: 'm@e.com', cpf: '222', createdAt: new Date('2025-02-01') },
      ]

      const mockWhere1 = jest.fn().mockResolvedValue(patients)
      const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom1 })

      const mockWhere2 = jest.fn().mockResolvedValue([])
      const mockFrom2 = jest.fn().mockReturnValue({ where: mockWhere2 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom2 })

      const duplicates = await detectDuplicates('c1')
      expect(duplicates).toHaveLength(0)
    })

    it('should handle DB error gracefully', async () => {
      const mockWhere1 = jest.fn().mockRejectedValue(new Error('DB error'))
      const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom1 })

      const duplicates = await detectDuplicates('c1')
      expect(duplicates).toEqual([])
    })

    it('should choose primary by appointment count', async () => {
      const patients = [
        { id: 'p1', name: 'João', phone: '11999999999', email: null, cpf: null, createdAt: new Date('2025-01-01') },
        { id: 'p2', name: 'João S.', phone: '11999999999', email: null, cpf: null, createdAt: new Date('2025-06-01') },
      ]
      const appointments = [{ patientId: 'p1' }, { patientId: 'p1' }, { patientId: 'p2' }]

      const mockWhere1 = jest.fn().mockResolvedValue(patients)
      const mockFrom1 = jest.fn().mockReturnValue({ where: mockWhere1 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom1 })

      const mockWhere2 = jest.fn().mockResolvedValue(appointments)
      const mockFrom2 = jest.fn().mockReturnValue({ where: mockWhere2 })
      ;(mockDb.select as jest.Mock).mockReturnValueOnce({ from: mockFrom2 })

      const duplicates = await detectDuplicates('c1')

      expect(duplicates[0].primary.id).toBe('p1')
      expect(duplicates[0].primary.appointment_count).toBe(2)
    })
  })

  describe('mergePatients', () => {
    it('should merge secondary into primary', async () => {
      const primary = { id: 'p1', name: 'João Silva', email: null, cpf: null, tags: ['vip'], clinicId: 'c1', phone: '111', birthDate: null, gender: null, notes: null, lastVisitAt: null, optOutMarketing: null, optOutReminders: null, riskScore: null, createdAt: new Date(), updatedAt: new Date() }
      const secondary = { id: 'p2', name: 'Joao', email: 'joao@example.com', cpf: '12345678901', tags: ['novo'], clinicId: 'c1', phone: '222', birthDate: '1990-01-01' as unknown as null, gender: null, notes: null, lastVisitAt: null, optOutMarketing: null, optOutReminders: null, riskScore: null, createdAt: new Date(), updatedAt: new Date() }

      // Select patients
      const selectWhere = jest.fn().mockResolvedValue([primary, secondary])
      const selectFrom = jest.fn().mockReturnValue({ where: selectWhere })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: selectFrom })

      // Update calls (5x)
      const updateSet = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) })
      const updateWhere = jest.fn().mockReturnValue({ set: updateSet })
      ;(mockDb.update as jest.Mock).mockReturnValue({ set: updateSet, where: updateWhere })

      const result = await mergePatients('p1', 'p2', 'c1')
      expect(result.success).toBe(true)
    })

    it('should fail when patient not found', async () => {
      const selectWhere = jest.fn().mockResolvedValue([])
      const selectFrom = jest.fn().mockReturnValue({ where: selectWhere })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: selectFrom })

      const result = await mergePatients('p1', 'p2', 'c1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Patient not found')
    })

    it('should handle DB error gracefully', async () => {
      const selectWhere = jest.fn().mockRejectedValue(new Error('DB error'))
      const selectFrom = jest.fn().mockReturnValue({ where: selectWhere })
      ;(mockDb.select as jest.Mock).mockReturnValue({ from: selectFrom })

      const result = await mergePatients('p1', 'p2', 'c1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('DB error')
    })
  })
})