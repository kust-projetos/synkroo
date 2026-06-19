import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, hasRequiredRole } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import * as patientRepo from '@/repositories/patients'

/**
 * GET /api/patients/inactive?min_days=30&stats_only=true
 * List inactive patients for authenticated user's clinic
 * Requires: owner, admin, or dentist role
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin', 'dentist'])) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const minDays = parseInt(searchParams.get('min_days') || '30')
    const statsOnly = searchParams.get('stats_only') === 'true'

    const now = new Date()
    const SEGMENTS = [
      { key: 'inactive_30', min: 30, max: 59 },
      { key: 'inactive_60', min: 60, max: 89 },
      { key: 'inactive_90', min: 90, max: 179 },
      { key: 'inactive_180', min: 180, max: 99999 },
    ]

    const patients = await patientRepo.findInactiveByClinic(clinicId, { sinceDays: minDays })

    const processedPatients = (patients || [])
      .map(p => {
        const daysSince = p.lastVisitAt
          ? Math.floor((now.getTime() - p.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999
        const segment = SEGMENTS.find(s => daysSince >= s.min && daysSince <= s.max)
        if (!segment) return null
        return {
          patientId: p.id,
          patientName: p.name ?? 'Paciente',
          patientPhone: p.phone,
          lastVisit: p.lastVisitAt,
          daysSinceLastVisit: daysSince,
          inactivitySegment: segment.key,
          clinicId,
          clinicName: '',
          totalVisits: 0,
          riskScore: p.riskScore || '0.00',
        }
      })
      .filter(Boolean)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => Number(b.riskScore) - Number(a.riskScore))

    if (statsOnly) {
      const bySegment: Record<string, number> = {}
      for (const p of processedPatients) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bySegment[(p as any).inactivitySegment] = (bySegment[(p as any).inactivitySegment] || 0) + 1
      }
      return NextResponse.json({
        stats: {
          totalInactive: processedPatients.length,
          bySegment,
          atRiskRevenue: 0,
        },
      })
    }

    return NextResponse.json({
      total: processedPatients.length,
      patients: processedPatients,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/patients/inactive
 * Update patient tags with inactivity status
 * Requires: owner or admin role
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    if (!hasRequiredRole(authResult.profile!, ['owner', 'admin'])) {
      return NextResponse.json(
        { error: 'Only owners and admins can update patient tags' },
        { status: 403 }
      )
    }

    const SEGMENTS = [
      { key: 'inactive_30', min: 30, max: 59, label: 'Inativo 30 dias' },
      { key: 'inactive_60', min: 60, max: 89, label: 'Inativo 60 dias' },
      { key: 'inactive_90', min: 90, max: 179, label: 'Inativo 90 dias' },
      { key: 'inactive_180', min: 180, max: 99999, label: 'Inativo 6 meses' },
    ]

    const now = new Date()
    const patients = await patientRepo.findInactiveByClinic(clinicId, { sinceDays: 30 })

    let updated = 0
    let skipped = 0

    for (const patient of patients) {
      const daysSince = patient.lastVisitAt
        ? Math.floor((now.getTime() - patient.lastVisitAt.getTime()) / (1000 * 60 * 60 * 24))
        : 999

      const segment = SEGMENTS.find(s => daysSince >= s.min && daysSince <= s.max)
      if (!segment) { skipped++; continue }

      const currentTags = (patient.tags || []).filter((t: string) => !t.startsWith('Inativo'))
      const newTags = [...currentTags, segment.label]

      await patientRepo.bulkUpdateTags([patient.id], newTags)
      updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      errors: skipped,
    })
  } catch (error) {
    return handleApiError(error)
  }
}