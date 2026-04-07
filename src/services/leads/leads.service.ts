/**
 * Leads Service
 * Manages lead capture, scoring, qualification, and pipeline for sales conversion
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export type LeadSource = 'whatsapp' | 'instagram' | 'web' | 'referral' | 'campaign' | 'other'
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'converted' | 'lost'
export type LeadTemperature = 'cold' | 'warm' | 'hot'

export interface Lead {
  id: string
  clinic_id: string
  patient_id: string | null
  name: string
  phone: string
  email: string | null
  source: LeadSource
  status: LeadStatus
  temperature: LeadTemperature
  score: number // 0-100
  interest: string | null // procedure they're interested in
  notes: string | null
  assigned_to: string | null // user/dentist assigned
  last_contact_at: string | null
  next_followup_at: string | null
  converted_at: string | null
  lost_reason: string | null
  created_at: string
  updated_at: string
}

export interface LeadScore {
  score: number
  factors: ScoreFactor[]
  recommendation: string
}

export interface ScoreFactor {
  name: string
  points: number
  description: string
}

export interface LeadQualification {
  is_qualified: boolean
  temperature: LeadTemperature
  score: number
  missing_info: string[]
  next_steps: string[]
}

/**
 * Calculate lead score based on various factors
 */
export function calculateLeadScore(params: {
  source: LeadSource
  hasPhone: boolean
  hasEmail: boolean
  expressedInterest: boolean
  hasBudget: boolean | null
  hasTimeline: boolean | null
  respondedToFollowup: boolean
  previousPatient: boolean
}): LeadScore {
  const factors: ScoreFactor[] = []
  let totalScore = 0

  // Source scoring (max 20 points)
  const sourceScores: Record<LeadSource, number> = {
    whatsapp: 18, // Direct messaging, high intent
    instagram: 15,
    web: 12,
    referral: 20, // Best source
    campaign: 10,
    other: 5,
  }
  factors.push({
    name: 'source',
    points: sourceScores[params.source],
    description: `Origem: ${params.source}`,
  })
  totalScore += sourceScores[params.source]

  // Contact info completeness (max 15 points)
  if (params.hasPhone) {
    factors.push({ name: 'phone', points: 10, description: 'Telefone fornecido' })
    totalScore += 10
  }
  if (params.hasEmail) {
    factors.push({ name: 'email', points: 5, description: 'Email fornecido' })
    totalScore += 5
  }

  // Interest and intent (max 25 points)
  if (params.expressedInterest) {
    factors.push({ name: 'interest', points: 15, description: 'Demonstrou interesse em procedimento' })
    totalScore += 15
  }
  if (params.hasBudget === true) {
    factors.push({ name: 'budget', points: 10, description: 'Orçamento compatível' })
    totalScore += 10
  } else if (params.hasBudget === null) {
    factors.push({ name: 'budget_unknown', points: 5, description: 'Orçamento não informado' })
    totalScore += 5
  }

  // Timeline (max 15 points)
  if (params.hasTimeline === true) {
    factors.push({ name: 'timeline', points: 15, description: 'Tem urgência definida' })
    totalScore += 15
  } else if (params.hasTimeline === null) {
    factors.push({ name: 'timeline_unknown', points: 5, description: 'Timeline não informada' })
    totalScore += 5
  }

  // Engagement (max 15 points)
  if (params.respondedToFollowup) {
    factors.push({ name: 'engagement', points: 15, description: 'Respondeu ao follow-up' })
    totalScore += 15
  }

  // Previous relationship (max 10 points)
  if (params.previousPatient) {
    factors.push({ name: 'previous_patient', points: 10, description: 'Paciente anterior' })
    totalScore += 10
  }

  // Normalize to 0-100
  const normalizedScore = Math.min(totalScore, 100)

  // Generate recommendation
  let recommendation = ''
  if (normalizedScore >= 70) {
    recommendation = 'Lead quente! Priorizar contato imediato e agendar avaliação.'
  } else if (normalizedScore >= 40) {
    recommendation = 'Lead morno. Enviar mais informações e fazer follow-up em 2 dias.'
  } else {
    recommendation = 'Lead frio. Adicionar à sequência de nurturing.'
  }

  return {
    score: normalizedScore,
    factors,
    recommendation,
  }
}

/**
 * Get temperature from score
 */
export function getTemperatureFromScore(score: number): LeadTemperature {
  if (score >= 70) return 'hot'
  if (score >= 40) return 'warm'
  return 'cold'
}

/**
 * Create a new lead
 */
export async function createLead(params: {
  clinicId: string
  name: string
  phone: string
  email?: string
  source: LeadSource
  interest?: string
  patientId?: string
  notes?: string
}): Promise<Lead | null> {
  const supabase = await createTypedClient()

  try {
    // Calculate initial score
    const scoreResult = calculateLeadScore({
      source: params.source,
      hasPhone: !!params.phone,
      hasEmail: !!params.email,
      expressedInterest: !!params.interest,
      hasBudget: null,
      hasTimeline: null,
      respondedToFollowup: false,
      previousPatient: !!params.patientId,
    })

    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        clinic_id: params.clinicId,
        patient_id: params.patientId || null,
        name: params.name,
        phone: params.phone,
        email: params.email || null,
        source: params.source,
        status: 'new',
        temperature: getTemperatureFromScore(scoreResult.score),
        score: scoreResult.score,
        interest: params.interest || null,
        notes: params.notes || null,
      })
      .select()
      .single()

    if (error) throw error

    // Log lead creation
    dbLogger.info('Lead created', {
      leadId: lead.id,
      score: scoreResult.score,
      temperature: getTemperatureFromScore(scoreResult.score),
    })

    return lead as Lead
  } catch (error) {
    dbLogger.error('Error creating lead', error)
    return null
  }
}

/**
 * Get leads for a clinic with filters
 */
export async function getLeads(params: {
  clinicId: string
  status?: LeadStatus
  temperature?: LeadTemperature
  minScore?: number
  assignedTo?: string
  limit?: number
  offset?: number
}): Promise<{ leads: Lead[]; total: number }> {
  const supabase = await createTypedClient()

  try {
    let query = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .eq('clinic_id', params.clinicId)
      .order('score', { ascending: false })

    if (params.status) {
      query = query.eq('status', params.status)
    }
    if (params.temperature) {
      query = query.eq('temperature', params.temperature)
    }
    if (params.minScore !== undefined) {
      query = query.gte('score', params.minScore)
    }
    if (params.assignedTo) {
      query = query.eq('assigned_to', params.assignedTo)
    }

    const limit = params.limit || 50
    const offset = params.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return {
      leads: (data || []) as Lead[],
      total: count || 0,
    }
  } catch (error) {
    dbLogger.error('Error fetching leads', error)
    return { leads: [], total: 0 }
  }
}

/**
 * Update lead status
 */
export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  notes?: string
): Promise<Lead | null> {
  const supabase = await createTypedClient()

  try {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    }

    if (status === 'converted') {
      updateData.converted_at = new Date().toISOString()
    }
    if (notes) {
      updateData.notes = notes
    }

    const { data: lead, error } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single()

    if (error) throw error

    return lead as Lead
  } catch (error) {
    dbLogger.error('Error updating lead status', error)
    return null
  }
}

/**
 * Qualify a lead
 */
export async function qualifyLead(
  leadId: string,
  qualification: {
    hasBudget?: boolean
    hasTimeline?: boolean
    interest?: string
    notes?: string
  }
): Promise<LeadQualification | null> {
  const supabase = await createTypedClient()

  try {
    // Get current lead
    const { data: lead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single()

    if (fetchError || !lead) {
      throw fetchError || new Error('Lead not found')
    }

    const currentLead = lead as Lead
    const previousScore = currentLead.score

    // Recalculate score with new info
    const scoreResult = calculateLeadScore({
      source: currentLead.source,
      hasPhone: !!currentLead.phone,
      hasEmail: !!currentLead.email,
      expressedInterest: !!qualification.interest || !!currentLead.interest,
      hasBudget: qualification.hasBudget ?? null,
      hasTimeline: qualification.hasTimeline ?? null,
      respondedToFollowup: currentLead.status !== 'new',
      previousPatient: !!currentLead.patient_id,
    })

    const temperature = getTemperatureFromScore(scoreResult.score)
    const isQualified = scoreResult.score >= 50

    // Determine missing info
    const missingInfo: string[] = []
    if (!currentLead.email) missingInfo.push('email')
    if (!qualification.hasBudget && !currentLead.interest) missingInfo.push('orçamento')
    if (!qualification.hasTimeline) missingInfo.push('urgência')

    // Determine next steps
    const nextSteps: string[] = []
    if (temperature === 'hot') {
      nextSteps.push('Agendar avaliação imediatamente')
      nextSteps.push('Enviar propostas personalizadas')
    } else if (temperature === 'warm') {
      nextSteps.push('Enviar mais informações sobre procedimentos')
      nextSteps.push('Follow-up em 2-3 dias')
    } else {
      nextSteps.push('Adicionar à sequência de nurturing')
      nextSteps.push('Enviar conteúdo educativo')
    }

    // Update lead
    const updateData: Record<string, unknown> = {
      score: scoreResult.score,
      temperature,
      status: isQualified ? 'qualified' : currentLead.status,
      interest: qualification.interest || currentLead.interest,
      notes: qualification.notes || currentLead.notes,
      updated_at: new Date().toISOString(),
    }

    await supabase.from('leads').update(updateData).eq('id', leadId)

    // Trigger hot lead notification if score crossed threshold
    if (previousScore < 70 && scoreResult.score >= 70) {
      import('@/services/leads/lead-notification.service').then(
        ({ notifyHotLead }) => notifyHotLead(leadId)
      ).catch((err) => {
        dbLogger.error('Background notification failed', err, { leadId })
      })
    }

    return {
      is_qualified: isQualified,
      temperature,
      score: scoreResult.score,
      missing_info: missingInfo,
      next_steps: nextSteps,
    }
  } catch (error) {
    dbLogger.error('Error qualifying lead', error)
    return null
  }
}

/**
 * Get hot leads (for notifications)
 */
export async function getHotLeads(clinicId: string, limit: number = 10): Promise<Lead[]> {
  const supabase = await createTypedClient()

  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('temperature', 'hot')
      .in('status', ['new', 'contacted', 'qualified'])
      .order('score', { ascending: false })
      .limit(limit)

    if (error) throw error

    return (leads || []) as Lead[]
  } catch (error) {
    dbLogger.error('Error fetching hot leads', error)
    return []
  }
}

/**
 * Convert lead to patient
 */
export async function convertLeadToPatient(
  leadId: string,
  patientId: string
): Promise<boolean> {
  const supabase = await createTypedClient()

  try {
    const { error } = await supabase
      .from('leads')
      .update({
        patient_id: patientId,
        status: 'converted',
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    if (error) throw error

    return true
  } catch (error) {
    dbLogger.error('Error converting lead to patient', error)
    return false
  }
}

/**
 * Get lead statistics for dashboard
 */
export async function getLeadStats(clinicId: string): Promise<{
  total: number
  byStatus: Record<LeadStatus, number>
  byTemperature: Record<LeadTemperature, number>
  conversionRate: number
  avgScore: number
}> {
  const supabase = await createTypedClient()

  try {
    const { data: leads, error } = await supabase
      .from('leads')
      .select('status, temperature, score')
      .eq('clinic_id', clinicId)

    if (error) throw error

    const byStatus: Record<LeadStatus, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      proposal: 0,
      negotiation: 0,
      converted: 0,
      lost: 0,
    }

    const byTemperature: Record<LeadTemperature, number> = {
      cold: 0,
      warm: 0,
      hot: 0,
    }

    let totalScore = 0
    let converted = 0

    for (const lead of leads || []) {
      byStatus[lead.status as LeadStatus]++
      byTemperature[lead.temperature as LeadTemperature]++
      totalScore += lead.score || 0
      if (lead.status === 'converted') converted++
    }

    const total = leads?.length || 0

    return {
      total,
      byStatus,
      byTemperature,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      avgScore: total > 0 ? Math.round(totalScore / total) : 0,
    }
  } catch (error) {
    dbLogger.error('Error fetching lead stats', error)
    return {
      total: 0,
      byStatus: { new: 0, contacted: 0, qualified: 0, proposal: 0, negotiation: 0, converted: 0, lost: 0 },
      byTemperature: { cold: 0, warm: 0, hot: 0 },
      conversionRate: 0,
      avgScore: 0,
    }
  }
}