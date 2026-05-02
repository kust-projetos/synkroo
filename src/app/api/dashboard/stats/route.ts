import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { dbLogger } from '@/lib/logger'
import { getInactivityStats } from '@/services/followup/inactive-patient.service'

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for a clinic
 * All independent queries run in parallel via Promise.all()
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
    const supabase = await createClient()

    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Run all independent queries in parallel
    // getInactivityStats is isolated to prevent it from breaking other queries
    const [
      todayResult,
      recentResult,
      inactiveStats,
      campaignsResult,
      conversationsResult,
      patientsResult,
    ] = await Promise.all([
      // 1. Today's appointments
      supabase
        .from('appointments')
        .select('id, status')
        .eq('clinic_id', clinicId)
        .gte('scheduled_at', today)
        .lt('scheduled_at', today + 'T23:59:59'),

      // 2. Last 30 days for confirmation rate
      supabase
        .from('appointments')
        .select('status')
        .eq('clinic_id', clinicId)
        .gte('created_at', thirtyDaysAgo.toISOString()),

      // 3. Inactive patients (isolated from failures)
      getInactivityStats(clinicId).catch((err) => {
        dbLogger.error('Inactivity stats failed', { error: String(err) })
        return { totalInactive: 0, bySegment: {}, atRiskRevenue: 0 }
      }),

      // 4. Active campaigns
      supabase
        .from('campaigns')
        .select('id, status')
        .eq('clinic_id', clinicId)
        .in('status', ['running', 'scheduled']),

      // 5. Open conversations
      supabase
        .from('conversations')
        .select('id')
        .eq('clinic_id', clinicId)
        .in('status', ['active', 'waiting']),

      // 6. Total patients count
      supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId),
    ])

    // Check for Supabase query errors
    const queryErrors = [
      { name: 'todayAppointments', result: todayResult },
      { name: 'recentAppointments', result: recentResult },
      { name: 'campaigns', result: campaignsResult },
      { name: 'conversations', result: conversationsResult },
      { name: 'patients', result: patientsResult },
    ].filter(({ name, result }) => {
      if ('error' in result && result.error) {
        dbLogger.error(`Dashboard stats query error: ${name}`, { error: result.error })
        return true
      }
      return false
    })

    if (queryErrors.length === 5) {
      return NextResponse.json(
        { error: 'Failed to fetch dashboard statistics' },
        { status: 500 }
      )
    }

    // Process today's appointments
    const todayAppointments = todayResult.data as Array<{ id: string; status: string }> | null
    const todayCount = todayAppointments?.length || 0
    const confirmedCount = todayAppointments?.filter((a) => a.status === 'confirmed').length || 0
    const pendingCount = todayAppointments?.filter(
      (a) => a.status === 'pending' || a.status === 'scheduled'
    ).length || 0

    // Process confirmation rate
    const recentAppointments = recentResult.data as Array<{ status: string }> | null
    const totalRecent = recentAppointments?.length || 0
    const confirmedRecent = recentAppointments?.filter(
      (a) => a.status === 'confirmed' || a.status === 'completed'
    ).length || 0
    const confirmationRate = totalRecent > 0 ? Math.round((confirmedRecent / totalRecent) * 100) : 0

    // Process campaigns
    const campaigns = campaignsResult.data as Array<{ id: string; status: string }> | null
    const activeCampaigns = campaigns?.length || 0

    // Process conversations
    const conversations = conversationsResult.data as Array<{ id: string }> | null
    const openConversations = conversations?.length || 0

    // Process patients count
    const totalPatients = patientsResult.count || 0

    return NextResponse.json({
      today: {
        appointments: todayCount,
        confirmed: confirmedCount,
        pending: pendingCount,
      },
      metrics: {
        confirmationRate,
        activeCampaigns,
        openConversations,
        totalPatients,
      },
      inactivePatients: {
        totalInactive: inactiveStats.totalInactive,
        bySegment: inactiveStats.bySegment,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}