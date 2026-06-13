import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateApiAuth } from '@/lib/auth/session'
import { handleApiError, ValidationError } from '@/lib/errors'
import { dbLogger } from '@/lib/logger'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'
import { PAGINATION } from '@/lib/config'
import {
  getLeads,
  createLead,
  getLeadStats,
  LeadSource,
  LeadStatus,
  LeadTemperature,
} from '@/services/leads/leads.service'
import { createLeadSchema } from '@/lib/validations'

/**
 * GET /api/leads
 * List leads with filters
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
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status') as LeadStatus | null
    const temperature = searchParams.get('temperature') as LeadTemperature | null
    const minScore = searchParams.get('min_score') ? parseInt(searchParams.get('min_score')!) : undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const statsOnly = searchParams.get('stats') === 'true'

    // Return stats only if requested
    if (statsOnly) {
      const stats = await getLeadStats(clinicId)
      return NextResponse.json({ stats })
    }

    const result = await getLeads({
      clinicId,
      status: status || undefined,
      temperature: temperature || undefined,
      minScore,
      limit,
      offset,
    })

    return NextResponse.json({
      leads: result.leads,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: result.total > offset + limit,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/leads
 * Create a new lead
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId, {
      ...rateLimitPresets.api,
      keyPrefix: 'leads-create',
    })

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const rawBody = await request.json()
    const { name, phone, email, source, interest, patientId, notes, deal_value } = createLeadSchema.parse(rawBody)

    const lead = await createLead({
      clinicId,
      name,
      phone,
      email: email ?? undefined,
      source: (source as LeadSource) || 'other',
      interest: interest ?? undefined,
      patientId: patientId ?? undefined,
      notes: notes ?? undefined,
      deal_value: deal_value ?? undefined,
    })

    if (!lead) {
      return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 })
    }

    // Trigger hot lead notification if score meets threshold
    if (lead.temperature === 'hot' && lead.score >= 70) {
      import('@/services/leads/lead-notification.service').then(
        ({ notifyHotLead }) => notifyHotLead(lead.id)
      ).catch((err) => {
        dbLogger.error('Background notification failed', err, { leadId: lead.id })
      })
    }

    return NextResponse.json({ lead }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}