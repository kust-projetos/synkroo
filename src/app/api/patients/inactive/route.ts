import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth, hasRequiredRole, createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'

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

    const supabase = await createClient()

    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - minDays)

    // Simple query - no heavy joins, just patient data
    const { data: patients, error } = await supabase
      .from('patients')
      .select('id, name, phone, last_visit_at, risk_score')
      .eq('clinic_id', clinicId)
      .or(`last_visit_at.is.null,last_visit_at.lte.${cutoffDate.toISOString()}`)

    if (error) {
      return handleApiError(error)
    }

    // Process segments in-memory (fast, no extra queries)
    const now = new Date()
    const SEGMENTS = [
      { key: 'inactive_30', min: 30, max: 59 },
      { key: 'inactive_60', min: 60, max: 89 },
      { key: 'inactive_90', min: 90, max: 179 },
      { key: 'inactive_180', min: 180, max: 99999 },
    ]

    const processedPatients = (patients || [])
      .map((p: any) => {
        const daysSince = p.last_visit_at
          ? Math.floor((now.getTime() - new Date(p.last_visit_at).getTime()) / (1000 * 60 * 60 * 24))
          : 999
        const segment = SEGMENTS.find(s => daysSince >= s.min && daysSince <= s.max)
        if (!segment) return null
        return {
          patientId: p.id,
          patientName: p.name,
          patientPhone: p.phone,
          lastVisit: p.last_visit_at,
          daysSinceLastVisit: daysSince,
          inactivitySegment: segment.key,
          clinicId,
          clinicName: '',
          totalVisits: 0,
          riskScore: p.risk_score || 0,
        }
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.riskScore - a.riskScore)

    if (statsOnly) {
      const bySegment: Record<string, number> = {}
      for (const p of processedPatients) {
        bySegment[(p as any).inactivitySegment] = (bySegment[(p as any).inactivitySegment] || 0) + 1
      }
      return NextResponse.json({
        stats: {
          totalInactive: processedPatients.length,
          bySegment,
          atRiskRevenue: 0,
        }
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

    const supabase = await createClient()

    // Get inactive patients
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)

    const { data: patients } = await supabase
      .from('patients')
      .select('id, name, last_visit_at, tags')
      .eq('clinic_id', clinicId)
      .or(`last_visit_at.is.null,last_visit_at.lte.${cutoffDate.toISOString()}`)

    const SEGMENTS = [
      { key: 'inactive_30', min: 30, max: 59, label: 'Inativo 30 dias' },
      { key: 'inactive_60', min: 60, max: 89, label: 'Inativo 60 dias' },
      { key: 'inactive_90', min: 90, max: 179, label: 'Inativo 90 dias' },
      { key: 'inactive_180', min: 180, max: 99999, label: 'Inativo 6 meses' },
    ]

    const now = new Date()
    let updated = 0
    let errors = 0

    for (const patient of (patients || [])) {
      const p = patient as any
      const daysSince = p.last_visit_at
        ? Math.floor((now.getTime() - new Date(p.last_visit_at).getTime()) / (1000 * 60 * 60 * 24))
        : 999

      const segment = SEGMENTS.find(s => daysSince >= s.min && daysSince <= s.max)
      if (!segment) continue

      const currentTags = (p.tags || []).filter((t: string) => !t.startsWith('Inativo'))
      const newTags = [...currentTags, segment.label]

      const { error } = await (supabase
        .from('patients') as any)
        .update({ tags: newTags })
        .eq('id', p.id)

      if (error) errors++
      else updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      errors,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
