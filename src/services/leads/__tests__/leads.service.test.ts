/**
 * Tests for Leads Service
 */

import {
  calculateLeadScore,
  createLead,
  getLeads,
  updateLeadStatus,
  qualifyLead,
  getHotLeads,
  convertLeadToPatient,
  getLeadStats,
  getTemperatureFromScore,
  LeadStatus,
  LeadTemperature,
} from '@/services/leads/leads.service'

// Mock the Supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockSupabase = {
  from: jest.fn(),
}

beforeEach(() => {
  jest.clearAllMocks()
  const { createTypedClient } = require('@/lib/supabase/typed')
  createTypedClient.mockReturnValue(mockSupabase)
})

describe('Leads Service', () => {
  const clinicId = 'clinic-123'

  describe('calculateLeadScore', () => {
    it('should calculate base score correctly', () => {
      const result = calculateLeadScore({
        source: 'instagram',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })

      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
      expect(result.factors).toBeDefined()
      expect(result.recommendation).toBeDefined()
    })

    it('should increase score for qualified leads (BANT)', () => {
      const unqualifiedResult = calculateLeadScore({
        source: 'referral',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })

      const qualifiedResult = calculateLeadScore({
        source: 'referral',
        hasPhone: true,
        hasEmail: true,
        expressedInterest: true,
        hasBudget: true,
        hasTimeline: true,
        respondedToFollowup: true,
        previousPatient: false,
      })

      expect(qualifiedResult.score).toBeGreaterThan(unqualifiedResult.score)
    })

    it('should increase score for engagement', () => {
      const lowEngagementResult = calculateLeadScore({
        source: 'web',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })

      const highEngagementResult = calculateLeadScore({
        source: 'web',
        hasPhone: true,
        hasEmail: true,
        expressedInterest: true,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: true,
        previousPatient: false,
      })

      expect(highEngagementResult.score).toBeGreaterThan(lowEngagementResult.score)
    })

    it('should give bonus for referral source', () => {
      const referralResult = calculateLeadScore({
        source: 'referral',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })

      const webResult = calculateLeadScore({
        source: 'web',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })

      expect(referralResult.score).toBeGreaterThan(webResult.score)
    })

    it('should give bonus for previous patient', () => {
      const newPatientResult = calculateLeadScore({
        source: 'whatsapp',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: false,
      })

      const previousPatientResult = calculateLeadScore({
        source: 'whatsapp',
        hasPhone: true,
        hasEmail: false,
        expressedInterest: false,
        hasBudget: null,
        hasTimeline: null,
        respondedToFollowup: false,
        previousPatient: true,
      })

      expect(previousPatientResult.score).toBeGreaterThan(newPatientResult.score)
    })
  })

  describe('getTemperatureFromScore', () => {
    it('should return hot for score >= 70', () => {
      expect(getTemperatureFromScore(70)).toBe('hot')
      expect(getTemperatureFromScore(85)).toBe('hot')
      expect(getTemperatureFromScore(100)).toBe('hot')
    })

    it('should return warm for score 40-69', () => {
      expect(getTemperatureFromScore(40)).toBe('warm')
      expect(getTemperatureFromScore(50)).toBe('warm')
      expect(getTemperatureFromScore(69)).toBe('warm')
    })

    it('should return cold for score < 40', () => {
      expect(getTemperatureFromScore(0)).toBe('cold')
      expect(getTemperatureFromScore(20)).toBe('cold')
      expect(getTemperatureFromScore(39)).toBe('cold')
    })
  })

  describe('createLead', () => {
    it('should create lead with auto-calculated score', async () => {
      const mockLead = {
        id: 'lead-1',
        name: 'João Silva',
        phone: '11999999999',
        source: 'instagram',
        score: 25,
        temperature: 'cold',
        status: 'new',
      }

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockLead,
              error: null,
            }),
          }),
        }),
      })

      const result = await createLead({
        clinicId,
        name: 'João Silva',
        phone: '11999999999',
        source: 'instagram',
      })

      expect(result).not.toBeNull()
      expect(result?.name).toBe('João Silva')
      expect(result?.score).toBeDefined()
      expect(result?.temperature).toBe('cold')
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      })

      const result = await createLead({
        clinicId,
        name: 'João Silva',
        phone: '11999999999',
        source: 'instagram',
      })

      expect(result).toBeNull()
    })
  })

  describe('getLeads', () => {
    it('should fetch leads with filters', async () => {
      const mockLeads = [
        { id: 'lead-1', name: 'João Silva', status: 'new', score: 30 },
        { id: 'lead-2', name: 'Maria Santos', status: 'contacted', score: 50 },
      ]

      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: mockLeads,
          error: null,
          count: 2,
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery),
      })

      const result = await getLeads({
        clinicId,
        status: 'new',
      })

      expect(result.leads).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('should return empty array on error', async () => {
      const mockQuery = {
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
          count: 0,
        }),
      }

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue(mockQuery),
      })

      const result = await getLeads({ clinicId })

      expect(result.leads).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('updateLeadStatus', () => {
    it('should update lead status', async () => {
      const mockUpdatedLead = {
        id: 'lead-1',
        status: 'contacted',
        notes: 'Called patient',
      }

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedLead,
                error: null,
              }),
            }),
          }),
        }),
      })

      const result = await updateLeadStatus('lead-1', 'contacted', 'Called patient')

      expect(result).not.toBeNull()
      expect(result?.status).toBe('contacted')
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      })

      const result = await updateLeadStatus('nonexistent', 'contacted')

      expect(result).toBeNull()
    })
  })

  describe('qualifyLead', () => {
    it('should qualify lead with BANT criteria', async () => {
      const mockLead = {
        id: 'lead-1',
        source: 'referral',
        phone: '11999999999',
        email: 'joao@example.com',
        interest: 'implante',
        patient_id: null,
        status: 'new',
      }

      // Mock fetch lead
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockLead,
                error: null,
              }),
            }),
          }),
        })
        // Mock update lead
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })

      const result = await qualifyLead('lead-1', {
        hasBudget: true,
        hasTimeline: true,
        interest: 'Alto',
      })

      expect(result).not.toBeNull()
      expect(result?.score).toBeGreaterThan(50)
      expect(result?.next_steps).toBeDefined()
    })

    it('should return null if lead not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Not found' },
            }),
          }),
        }),
      })

      const result = await qualifyLead('nonexistent', { hasBudget: true })

      expect(result).toBeNull()
    })
  })

  describe('getHotLeads', () => {
    it('should return leads with hot temperature', async () => {
      const mockHotLeads = [
        { id: 'lead-1', name: 'João Silva', temperature: 'hot', score: 80 },
        { id: 'lead-2', name: 'Maria Santos', temperature: 'hot', score: 75 },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: mockHotLeads,
            error: null,
          }),
        }),
      })

      const result = await getHotLeads(clinicId, 10)

      expect(result).toHaveLength(2)
      expect(result[0].temperature).toBe('hot')
    })

    it('should return empty array on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      const result = await getHotLeads(clinicId, 10)

      expect(result).toEqual([])
    })
  })

  describe('convertLeadToPatient', () => {
    it('should convert lead to patient and return true', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })

      const result = await convertLeadToPatient('lead-1', 'patient-1')

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { message: 'Database error' },
          }),
        }),
      })

      const result = await convertLeadToPatient('lead-1', 'patient-1')

      expect(result).toBe(false)
    })
  })

  describe('getLeadStats', () => {
    it('should calculate lead statistics correctly', async () => {
      const mockLeads = [
        { id: '1', status: 'new', temperature: 'cold', score: 20 },
        { id: '2', status: 'new', temperature: 'warm', score: 50 },
        { id: '3', status: 'contacted', temperature: 'warm', score: 45 },
        { id: '4', status: 'qualified', temperature: 'hot', score: 80 },
        { id: '5', status: 'qualified', temperature: 'hot', score: 75 },
        { id: '6', status: 'converted', temperature: 'hot', score: 90 },
        { id: '7', status: 'lost', temperature: 'cold', score: 15 },
      ]

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: mockLeads,
            error: null,
          }),
        }),
      })

      const stats = await getLeadStats(clinicId)

      expect(stats.total).toBe(7)
      expect(stats.byStatus.new).toBe(2)
      expect(stats.byStatus.contacted).toBe(1)
      expect(stats.byStatus.qualified).toBe(2)
      expect(stats.byStatus.converted).toBe(1)
      expect(stats.byStatus.lost).toBe(1)
      expect(stats.byTemperature.hot).toBe(3)
      expect(stats.conversionRate).toBe(14) // 1/7 = ~14%
    })

    it('should return zeros on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' },
          }),
        }),
      })

      const stats = await getLeadStats(clinicId)

      expect(stats.total).toBe(0)
      expect(stats.byStatus.new).toBe(0)
      expect(stats.avgScore).toBe(0)
    })
  })
})