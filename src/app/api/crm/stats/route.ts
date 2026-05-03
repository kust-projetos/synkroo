import { NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'
import { getLeadStats } from '@/services/leads/leads.service'
import { getCampaigns } from '@/services/followup/campaign.service'
import { createTypedClient } from '@/lib/supabase/typed'

/**
 * GET /api/crm/stats
 * Cross-module CRM stats for hub page
 */
export async function GET() {
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

    // Get lead stats
    const leadStats = await getLeadStats(clinicId)

    // Get campaign stats
    let campaignStats = {
      total: 0,
      active: 0,
      totalSent: 0,
      totalConversions: 0,
    }
    try {
      const campaigns = await getCampaigns(clinicId)
      const runningCampaigns = campaigns.filter((c: any) => c.status === 'running')
      campaignStats = {
        total: campaigns.length,
        active: runningCampaigns.length,
        totalSent: campaigns.reduce((sum: number, c: any) => sum + (c.sentCount || 0), 0),
        totalConversions: campaigns.reduce((sum: number, c: any) => sum + (c.conversionCount || 0), 0),
      }
    } catch {
      // Campaign stats optional, continue without
    }

    // Calculate pipeline value (sum of estimated values from leads in active stages)
    let pipelineValue = 0
    try {
      const { data: leadsWithValue } = await supabase
        .from('leads')
        .select('estimated_value')
        .eq('clinic_id', clinicId)
        .not('status', 'in', '(converted,lost)')

      if (leadsWithValue) {
        pipelineValue = leadsWithValue.reduce(
          (sum: number, lead: { estimated_value?: number }) => sum + (lead.estimated_value || 0),
          0
        )
      }
    } catch {
      // Pipeline value calculation optional
    }

    // Calculate campaign ROI (conversions * avg patient value / campaign cost)
    const AVG_PATIENT_VALUE = 500 // BRL default estimate
    const campaignConversions = campaignStats.totalConversions || 0
    const campaignRoi = campaignStats.totalSent > 0
      ? Math.round(((campaignConversions * AVG_PATIENT_VALUE) / (campaignStats.totalSent * 0.5)))
      : 0

    const conversionRate = leadStats.conversionRate || 0
    const activeLeads = leadStats.total - (leadStats.byStatus.converted || 0) - (leadStats.byStatus.lost || 0)

    return NextResponse.json({
      pipelineValue,
      campaignRoi,
      conversionRate,
      activeLeads,
      leadsTotal: leadStats.total,
      leadsByStatus: leadStats.byStatus,
      leadsByTemperature: leadStats.byTemperature,
      campaignsActive: campaignStats.active,
      campaignsTotal: campaignStats.total,
      campaignConversions,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
