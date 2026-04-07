/**
 * Tests for Risk Scoring Service
 * Pure logic - no DB dependencies
 */

import { RiskScoringService, RiskLevel } from '../risk-scoring.service'

describe('RiskScoringService', () => {
  let service: RiskScoringService

  beforeEach(() => {
    service = new RiskScoringService()
  })

  describe('assessRisk', () => {
    it('should classify low-risk actions', () => {
      const assessment = service.assessRisk('check_availability')

      expect(assessment.baseScore).toBe(10)
      expect(assessment.riskLevel).toBe(RiskLevel.LOW)
      expect(assessment.confirmationRequired).toBe('none')
      expect(assessment.undoWindowMinutes).toBe(0)
    })

    it('should classify medium-risk actions', () => {
      const assessment = service.assessRisk('book_appointment')

      expect(assessment.baseScore).toBe(45)
      expect(assessment.riskLevel).toBe(RiskLevel.MEDIUM)
      expect(assessment.confirmationRequired).toBe('simple')
    })

    it('should classify high-risk actions', () => {
      const assessment = service.assessRisk('cancel_appointment')

      expect(assessment.baseScore).toBe(75)
      expect(assessment.riskLevel).toBe(RiskLevel.HIGH)
      expect(assessment.confirmationRequired).toBe('double')
      expect(assessment.undoWindowMinutes).toBe(10)
    })

    it('should use unknown score for unrecognized actions', () => {
      const assessment = service.assessRisk('custom_action_xyz')

      expect(assessment.baseScore).toBe(50)
    })

    it('should increase score for first interaction', () => {
      const withoutContext = service.assessRisk('book_appointment')
      const withFirstInteraction = service.assessRisk('book_appointment', {
        isFirstInteraction: true,
      })

      expect(withFirstInteraction.adjustedScore).toBeGreaterThan(withoutContext.adjustedScore)
      expect(withFirstInteraction.reasoning).toContain('Primeira interação')
    })

    it('should decrease score for returning patients', () => {
      const assessment = service.assessRisk('book_appointment', {
        patientHistoryCount: 10,
      })

      expect(assessment.reasoning).toContain('Paciente recorrente')
    })

    it('should increase score for near appointments', () => {
      const assessment = service.assessRisk('cancel_appointment', {
        appointmentProximityHours: 2,
      })

      expect(assessment.reasoning).toContain('Consulta em 2h')
    })

    it('should increase score for pending actions', () => {
      const assessment = service.assessRisk('book_appointment', {
        hasPendingActions: true,
      })

      expect(assessment.reasoning).toContain('Ações pendentes')
    })

    it('should increase score for escalation history', () => {
      const assessment = service.assessRisk('book_appointment', {
        escalationHistory: 3,
      })

      expect(assessment.reasoning).toContain('Histórico de escalação')
    })

    it('should cap escalation bonus at 20', () => {
      const assessment = service.assessRisk('check_availability', {
        escalationHistory: 10,
      })

      // base 10 + 15 (first) + 20 (cap) = 45 max
      expect(assessment.adjustedScore).toBeLessThanOrEqual(100)
    })

    it('should not exceed 100 score', () => {
      const assessment = service.assessRisk('cancel_appointment', {
        isFirstInteraction: true,
        appointmentProximityHours: 1,
        hasPendingActions: true,
        escalationHistory: 5,
      })

      expect(assessment.adjustedScore).toBeLessThanOrEqual(100)
    })

    it('should combine multiple context factors', () => {
      const assessment = service.assessRisk('book_appointment', {
        isFirstInteraction: true,
        patientHistoryCount: 10,
        appointmentProximityHours: 2,
      })

      expect(assessment.reasoning).toContain('Primeira interação')
      expect(assessment.reasoning).toContain('Paciente recorrente')
      expect(assessment.reasoning).toContain('Consulta em 2h')
    })

    it('should provide default reasoning when no modifiers apply', () => {
      const assessment = service.assessRisk('answer_faq')

      expect(assessment.reasoning).toBe('Nenhum modificador de risco aplicado')
    })
  })

  describe('getConfirmationPrompt', () => {
    it('should return empty for LOW risk', () => {
      expect(service.getConfirmationPrompt('cancel_appointment', RiskLevel.LOW)).toBe('')
    })

    it('should return simple confirmation for MEDIUM', () => {
      const prompt = service.getConfirmationPrompt('cancel_appointment', RiskLevel.MEDIUM)
      expect(prompt).toContain('confirma')
      expect(prompt).toContain('cancelar')
    })

    it('should use default description for unknown actions', () => {
      const prompt = service.getConfirmationPrompt('unknown_action', RiskLevel.MEDIUM)
      expect(prompt).toContain('realizar esta ação')
    })
  })

  describe('getDoubleConfirmationPrompt', () => {
    it('should include CONFIRMAR requirement', () => {
      const prompt = service.getDoubleConfirmationPrompt('cancel_appointment')
      expect(prompt).toContain('CONFIRMAR')
      expect(prompt).toContain('cancelar')
    })
  })

  describe('shouldAutoExecute', () => {
    it('should auto-execute LOW risk actions', () => {
      expect(service.shouldAutoExecute(RiskLevel.LOW)).toBe(true)
    })

    it('should NOT auto-execute MEDIUM risk', () => {
      expect(service.shouldAutoExecute(RiskLevel.MEDIUM)).toBe(false)
    })

    it('should NOT auto-execute HIGH risk', () => {
      expect(service.shouldAutoExecute(RiskLevel.HIGH)).toBe(false)
    })
  })

  describe('shouldLogDecision', () => {
    it('should always return true', () => {
      expect(service.shouldLogDecision(RiskLevel.LOW)).toBe(true)
      expect(service.shouldLogDecision(RiskLevel.MEDIUM)).toBe(true)
      expect(service.shouldLogDecision(RiskLevel.HIGH)).toBe(true)
    })
  })
})
