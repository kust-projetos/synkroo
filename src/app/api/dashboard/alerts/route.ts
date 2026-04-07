import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { getIncompleteTreatmentAlerts } from '@/services/appointments/incomplete-treatment.service'
import { getHotLeads } from '@/services/leads/leads.service'
import { findUnconvertedBudgets } from '@/services/followup/budget-followup.service'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/dashboard/alerts
 * Get consolidated alerts for the dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const supabase = await createTypedClient()

    const alerts: Array<{
      id: string
      type: 'emergency' | 'hot_lead' | 'incomplete_treatment' | 'budget_followup' | 'noshow_risk' | 'unconfirmed'
      priority: 'high' | 'medium' | 'low'
      title: string
      description: string
      action_url: string
      created_at: string
    }> = []

    // 1. Emergency escalations
    const { data: emergencies } = await supabase
      .from('conversations')
      .select('id, patient_id, created_at')
      .eq('clinic_id', clinicId)
      .eq('status', 'escalated')
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(5) as { data: Array<{ id: string; patient_id: string; created_at: string }> | null }

    for (const em of emergencies || []) {
      alerts.push({
        id: `em-${em.id}`,
        type: 'emergency',
        priority: 'high',
        title: 'Escalonamento de emergência',
        description: 'Conversa escalada para atendimento humano',
        action_url: `/dashboard/conversas?id=${em.id}`,
        created_at: (em as any).created_at,
      })
    }

    // 2. Hot leads
    const hotLeads = await getHotLeads(clinicId, 5)
    for (const lead of hotLeads) {
      alerts.push({
        id: `hl-${lead.id}`,
        type: 'hot_lead',
        priority: 'high',
        title: `Lead quente: ${lead.name}`,
        description: `Score ${lead.score}/100 — ${lead.interest || 'Interesse geral'}`,
        action_url: `/dashboard/leads/${lead.id}`,
        created_at: lead.updated_at,
      })
    }

    // 3. Incomplete treatments
    const treatmentAlerts = await getIncompleteTreatmentAlerts(clinicId)
    for (const t of treatmentAlerts.treatments.slice(0, 5)) {
      alerts.push({
        id: `it-${t.patient_id}`,
        type: 'incomplete_treatment',
        priority: t.risk_level === 'high' ? 'high' : 'medium',
        title: `Tratamento incompleto: ${t.patient_name}`,
        description: `${t.procedure_name} — ${t.completed_sessions}/${t.expected_sessions} sessões, ${t.days_since_last} dias`,
        action_url: `/dashboard/pacientes/${t.patient_id}`,
        created_at: new Date().toISOString(),
      })
    }

    // 4. Unconverted budgets
    const budgets = await findUnconvertedBudgets(clinicId)
    for (const b of budgets.slice(0, 5)) {
      alerts.push({
        id: `bf-${b.id}`,
        type: 'budget_followup',
        priority: 'medium',
        title: `Orçamento sem resposta: ${b.patient_name}`,
        description: `R$ ${b.total_value.toFixed(2)} — ${b.days_since_created} dias sem resposta`,
        action_url: `/dashboard/leads/${b.patient_id}`,
        created_at: b.created_at,
      })
    }

    // 5. No-show risk (appointments today not confirmed)
    const today = new Date().toISOString().split('T')[0]
    const { data: unconfirmed } = await supabase
      .from('appointments')
      .select('id, patient_id, scheduled_at, patients (name)')
      .eq('clinic_id', clinicId)
      .eq('status', 'pending')
      .gte('scheduled_at', today)
      .lt('scheduled_at', today + 'T23:59:59') as { data: Array<{ id: string; patient_id: string; scheduled_at: string; patients?: { name: string } }> | null }

    for (const apt of (unconfirmed || []).slice(0, 5)) {
      const patientName = (apt as any).patients?.name || 'Paciente'
      alerts.push({
        id: `ns-${apt.id}`,
        type: 'unconfirmed',
        priority: 'medium',
        title: `Agendamento não confirmado: ${patientName}`,
        description: `Hoje às ${new Date((apt as any).scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        action_url: `/dashboard/agendamentos/${apt.id}`,
        created_at: (apt as any).scheduled_at,
      })
    }

    // Sort by priority then date
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    alerts.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Week-over-week stats
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    const { count: thisWeekMsgs } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', weekAgo)

    const { count: lastWeekMsgs } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', twoWeeksAgo)
      .lt('created_at', weekAgo)

    const messageChange = lastWeekMsgs
      ? Math.round((((thisWeekMsgs || 0) - lastWeekMsgs) / lastWeekMsgs) * 100)
      : 0

    const { count: todayAppts } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', today)
      .lt('scheduled_at', today + 'T23:59:59')

    const { count: confirmedToday } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .eq('status', 'confirmed')
      .gte('scheduled_at', today)
      .lt('scheduled_at', today + 'T23:59:59')

    return NextResponse.json({
      alerts,
      stats: {
        totalAlerts: alerts.length,
        highPriority: alerts.filter((a) => a.priority === 'high').length,
        todayAppointments: todayAppts || 0,
        confirmedToday: confirmedToday || 0,
        confirmationRate: todayAppts ? Math.round(((confirmedToday || 0) / todayAppts) * 100) : 0,
        messagesThisWeek: thisWeekMsgs || 0,
        messageChangePercent: messageChange,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
