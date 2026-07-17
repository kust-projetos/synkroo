import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lt, inArray, desc, asc, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { conversations, appointments, patients } from '@/lib/db/schema'
import { getIncompleteTreatmentAlerts } from '@/services/appointments/incomplete-treatment.service'
import { listLeadsByClinic } from '@/modules/comercial/repositories/leads-repository'
import { findUnconvertedBudgets } from '@/services/followup/budget-followup.service'

// Minimal inferred shape for the hot-lead filter callback (TS7006).
interface HotLeadRow {
  temperature?: string | null;
  score?: number | null;
  status?: string | null;
}

/** Alert item shape — preserved from original contract. */
interface Alert {
  id: string
  type: 'emergency' | 'hot_lead' | 'incomplete_treatment' | 'budget_followup' | 'noshow_risk' | 'unconfirmed'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  action_url: string
  created_at: string
}

/**
 * GET /api/dashboard/alerts
 * Consolidated dashboard alerts — migrated from Supabase to Drizzle.
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
    const db = getDb()

    const alerts: Alert[] = []

    // 1. Emergency escalations
    const emergencies = await db
      .select({
        id: conversations.id,
        patientId: conversations.patientId,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.clinicId, clinicId),
          eq(conversations.status, 'escalated' as any),
        ),
      )
      .orderBy(desc(conversations.createdAt))
      .limit(5)

    for (const em of emergencies) {
      alerts.push({
        id: `em-${em.id}`,
        type: 'emergency',
        priority: 'high',
        title: 'Escalonamento de emergência',
        description: 'Conversa escalada para atendimento humano',
        action_url: `/dashboard/conversas?id=${em.id}`,
        created_at: (em.createdAt ?? new Date()).toISOString(),
      })
    }

    // 2. Hot leads via comercial repository
    const allLeads = await listLeadsByClinic(clinicId);
    const hotLeads = allLeads
      .filter((l: HotLeadRow) => l.temperature === 'hot' && (l.score || 0) >= 70 && l.status !== 'converted' && l.status !== 'lost')
      .slice(0, 5);
    for (const lead of hotLeads) {
      alerts.push({
        id: `hl-${lead.id}`,
        type: 'hot_lead',
        priority: 'high',
        title: `Lead quente: ${lead.name}`,
        description: `Score ${lead.score}/100 — ${lead.interest || 'Interesse geral'}`,
        action_url: `/dashboard/leads/${lead.id}`,
        created_at: lead.updatedAt ? new Date(lead.updatedAt).toISOString() : new Date().toISOString(),
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

    // 5. Unconfirmed appointments today (pending status)
    const today = new Date()
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000)

    const unconfirmedRows = await db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        scheduledAt: appointments.scheduledAt,
        patientName: patients.name,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.clinicId, clinicId),
          eq(appointments.status, 'pending' as any),
          gte(appointments.scheduledAt, todayStart),
          lt(appointments.scheduledAt, todayEnd),
        ),
      )
      .limit(5)

    for (const apt of unconfirmedRows) {
      alerts.push({
        id: `ns-${apt.id}`,
        type: 'unconfirmed',
        priority: 'medium',
        title: `Agendamento não confirmado: ${apt.patientName || 'Paciente'}`,
        description: `Hoje às ${(apt.scheduledAt ?? new Date()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        action_url: `/dashboard/agendamentos/${apt.id}`,
        created_at: (apt.scheduledAt ?? new Date()).toISOString(),
      })
    }

    // Sort by priority then date
    const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
    alerts.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    // Week-over-week stats (parallel)
    const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 3600 * 1000)
    const twoWeeksAgo = new Date(todayStart.getTime() - 14 * 24 * 3600 * 1000)

    const [[thisWeek], [lastWeek], [todayApps], [confirmedTodayCount]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(eq(conversations.clinicId, clinicId), gte(conversations.createdAt, weekAgo))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(eq(conversations.clinicId, clinicId), gte(conversations.createdAt, twoWeeksAgo), lt(conversations.createdAt, weekAgo))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(eq(appointments.clinicId, clinicId), gte(appointments.scheduledAt, todayStart), lt(appointments.scheduledAt, todayEnd))),
      db.select({ count: sql<number>`count(*)::int` })
        .from(appointments)
        .where(and(eq(appointments.clinicId, clinicId), eq(appointments.status, 'confirmed' as any), gte(appointments.scheduledAt, todayStart), lt(appointments.scheduledAt, todayEnd))),
    ])

    const thisWeekMsgs = thisWeek?.count ?? 0
    const lastWeekMsgs = lastWeek?.count ?? 0
    const todayAppsCount = todayApps?.count ?? 0
    const confirmedToday = confirmedTodayCount?.count ?? 0

    const messageChange = lastWeekMsgs
      ? Math.round(((thisWeekMsgs - lastWeekMsgs) / lastWeekMsgs) * 100)
      : 0

    return NextResponse.json({
      alerts,
      stats: {
        totalAlerts: alerts.length,
        highPriority: alerts.filter((a) => a.priority === 'high').length,
        todayAppointments: todayAppsCount,
        confirmedToday,
        confirmationRate: todayAppsCount ? Math.round((confirmedToday / todayAppsCount) * 100) : 0,
        messagesThisWeek: thisWeekMsgs,
        messageChangePercent: messageChange,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
