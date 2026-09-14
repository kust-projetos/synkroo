import { NextRequest } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { updateCampaignSchema } from '@/lib/validations'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
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
  const requestId = generateRequestId()
  try {
    const { id: campaignId } = await params
    const authResult = await validateApiAuth('followup:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return apiFailure('NOT_FOUND', 'Campaign not found', requestId, 404)
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return apiFailure('FORBIDDEN', 'Access denied to this campaign', requestId, 403)
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

    return apiSuccess({
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
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * PATCH /api/campaigns/[id]
 * Update campaign (pause, resume, cancel)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const { id: campaignId } = await params
    const authResult = await validateApiAuth('followup:manage_campaigns')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const rawBody = await request.json()
    const body = updateCampaignSchema.parse(rawBody)

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return apiFailure('NOT_FOUND', 'Campaign not found', requestId, 404)
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return apiFailure('FORBIDDEN', 'Access denied', requestId, 403)
    }

    const { status } = body
    if (!status) {
      return apiFailure('INVALID_INPUT', 'Status is required', requestId, 400)
    }

    const validTransitions: Record<string, string[]> = {
      running: ['paused', 'cancelled'],
      paused: ['running', 'cancelled'],
      scheduled: ['draft', 'cancelled'],
      draft: ['cancelled'],
    }

    if (!validTransitions[campaign.status]?.includes(status)) {
      return apiFailure(
        'INVALID_INPUT',
        `Cannot change status from ${campaign.status} to ${status}`,
        requestId,
        400,
      )
    }

    await campaignRepo.updateCampaignStatus(campaignId, status)

    return apiSuccess({ success: true, status })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete a campaign (only draft or cancelled)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId()
  try {
    const { id: campaignId } = await params
    const authResult = await validateApiAuth('followup:manage_campaigns')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const campaign = await campaignRepo.findCampaignById(campaignId)
    if (!campaign) {
      return apiFailure('NOT_FOUND', 'Campaign not found', requestId, 404)
    }

    if (campaign.clinicId !== authResult.profile!.clinic_id) {
      return apiFailure('FORBIDDEN', 'Access denied', requestId, 403)
    }

    if (!['draft', 'cancelled'].includes(campaign.status)) {
      return apiFailure(
        'INVALID_INPUT',
        'Can only delete draft or cancelled campaigns',
        requestId,
        400,
      )
    }

    // Delete recipients and campaign
    const db = getDb()
    await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, campaignId))
    await db.delete(campaigns).where(eq(campaigns.id, campaignId))

    return apiSuccess({ success: true })
  } catch (error) {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
