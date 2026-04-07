import { NextRequest, NextResponse } from 'next/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { validateApiAuth } from '@/lib/supabase/server'
import { dbLogger } from '@/lib/logger'
import { getInactivityStats } from '@/services/followup/inactive-patient.service'

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for a clinic
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

    const today = new Date().toISOString().split('T')[0]

    // Get today's appointments count
    const { data: todayAppointments, error: todayError } = await supabase
      .from('appointments')
      .select('id, status')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', today)
      .lt('scheduled_at', today + 'T23:59:59') as { data: Array<{ id: string; status: string }> | null; error: any }

    if (todayError) {
      dbLogger.error('Error fetching today appointments', todayError)
    }

    const todayCount = todayAppointments?.length || 0
    const confirmedCount = todayAppointments?.filter((a) => a.status === 'confirmed').length || 0
    const pendingCount = todayAppointments?.filter(
      (a) => a.status === 'pending' || a.status === 'scheduled'
    ).length || 0

    // Get confirmation rate (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentAppointments, error: recentError } = await supabase
      .from('appointments')
      .select('status')
      .eq('clinic_id', clinicId)
      .gte('created_at', thirtyDaysAgo.toISOString()) as { data: Array<{ status: string }> | null; error: any }

    if (recentError) {
      dbLogger.error('Error fetching recent appointments', recentError)
    }

    const totalRecent = recentAppointments?.length || 0
    const confirmedRecent = recentAppointments?.filter(
      (a) => a.status === 'confirmed' || a.status === 'completed'
    ).length || 0

    const confirmationRate = totalRecent > 0 ? Math.round((confirmedRecent / totalRecent) * 100) : 0

    // Get inactive patients count using service
    const inactiveStats = await getInactivityStats(clinicId)

    // Get active campaigns count
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id, status')
      .eq('clinic_id', clinicId)
      .in('status', ['running', 'scheduled'])

    if (campaignsError) {
      dbLogger.error('Error fetching campaigns', campaignsError)
    }

    const activeCampaigns = campaigns?.length || 0

    // Get active conversations count
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id')
      .eq('clinic_id', clinicId)
      .in('status', ['active', 'waiting'])

    if (convError) {
      dbLogger.error('Error fetching conversations', convError)
    }

    const openConversations = conversations?.length || 0

    // Get total patients count
    const { count: totalPatients, error: patientsError } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)

    if (patientsError) {
      dbLogger.error('Error counting patients', patientsError)
    }

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
        totalPatients: totalPatients || 0,
      },
      inactivePatients: {
        totalInactive: inactiveStats.totalInactive,
        bySegment: inactiveStats.bySegment,
      },
    })
  } catch (error) {
    dbLogger.error('Error fetching dashboard stats', error)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}