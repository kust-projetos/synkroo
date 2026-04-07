/**
 * Tests for Follow-up Service
 */

import {
  formatFollowUpMessage,
} from '@/services/followup/followup.service'

// Import parsing functions from scheduler service where they're defined
import { parseNaturalDate, parseTime } from '@/services/scheduler/scheduler.service'

// Mock the Supabase client
jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(() => Promise.resolve({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
    })),
  })),
}))

// Mock the logger
jest.mock('@/lib/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
  whatsappLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('Follow-up Service', () => {
  describe('formatFollowUpMessage', () => {
    const mockPatient = {
      patientId: '123',
      patientName: 'João Silva',
      patientPhone: '11999999999',
      clinicId: 'clinic-1',
      clinicName: 'Clínica Sorriso',
      clinicPhone: '1133333333',
      completedAt: new Date(),
    }

    const mockConfig = {
      id: 'config-1',
      clinicId: 'clinic-1',
      configType: 'post_consultation' as const,
      messageTemplate: `Olá, {{patient_name}}! 👋

Sua consulta hoje foi registrada com sucesso.

{{procedure_guidelines}}

Como foi sua experiência? De 1 a 5, que nota você daria para o atendimento? 💙`,
    }

    it('should replace all placeholders correctly', () => {
      const guidelines = {
        id: 'g1',
        clinicId: 'clinic-1',
        procedureName: 'Limpeza',
        title: 'Cuidados',
        instructions: 'Evite alimentos quentes por 24h.',
        emergencyContact: false,
      }

      const result = formatFollowUpMessage(mockPatient, mockConfig, guidelines)

      expect(result).toContain('Olá, João Silva!')
      expect(result).toContain('Evite alimentos quentes por 24h.')
      expect(result).not.toContain('{{patient_name}}')
      expect(result).not.toContain('{{procedure_guidelines}}')
    })

    it('should handle missing guidelines', () => {
      const result = formatFollowUpMessage(mockPatient, mockConfig, null)

      expect(result).toContain('Olá, João Silva!')
      expect(result).toContain('Cuide bem da sua saúde bucal!')
    })

    it('should handle procedure name placeholder', () => {
      const configWithProcedure = {
        ...mockConfig,
        messageTemplate: 'Sua {{procedure_name}} foi realizada com sucesso, {{patient_name}}!',
      }

      const patientWithProcedure = {
        ...mockPatient,
        procedureName: 'Limpeza',
      }

      const result = formatFollowUpMessage(patientWithProcedure, configWithProcedure, null)

      expect(result).toContain('Sua Limpeza foi realizada com sucesso, João Silva!')
    })
  })
})

// Additional tests for core functions would go here
// These require mocking Supabase and other dependencies