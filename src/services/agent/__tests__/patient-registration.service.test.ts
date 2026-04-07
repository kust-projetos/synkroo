/**
 * Tests for Patient Registration Service
 * Covers extractNameFromMessage, extractEmail (pure) + DB-dependent flows
 */

import {
  extractNameFromMessage,
  extractEmail,
  findPatientByPhone,
  createMinimalPatient,
  processRegistrationFlow,
} from '../patient-registration.service'

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

describe('Patient Registration Service', () => {
  describe('extractNameFromMessage (pure)', () => {
    it('should extract name after "Meu nome é"', () => {
      expect(extractNameFromMessage('Meu nome é João Silva')).toBe('João Silva')
    })

    it('should extract name after "Me chamo"', () => {
      expect(extractNameFromMessage('Me chamo Maria Santos')).toBe('Maria Santos')
    })

    it('should extract name after "Sou a"', () => {
      expect(extractNameFromMessage('Sou a Ana Paula')).toBe('Ana Paula')
    })

    it('should extract name after "Sou o"', () => {
      expect(extractNameFromMessage('Sou o Pedro Henrique')).toBe('Pedro Henrique')
    })

    it('should extract name after greeting + name', () => {
      const result = extractNameFromMessage('Olá João da Silva')
      expect(result).toBe('João da Silva')
    })

    it('should return null for messages without names', () => {
      expect(extractNameFromMessage('Quero agendar uma consulta')).toBeNull()
    })

    it('should extract clean name even with trailing numbers', () => {
      // Regex captures the name portion before numbers
      const result = extractNameFromMessage('Meu nome é João123')
      expect(result).toBe('João')
    })

    it('should return null for very short names', () => {
      expect(extractNameFromMessage('Meu nome é A')).toBeNull()
    })

    it('should handle accented characters', () => {
      expect(extractNameFromMessage('Meu nome é José Cunhã')).toBe('José Cunhã')
    })

    it('should handle "Me chama de" pattern', () => {
      expect(extractNameFromMessage('Me chama de Lucas Ferreira')).toBe('Lucas Ferreira')
    })
  })

  describe('extractEmail (pure)', () => {
    it('should extract standard email', () => {
      expect(extractEmail('Meu email é joao@email.com')).toBe('joao@email.com')
    })

    it('should extract email with dots', () => {
      expect(extractEmail('maria.silva@gmail.com')).toBe('maria.silva@gmail.com')
    })

    it('should extract email with hyphens', () => {
      expect(extractEmail('Contato: user-name@test-domain.com')).toBe('user-name@test-domain.com')
    })

    it('should return null for messages without email', () => {
      expect(extractEmail('Não tenho email')).toBeNull()
    })

    it('should return null for invalid format', () => {
      expect(extractEmail('@semusuario.com')).toBeNull()
    })
  })

  describe('findPatientByPhone', () => {
    it('should return patient when found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [{ id: 'p1', name: 'João' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const result = await findPatientByPhone('11999999999', 'c1')
      expect(result).toEqual({ id: 'p1', name: 'João' })
    })

    it('should return null when not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      })

      const result = await findPatientByPhone('11999999999', 'c1')
      expect(result).toBeNull()
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'DB error' },
                }),
              }),
            }),
          }),
        }),
      })

      const result = await findPatientByPhone('11999999999', 'c1')
      expect(result).toBeNull()
    })
  })

  describe('processRegistrationFlow', () => {
    it('should return existing patient when found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [{ id: 'p1', name: 'João' }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      })

      const result = await processRegistrationFlow({
        phone: '11999999999',
        clinicId: 'c1',
        message: 'Olá',
        conversationId: 'conv-1',
      })

      expect(result.isNewPatient).toBe(false)
      expect(result.patientId).toBe('p1')
      expect(result.nextAction).toBe('none')
    })

    it('should ask name when no name in message and new patient', async () => {
      // findPatientByPhone returns empty
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      })

      const result = await processRegistrationFlow({
        phone: '11999999999',
        clinicId: 'c1',
        message: 'Oi, quero agendar',
        conversationId: 'conv-1',
      })

      expect(result.isNewPatient).toBe(true)
      expect(result.nextAction).toBe('ask_name')
      expect(result.suggestedReply).toContain('nome')
    })

    it('should create patient and ask confirmation when name detected', async () => {
      // findPatientByPhone returns empty
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        })
        // createMinimalPatient
        .mockReturnValueOnce({
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'new-1', name: 'Maria Santos' },
                error: null,
              }),
            }),
          }),
        })

      const result = await processRegistrationFlow({
        phone: '11999999999',
        clinicId: 'c1',
        message: 'Meu nome é Maria Santos',
        conversationId: 'conv-1',
      })

      expect(result.isNewPatient).toBe(true)
      expect(result.patientName).toBe('Maria Santos')
      expect(result.nextAction).toBe('confirm_name')
    })
  })
})
