import { NextRequest, NextResponse } from 'next/server'
import { processAllFollowUps } from '@/services/followup/followup.service'
import { runInactivityDetection } from '@/services/followup/inactive-patient.service'
import { processScheduledCampaigns } from '@/services/followup/campaign.service'
import { checkAllClinicsHotLeads } from '@/services/leads/lead-notification.service'
import { handleApiError } from '@/lib/errors'

/**
 * POST /api/cron/followups
 * Cron job endpoint to process follow-ups, inactivity detection, and campaigns
 *
 * Recommended schedule:
 * - Every 5 minutes for post-consultation follow-ups
 * - Daily at 8am for return reminders
 * - Daily at 6am for inactivity detection
 * - Every 30 minutes for scheduled campaigns
 *
 * Security: Requires CRON_SECRET header for authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const cronSecret = request.headers.get('Authorization')
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET || cronSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query params to filter what to process
    const { searchParams } = new URL(request.url)
    const tasks = searchParams.get('tasks')?.split(',') || ['all']

    const results: Record<string, unknown> = {}

    // Process follow-ups (post-consultation, return reminders)
    if (tasks.includes('all') || tasks.includes('followups')) {
      console.warn('Processing follow-ups...')
      results.followUps = await processAllFollowUps()
    }

    // Run inactivity detection
    if (tasks.includes('all') || tasks.includes('inactivity')) {
      console.warn('Running inactivity detection...')
      await runInactivityDetection()
      results.inactivity = 'completed'
    }

    // Process scheduled campaigns
    if (tasks.includes('all') || tasks.includes('campaigns')) {
      console.warn('Processing scheduled campaigns...')
      await processScheduledCampaigns()
      results.campaigns = 'processed'
    }

    // Check and notify hot leads across all clinics
    if (tasks.includes('all') || tasks.includes('hot-leads')) {
      console.warn('Checking hot leads across clinics...')
      await checkAllClinicsHotLeads()
      results.hotLeads = 'checked'
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/cron/followups
 * Health check for cron endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Follow-up cron endpoint is active',
    availableTasks: ['followups', 'inactivity', 'campaigns', 'hot-leads', 'all'],
    timestamp: new Date().toISOString(),
  })
}
