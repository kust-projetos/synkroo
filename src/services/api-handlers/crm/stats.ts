import { NextResponse } from 'next/server'
import { eq, and, not, inArray, sql } from 'drizzle-orm'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { getCampaigns } from '@/services/followup/campaign.service'
import { getDb } from '@/lib/db/client'
import { leads } from '@/lib/db/schema'
import { checkRateLimit, getClientIdentifier, rateLimitPresets } from '@/lib/rate-limit'

/**
 * GET /api/crm/stats
 * Cross-module CRM stats for hub page
 *
 * Escala: estatísticas de leads calculadas no Postgres via agregação SQL
 * (count(*), FILTER, avg, sum, GROUP BY). Nenhuma listagem bruta de leads
 * é carregada em memória.
 */
export async function GET(request: Request) {
  const requestId = generateRequestId()
  try {
    // Rate limit CRM stats endpoint
    const clientId = getClientIdentifier(request as any)
    const rateLimit = checkRateLimit(clientId, rateLimitPresets.api)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: { code: 'TOO_MANY_REQUESTS', message: 'Rate limit exceeded', requestId }, retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      )
    }

    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }

    const clinicId = authResult.profile!.clinic_id
    const db = getDb()

    // Escopo base: leads da clínica, excluindo perdedores de merge (paridade
    // com o filtro aplicado por listLeadsByClinic).
    const leadScope = and(
      eq(leads.clinicId, clinicId),
      sql`(${leads.mergeStatus} is null or ${leads.mergeStatus} != 'merged')`
    )

    // Agregados de leads + distribuições por status/temperatura em paralelo.
    // 1) Totais: total, hot_leads via FILTER e soma de scores (avg calculada
    //    no JS para paridade exata: avg no SQL ignora nulls na divisão,
    //    enquanto o original somava score || 0 sobre todos os leads).
    // 2-3) GROUP BY status / temperature para os breakdowns.
    const [leadAgg, statusRows, temperatureRows] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          hotLeads: sql<number>`count(*) filter (where ${leads.temperature} = 'hot')::int`,
          totalScore: sql<number>`coalesce(sum(coalesce(${leads.score}, 0)), 0)::int`,
        })
        .from(leads)
        .where(leadScope)
        .then(([r]) => r ?? { total: 0, hotLeads: 0, totalScore: 0 }),
      db
        .select({
          status: leads.status,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(leadScope)
        .groupBy(leads.status),
      db
        .select({
          temperature: leads.temperature,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .where(leadScope)
        .groupBy(leads.temperature),
    ])

    const total = leadAgg.total ?? 0
    const totalScore = leadAgg.totalScore ?? 0
    const byStatus: Record<string, number> = {}
    for (const row of statusRows) {
      const key = row.status || 'unknown'
      byStatus[key] = (byStatus[key] || 0) + (row.count ?? 0)
    }
    const byTemperature: Record<string, number> = {}
    for (const row of temperatureRows) {
      const key = row.temperature || 'cold'
      byTemperature[key] = (byTemperature[key] || 0) + (row.count ?? 0)
    }
    const leadStats = {
      total,
      byStatus,
      byTemperature,
      hotLeads: leadAgg.hotLeads ?? 0,
      avgScore: total > 0 ? Math.round(totalScore / total) : 0,
    }

    // Pipeline value (soma de deal_value do pipeline aberto) em consulta
    // isolada com fallback 0 — preserva o filtro original exato (só
    // clinicId + status, sem mergeStatus) e nunca derruba o endpoint.
    let pipelineValue = 0
    try {
      const [pipelineRow] = await db
        .select({
          value: sql<string | number>`coalesce(sum(${leads.dealValue}), 0)`,
        })
        .from(leads)
        .where(and(
          eq(leads.clinicId, clinicId),
          not(inArray(leads.status, ['converted', 'lost']))
        ))
      pipelineValue = Number(pipelineRow?.value) || 0
    } catch {
      // Pipeline value calculation optional
    }

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

    // Calculate campaign ROI (conversions * avg patient value / campaign cost)
    const AVG_PATIENT_VALUE = 500 // BRL default estimate
    const campaignConversions = campaignStats.totalConversions || 0
    const campaignRoi = campaignStats.totalSent > 0
      ? Math.round(((campaignConversions * AVG_PATIENT_VALUE) / (campaignStats.totalSent * 0.5)))
      : 0

    const convertedCount = leadStats.byStatus['converted'] || 0;
    const lostCount = leadStats.byStatus['lost'] || 0;
    const conversionRate = leadStats.total > 0 ? Math.round((convertedCount / leadStats.total) * 100) : 0
    const activeLeads = leadStats.total - convertedCount - lostCount

    return apiSuccess({
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
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}
