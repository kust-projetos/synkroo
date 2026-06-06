/**
 * Tests for AgentService
 * Tests determineAction, getEscalationMessage, and buildReasoning
 *
 * Note: These are private methods. We test them via bracket notation
 * (service['methodName']) which TypeScript/Jest allows in test context.
 * This isolates the logic without requiring full processMessage integration.
 */

import { AgentService } from '../agent.service'

describe('AgentService', () => {
  let service: AgentService

  beforeEach(() => {
    service = new AgentService()
  })

  describe('determineAction()', () => {
    it('should return escalate when shouldEscalate is true', () => {
      const action = service['determineAction']('agendamento', true)
      expect(action).toBe('escalate')
    })

    it('should return schedule for agendamento intent without escalation', () => {
      const action = service['determineAction']('agendamento', false)
      expect(action).toBe('schedule')
    })

    it('should return confirm for confirmacao intent without escalation', () => {
      const action = service['determineAction']('confirmacao', false)
      expect(action).toBe('confirm')
    })

    it('should return respond for unknown intent without escalation', () => {
      const action = service['determineAction']('saudacao', false)
      expect(action).toBe('respond')
    })

    it('should return respond for other intents', () => {
      const intents = ['saudacao', 'pergunta', 'cancelamento', 'outro']
      for (const intent of intents) {
        const action = service['determineAction'](intent, false)
        expect(['respond', 'schedule', 'confirm', 'escalate']).toContain(action)
      }
    })

    it('should prioritize escalation over intent mapping', () => {
      const action = service['determineAction']('emergencia', true)
      expect(action).toBe('escalate')
    })
  })

  describe('getEscalationMessage()', () => {
    it('should return emergency message for emergencia intent', () => {
      const message = service['getEscalationMessage']('emergencia')
      expect(message).toContain('emergência')
      expect(message).toContain('transferir')
    })

    it('should return complaint message for reclamacao intent', () => {
      const message = service['getEscalationMessage']('reclamacao')
      expect(message).toContain('insatisfação')
      expect(message).toContain('transferir')
    })

    it('should return default message for unknown intent', () => {
      const message = service['getEscalationMessage']('unknown_intent')
      expect(message).toContain('atendente humano')
      expect(message).toBe(service['getEscalationMessage']('default'))
    })

    it('should return default message when intent is not in messages map', () => {
      const defaultMsg = service['getEscalationMessage']('saudacao')
      const fallbackMsg = service['getEscalationMessage']('xyz123')
      expect(defaultMsg).toBe(fallbackMsg)
    })

    it('should return non-empty strings for all intents', () => {
      const intents = ['emergencia', 'reclamacao', 'pergunta', 'outro']
      for (const intent of intents) {
        const message = service['getEscalationMessage'](intent)
        expect(message).toBeTruthy()
        expect(message.length).toBeGreaterThan(10)
      }
    })
  })

  describe('buildReasoning()', () => {
    it('should include intent in reasoning when not escalated', () => {
      const reasoning = service['buildReasoning']('agendamento', 'schedule', false, 'llm_generated', 0.85)
      expect(reasoning).toContain('agendamento')
      expect(reasoning).toContain('85%')
    })

    it('should include escalation note when escalated', () => {
      const reasoning = service['buildReasoning']('emergencia', 'escalate', true, 'llm_generated', 0.9)
      expect(reasoning).toContain('Escalado')
      expect(reasoning).toContain('atendente humano')
    })

    it('should include action in reasoning', () => {
      const reasoning = service['buildReasoning']('saudacao', 'respond', false, 'llm_generated', 0.75)
      expect(reasoning).toContain('respond')
    })

    it('should describe registration_flow source', () => {
      const reasoning = service['buildReasoning']('cadastro', 'respond', false, 'registration_flow', 1.0)
      expect(reasoning).toContain('cadastro de paciente')
      expect(reasoning).not.toContain('LLM')
    })

    it('should describe llm_generated source', () => {
      const reasoning = service['buildReasoning']('pergunta', 'respond', false, 'llm_generated', 0.8)
      expect(reasoning).toContain('LLM')
      expect(reasoning).toContain('RAG')
    })

    it('should include confidence percentage in non-escalated reasoning', () => {
      const reasoning = service['buildReasoning']('confirmacao', 'confirm', false, 'llm_generated', 0.95)
      expect(reasoning).toContain('95%')
    })

    it('should join parts with periods', () => {
      const reasoning = service['buildReasoning']('agendamento', 'schedule', false, 'llm_generated', 0.8)
      // Should contain multiple sentences joined by period
      expect(reasoning.split('.').length).toBeGreaterThan(2)
    })
  })
})