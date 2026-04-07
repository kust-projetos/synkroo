/**
 * Risk Scoring Service
 * Evaluates agent actions before execution and determines confirmation requirements
 */

import { dbLogger } from '@/lib/logger'

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

const ACTION_RISK_SCORES: Record<string, number> = {
  check_availability: 10,
  answer_faq: 15,
  book_appointment: 45,
  confirm_appointment: 35,
  reschedule_appointment: 55,
  cancel_appointment: 75,
  update_patient_data: 40,
  send_document: 50,
  answer_medical_question: 55,
  unknown: 50,
}

const ACTION_DESCRIPTIONS: Record<string, string> = {
  cancel_appointment: 'cancelar esta consulta',
  book_appointment: 'agendar esta consulta',
  reschedule_appointment: 'remarcar esta consulta',
  update_patient_data: 'atualizar estes dados',
}

export interface RiskContext {
  isFirstInteraction?: boolean
  patientHistoryCount?: number
  appointmentProximityHours?: number
  hasPendingActions?: boolean
  escalationHistory?: number
}

export interface RiskAssessment {
  action: string
  baseScore: number
  adjustedScore: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  confirmationRequired: 'none' | 'simple' | 'double'
  reasoning: string
  undoWindowMinutes: number
}

export class RiskScoringService {
  private readonly DEFAULT_UNDO_WINDOWS: Record<RiskLevel, number> = {
    [RiskLevel.LOW]: 0,
    [RiskLevel.MEDIUM]: 5,
    [RiskLevel.HIGH]: 10,
  }

  assessRisk(action: string, context?: RiskContext): RiskAssessment {
    const baseScore = ACTION_RISK_SCORES[action] ?? ACTION_RISK_SCORES.unknown
    const adjustments = this.calculateAdjustments(action, context)
    const adjustedScore = Math.min(100, Math.max(0, baseScore + adjustments.total))
    const riskLevel = this.classifyRisk(adjustedScore)

    const assessment: RiskAssessment = {
      action,
      baseScore,
      adjustedScore,
      riskLevel,
      confirmationRequired: this.getConfirmationType(riskLevel),
      reasoning: adjustments.reasons.join('; ') || 'Nenhum modificador de risco aplicado',
      undoWindowMinutes: this.DEFAULT_UNDO_WINDOWS[riskLevel],
    }

    dbLogger.info('Risk assessment completed', {
      action,
      baseScore,
      adjustedScore,
      riskLevel,
      confirmationRequired: assessment.confirmationRequired,
    })

    return assessment
  }

  getConfirmationPrompt(action: string, riskLevel: string): string {
    if (riskLevel === RiskLevel.LOW) return ''
    const description = ACTION_DESCRIPTIONS[action] ?? 'realizar esta ação'
    return `Você confirma ${description}? (Sim/Não)`
  }

  getDoubleConfirmationPrompt(action: string): string {
    const description = ACTION_DESCRIPTIONS[action] ?? 'realizar esta ação'
    return `Tem certeza que deseja ${description}? Esta ação não poderá ser desfeita facilmente. Digite CONFIRMAR para prosseguir.`
  }

  shouldAutoExecute(riskLevel: string): boolean {
    return riskLevel === RiskLevel.LOW
  }

  shouldLogDecision(_riskLevel: string): boolean {
    return true
  }

  private calculateAdjustments(
    action: string,
    context?: RiskContext
  ): { total: number; reasons: string[] } {
    if (!context) return { total: 0, reasons: [] }

    let total = 0
    const reasons: string[] = []

    if (context.isFirstInteraction) {
      total += 15
      reasons.push('Primeira interação (+15)')
    }

    if (context.patientHistoryCount && context.patientHistoryCount > 5) {
      total -= 10
      reasons.push('Paciente recorrente (-10)')
    }

    if (context.appointmentProximityHours !== undefined && context.appointmentProximityHours < 24) {
      total += 20
      reasons.push(`Consulta em ${context.appointmentProximityHours}h (+20)`)
    }

    if (context.hasPendingActions) {
      total += 10
      reasons.push('Ações pendentes (+10)')
    }

    if (context.escalationHistory && context.escalationHistory > 0) {
      const escalationBonus = Math.min(context.escalationHistory * 5, 20)
      total += escalationBonus
      reasons.push(`Histórico de escalação (+${escalationBonus})`)
    }

    return { total, reasons }
  }

  private classifyRisk(score: number): RiskLevel {
    if (score <= 30) return RiskLevel.LOW
    if (score <= 60) return RiskLevel.MEDIUM
    return RiskLevel.HIGH
  }

  private getConfirmationType(
    riskLevel: RiskLevel
  ): 'none' | 'simple' | 'double' {
    switch (riskLevel) {
      case RiskLevel.LOW:
        return 'none'
      case RiskLevel.MEDIUM:
        return 'simple'
      case RiskLevel.HIGH:
        return 'double'
    }
  }
}

export const riskScoringService = new RiskScoringService()
