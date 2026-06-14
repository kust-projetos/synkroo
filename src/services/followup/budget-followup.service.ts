/**
 * Budget Follow-up Service
 * Tracks unconverted budgets and sends staged follow-ups via notes
 */

import { eq, inArray, desc, and, asc } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { budgets, patients } from '@/lib/db/schema'
import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export interface UnconvertedBudget {
  id: string
  patient_id: string
  patient_name: string
  patient_phone: string | null
  clinic_id: string
  total_value: number
  created_at: string
  days_since_created: number
  followup_stage: number
  status: string
}

const FOLLOWUP_STAGES = [
  { day: 7, message: 'Olá! Tudo bem? Gostaria de saber se teve oportunidade de avaliar o orçamento que enviamos. Podemos ajustar se necessário!' },
  { day: 14, message: 'Oi! Estamos passando para saber se ainda tem interesse no tratamento. Temos condições especiais de pagamento que podem ajudar!' },
]

/**
 * Find budgets that haven't been converted within expected timeframe — Drizzle.
 */
export async function findUnconvertedBudgets(clinicId: string): Promise<UnconvertedBudget[]> {
  const db = getDb()

  try {
    const rows = await db
      .select()
      .from(budgets)
      .leftJoin(patients, eq(budgets.patientId, patients.id))
      .where(
        and(
          eq(budgets.clinicId, clinicId),
          inArray(budgets.status, ['sent', 'pending']),
        ),
      )
      .orderBy(asc(budgets.createdAt))

    const now = new Date()
    const results: UnconvertedBudget[] = []

    for (const row of rows) {
      const budget = row.budgets
      const patient = row.patients
      const createdDate = budget.createdAt ?? new Date()
      const daysSinceCreated = Math.floor(
        (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      const notes: string = budget.notes || ''
      let followupStage = 0
      const stageMatch = notes.match(/\[followup-stage-(\d+)-date/)
      if (stageMatch) followupStage = parseInt(stageMatch[1], 10)

      if (daysSinceCreated >= FOLLOWUP_STAGES[0].day) {
        results.push({
          id: budget.id,
          patient_id: budget.patientId,
          patient_name: patient?.name || 'Desconhecido',
          patient_phone: patient?.phone || null,
          clinic_id: budget.clinicId,
          total_value: Number(budget.totalValue),
          created_at: createdDate.toISOString(),
          days_since_created: daysSinceCreated,
          followup_stage: followupStage,
          status: budget.status || '',
        })
      }
    }

    return results.sort((a, b) => b.days_since_created - a.days_since_created)
  } catch (error) {
    dbLogger.error('Error finding unconverted budgets', error)
    return []
  }
}

/**
 * Send a follow-up for a specific budget
 * Records the follow-up stage in budget notes
 */
export async function sendBudgetFollowup(
  budgetId: string,
  clinicId: string
): Promise<{ success: boolean; message?: string; stage?: number }> {
  const supabase = await createTypedClient()

  try {
    // Fetch budget with patient info
    const { data: budget, error: fetchError } = await supabase
      .from('budgets')
      .select('id, patient_id, notes, patients (name, phone)')
      .eq('id', budgetId)
      .eq('clinic_id', clinicId)
      .single() as any

    if (fetchError || !budget) {
      return { success: false, message: 'Budget not found' }
    }

    const patient = (budget as any).patients
    if (!patient?.phone) {
      return { success: false, message: 'Patient has no phone number' }
    }

    // Parse current stage from notes
    const notes: string = (budget as any).notes || ''
    let currentStage = 0
    const stageMatch = notes.match(/\[followup-stage-(\d+)-date/)
    if (stageMatch) {
      currentStage = parseInt(stageMatch[1], 10)
    }

    // Determine next stage
    const nextStage = currentStage + 1
    if (nextStage > FOLLOWUP_STAGES.length) {
      return { success: false, message: 'All follow-up stages completed' }
    }

    const stageConfig = FOLLOWUP_STAGES[nextStage - 1]
    const personalMessage = stageConfig.message

    // Update budget notes with follow-up marker
    const stageMarker = `[followup-stage-${nextStage}-date: ${new Date().toISOString().split('T')[0]}]`
    const updatedNotes = notes ? `${notes}\n${stageMarker}` : stageMarker

    const { error: updateError } = await (supabase
      .from('budgets') as any)
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', budgetId)

    if (updateError) throw updateError

    dbLogger.info('Budget follow-up sent', {
      budgetId,
      stage: nextStage,
      patientName: (patient as any).name,
    })

    return {
      success: true,
      message: personalMessage,
      stage: nextStage,
    }
  } catch (error) {
    dbLogger.error('Error sending budget follow-up', error, { budgetId })
    return { success: false, message: 'Internal error' }
  }
}

/**
 * Process all pending follow-ups for a clinic
 * Called by cron job or manual trigger
 */
export async function processBudgetFollowups(
  clinicId: string
): Promise<{ processed: number; errors: number }> {
  const unconverted = await findUnconvertedBudgets(clinicId)

  let processed = 0
  let errors = 0

  for (const budget of unconverted) {
    // Check if budget is due for next follow-up
    const nextStage = budget.followup_stage + 1
    if (nextStage > FOLLOWUP_STAGES.length) continue

    const stageConfig = FOLLOWUP_STAGES[nextStage - 1]
    if (budget.days_since_created < stageConfig.day) continue

    const result = await sendBudgetFollowup(budget.id, clinicId)
    if (result.success) {
      processed++
    } else {
      errors++
    }
  }

  dbLogger.info('Budget follow-ups processed', {
    clinicId,
    processed,
    errors,
    totalUnconverted: unconverted.length,
  })

  return { processed, errors }
}
