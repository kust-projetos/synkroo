import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { handleApiError } from '@/lib/errors'

/**
 * GET /api/reports/patients
 * Patient reports: new patients by source, retention rate, inactive listing
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
    const supabase = await createClient()
    const searchParams = new URL(request.url).searchParams

    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]

    // New patients by source
    const { data: newPatients, error: npError } = await supabase
      .from('patients')
      .select('id, source, created_at')
      .eq('clinic_id', clinicId)
      .gte('created_at', startDate)
      .lte('created_at', endDate + 'T23:59:59')
      .is('deleted_at', null)

    if (npError) throw npError

    const bySource: Record<string, number> = {}
    for (const p of newPatients || []) {
      const source = (p as any).source || 'manual'
      bySource[source] = (bySource[source] || 0) + 1
    }

    // Total patients
    const { count: totalPatients } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)

    // Active patients (had appointment in last 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data: activePatientIds } = await supabase
      .from('appointments')
      .select('patient_id')
      .eq('clinic_id', clinicId)
      .gte('scheduled_at', ninetyDaysAgo)
      .in('status', ['completed', 'confirmed'])

    const activeIds = new Set((activePatientIds || []).map((a: any) => a.patient_id))
    const retentionRate = totalPatients ? Math.round((activeIds.size / totalPatients) * 100) : 0

    // Inactive patients
    const { data: allPatients } = await supabase
      .from('patients')
      .select('id, name, phone, created_at')
      .eq('clinic_id', clinicId)
      .is('deleted_at', null)

    const inactivePatients = (allPatients || []).filter(
      (p: any) => !activeIds.has(p.id)
    )

    // Previous period for comparison
    const prevDuration = new Date(endDate).getTime() - new Date(startDate).getTime()
    const prevStart = new Date(new Date(startDate).getTime() - prevDuration).toISOString().split('T')[0]
    const prevEnd = startDate

    const { count: prevNewPatients } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', prevStart)
      .lt('created_at', prevEnd)
      .is('deleted_at', null)

    const growth = prevNewPatients
      ? Math.round((((newPatients || []).length - prevNewPatients) / prevNewPatients) * 100)
      : 0

    return NextResponse.json({
      period: { start: startDate, end: endDate },
      newPatients: {
        total: (newPatients || []).length,
        bySource,
        growth,
      },
      retention: {
        totalPatients: totalPatients || 0,
        activePatients: activeIds.size,
        inactivePatients: inactivePatients.length,
        retentionRate,
      },
      inactiveList: inactivePatients.slice(0, 50).map((p: any) => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        created_at: p.created_at,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
