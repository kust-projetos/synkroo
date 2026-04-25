import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { processScheduledCampaigns } from '@/services/followup/campaign.service'
import { handleApiError } from '@/lib/errors'

/**
 * POST /api/campaigns/process
 * Process scheduled campaigns (called by cron job every 5 minutes)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify CRON_SECRET for cron authentication
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured' },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Process scheduled campaigns
    await processScheduledCampaigns()

    return NextResponse.json({
      success: true,
      message: 'Scheduled campaigns processed',
    })
  } catch (error) {
    return handleApiError(error)
  }
}
