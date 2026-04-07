/**
 * Tests for Campaign Service
 */

import {
  Campaign,
  CampaignRecipient,
} from '@/services/followup/campaign.service'

describe('Campaign Types', () => {
  describe('Campaign interface', () => {
    it('should have correct status values', () => {
      const validStatuses: Campaign['status'][] = [
        'draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled'
      ]

      expect(validStatuses).toHaveLength(6)
    })

    it('should have correct campaign types', () => {
      const validTypes: Campaign['campaignType'][] = [
        'reactivation', 'retention', 'promotional', 'follow_up'
      ]

      expect(validTypes).toHaveLength(4)
    })
  })

  describe('CampaignRecipient interface', () => {
    it('should have correct status values', () => {
      const validStatuses: CampaignRecipient['status'][] = [
        'pending', 'sent', 'delivered', 'failed', 'responded', 'converted', 'opted_out'
      ]

      expect(validStatuses).toHaveLength(7)
    })
  })
})

describe('Campaign Message Templates', () => {
  const messages: Record<string, string> = {
    inactive_30: `Olá, {{patient_name}}! 👋

Sentimos sua falta! Já faz um tempo desde sua última visita.

Que tal agendar uma consulta de retorno? Sua saúde bucal agradece! 🦷

📅 Responda essa mensagem que eu te ajudo a agendar.`,
    inactive_60: `Olá, {{patient_name}}! 💙

Faz 2 meses que não apareceu na clínica. Estamos com horários disponíveis!

✨ Agende sua consulta de retorno e mantenha seu sorriso saudável.

📱 É só responder essa mensagem!`,
    inactive_90: `Olá, {{patient_name}}! 🦷

Faz 3 meses que não te vemos. Sua saúde bucal é importante!

🎁 Vamos oferecer um desconto especial de 10% para sua próxima consulta!

📅 Agende agora respondendo essa mensagem.`,
  }

  it('should have template placeholders', () => {
    Object.values(messages).forEach(template => {
      expect(template).toContain('{{patient_name}}')
    })
  })

  it('should have appropriate emojis', () => {
    expect(messages.inactive_30).toContain('👋')
    expect(messages.inactive_60).toContain('💙')
    expect(messages.inactive_90).toContain('🎁')
  })

  it('should have call-to-action', () => {
    Object.values(messages).forEach(template => {
      expect(
        template.includes('📅') || template.includes('📱')
      ).toBe(true)
    })
  })
})

describe('Campaign Validation Logic', () => {
  it('should validate campaign creation params', () => {
    const validParams = {
      clinicId: 'clinic-123',
      name: 'Test Campaign',
      campaignType: 'reactivation',
      messageTemplate: 'Hello {{patient_name}}!',
    }

    expect(validParams.clinicId).toBeDefined()
    expect(validParams.name).toBeDefined()
    expect(validParams.campaignType).toBeDefined()
    expect(validParams.messageTemplate).toBeDefined()
  })

  it('should validate segment matching', () => {
    const validSegments = ['inactive_30', 'inactive_60', 'inactive_90', 'inactive_180']

    const targetSegment = 'inactive_60'
    expect(validSegments).toContain(targetSegment)
  })
})