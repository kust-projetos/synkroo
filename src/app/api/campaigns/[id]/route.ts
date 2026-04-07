import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, hasRequiredRole, createClient } from '@/lib/supabase/server'
import { updateCampaignSchema } from '@/lib/validations'
import { handleApiError, ValidationError } from '@/lib/errors'
import type { Campaign } from '@/lib/supabase/database.types'

type RecipientRow = { status: string }

type RecipientDetail = {
  id: string
  patient_id: string
  status: string
  sent_at: string | null
  delivered_at: string | null
  error_message: string | null
  patients: { name: string; phone: string } | null
}

/**
 * GET /api/campaigns/[id]
 * Get campaign details with recipient stats
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const supabase = await createClient()

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single() as { data: Campaign | null; error: any }

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.clinic_id !== authResult.profile!.clinic_id) {
      return NextResponse.json(
        { error: 'Access denied to this campaign' },
        { status: 403 }
      )
    }

    // Get recipient stats
    const { data: recipientStats } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId)

    const rows = (recipientStats || []) as RecipientRow[]
    const stats = {
      total: rows.length,
      pending: rows.filter(r => r.status === 'pending').length,
      sent: rows.filter(r => r.status === 'sent').length,
      delivered: rows.filter(r => r.status === 'delivered').length,
      failed: rows.filter(r => r.status === 'failed').length,
      responded: rows.filter(r => r.status === 'responded').length,
      converted: rows.filter(r => r.status === 'converted').length,
      opted_out: rows.filter(r => r.status === 'opted_out').length,
    }

    // Get recent recipients (last 10)
    const { data: recentRecipients } = await supabase
      .from('campaign_recipients')
      .select(`
        id,
        patient_id,
        status,
        sent_at,
        delivered_at,
        error_message,
        patients (name, phone)
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .limit(10)

    const recent = (recentRecipients || []) as unknown as RecipientDetail[]

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        clinicId: campaign.clinic_id,
        name: campaign.name,
        description: campaign.description,
        campaignType: campaign.campaign_type,
        targetSegment: campaign.target_segment,
        messageTemplate: campaign.message_template,
        channel: campaign.channel,
        status: campaign.status,
        scheduledAt: campaign.scheduled_at,
        startedAt: campaign.started_at,
        completedAt: campaign.completed_at,
        createdAt: campaign.created_at,
      },
      stats,
      recentRecipients: recent.map(r => ({
        id: r.id,
        patientId: r.patient_id,
        patientName: r.patients?.name,
        patientPhone: r.patients?.phone,
        status: r.status,
        sentAt: r.sent_at,
        deliveredAt: r.delivered_at,
        errorMessage: r.error_message,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update campaign (pause, resume, cancel)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can update campaigns' },
        { status: 403 }
      )
    }

    const rawBody = await request.json()
    const body = updateCampaignSchema.parse(rawBody)

    const supabase = await createClient()

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('clinic_id, status')
      .eq('id', campaignId)
      .single() as { data: { clinic_id: string; status: string } | null; error: any }

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.clinic_id !== authResult.profile!.clinic_id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const { status } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      )
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      running: ['paused', 'cancelled'],
      paused: ['running', 'cancelled'],
      scheduled: ['draft', 'cancelled'],
      draft: ['cancelled'],
    }

    if (!validTransitions[campaign.status]?.includes(status)) {
      return NextResponse.json(
        { error: `Cannot change status from ${campaign.status} to ${status}` },
        { status: 400 }
      )
    }

    const updateData: Record<string, unknown> = { status }

    if (status === 'paused') {
      updateData.paused_at = new Date().toISOString()
    } else if (status === 'cancelled') {
      updateData.cancelled_at = new Date().toISOString()
    } else if (status === 'running') {
      updateData.resumed_at = new Date().toISOString()
    }

    await (supabase
      .from('campaigns') as any)
      .update(updateData)
      .eq('id', campaignId)

    return NextResponse.json({ success: true, status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleApiError(new ValidationError('Validation failed', { issues: error.issues }))
    }
    return handleApiError(error)
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete a campaign (only draft or cancelled)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can delete campaigns' },
        { status: 403 }
      )
    }

    const supabase = await createClient()

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('clinic_id, status')
      .eq('id', campaignId)
      .single() as { data: { clinic_id: string; status: string } | null; error: any }

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    if (campaign.clinic_id !== authResult.profile!.clinic_id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    if (!['draft', 'cancelled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled campaigns' },
        { status: 400 }
      )
    }

    await supabase
      .from('campaign_recipients')
      .delete()
      .eq('campaign_id', campaignId)

    await supabase
      .from('campaigns')
      .delete()
      .eq('id', campaignId)

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}
