import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth, hasRequiredRole } from '@/lib/supabase/server'
import { updateCampaignSchema } from '@/lib/validations'
import { handleApiError, ValidationError } from '@/lib/errors'
import * as campaignRepo from '@/repositories/campaigns'
import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { campaigns, campaignRecipients, patients } from '@/lib/db/schema'

interface RouteParams {
  params: Promise<{ id: string }>
}

function repoCampaignToApi(c: campaignRepo.CampaignRow) {
  return {
    id: c.id,
    clinicId: c.clinicId,
    name: c.name,
    description: c.description,
    campaignType: c.campaignType,
    targetSegment: c.targetSegment,
    messageTemplate: c.messageTemplate,
    channel: c.channel,
    status: c.status,
    scheduledAt: c.scheduledAt,
    startedAt: c.startedAt,
    completedAt: c.completedAt,
    createdAt: c.createdAt,
  }
}

/**
 * GET /api/campaigns/[id]
 * Get campaign details with recipient stats
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: campaignId } = await params
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return NextResponse.json({ error: 'Access denied to this campaign' }, { status: 403 })
    }

    // Get recipient stats
    const db = getDb()
    const recipients = await campaignRepo.findCampaignRecipients(campaignId)

    const stats = {
      total: recipients.length,
      pending: recipients.filter(r => r.status === 'pending').length,
      sent: recipients.filter(r => r.status === 'sent').length,
      delivered: recipients.filter(r => r.status === 'delivered').length,
      failed: recipients.filter(r => r.status === 'failed').length,
      responded: recipients.filter(r => r.status === 'responded').length,
      converted: recipients.filter(r => r.status === 'converted').length,
      opted_out: recipients.filter(r => r.status === 'opted_out').length,
    }

    // Get recent recipients (last 10) with patient info
    const recentRows = await db
      .select({
        id: campaignRecipients.id,
        patientId: campaignRecipients.patientId,
        status: campaignRecipients.status,
        sentAt: campaignRecipients.sentAt,
        deliveredAt: campaignRecipients.deliveredAt,
        errorMessage: campaignRecipients.errorMessage,
        patientName: patients.name,
        patientPhone: patients.phone,
      })
      .from(campaignRecipients)
      .leftJoin(patients, eq(patients.id, campaignRecipients.patientId))
      .where(eq(campaignRecipients.campaignId, campaignId))
      .orderBy(sql`${campaignRecipients.createdAt} desc`)
      .limit(10)

    return NextResponse.json({
      campaign: repoCampaignToApi(campaign),
      stats,
      recentRecipients: recentRows.map(r => ({
        id: r.id,
        patientId: r.patientId,
        patientName: r.patientName,
        patientPhone: r.patientPhone,
        status: r.status,
        sentAt: r.sentAt?.toISOString() ?? null,
        deliveredAt: r.deliveredAt?.toISOString() ?? null,
        errorMessage: r.errorMessage,
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
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { status } = body
    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

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

    await campaignRepo.updateCampaignStatus(campaignId, status)

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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    if (!['draft', 'cancelled'].includes(campaign.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled campaigns' },
        { status: 400 }
      )
    }

    // Delete recipients and campaign
    const db = getDb()
    await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId))
    await db.delete(campaigns).where(eq(campaigns.id, campaignId))

    return NextResponse.json({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
}