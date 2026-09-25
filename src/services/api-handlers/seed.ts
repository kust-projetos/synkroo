import { NextRequest, NextResponse } from 'next/server'
import { eq, asc, and } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, users, leads, leadActivities, campaigns, campaignRecipients, waitlist, patientFeedback, procedureGuidelines, scheduleBlocks, followUpConfigs, pipelineStages, patients, conversations, messages, instanceModules } from '@/lib/db/schema'
import { roles, rolePermissions, permissions } from '@/modules/core/schema/rbac'
import * as dentistRepo from '@/repositories/dentists'
import * as procedureRepo from '@/repositories/procedures'
import * as appointmentRepo from '@/repositories/appointments'
import { seedDefaultPipelineStages, comercialAccessPermissions } from '@/modules/comercial'
import { buildWaitlistSeed, buildLeadSeed, cleanupDemoSeedTables, leadStatusToStageIndex } from '@/lib/seed/helpers'

const CLINIC_SLUG = 'clinica-demo'

// ── Seed result types ─────────────────────────────────────────

interface DomainResult {
  ok: number
  err: number
  errors: string[]
}

// ── Seed data types ──────────────────────────────────────────

interface CampaignSeed {
  name: string
  description: string
  campaignType: string
  channel: string
  status: string
  messageTemplate: string
  totalRecipients: number
  sentCount: number
  responseCount: number
  conversionCount: number
}

interface ProcedureGuidelineSeed {
  procedureName: string
  title: string
  instructions: string
  emergencyContact: boolean
  recoveryTimeDays: number
  restrictions: string[]
  warningSigns: string[]
}

interface ScheduleDaySeed {
  day: number
  start: string
  end: string
  avail: boolean
}

// ── Helpers ─────────────────────────────────────────────────

let seedState = 1

function seededRandom(): number {
  seedState = (seedState * 1_664_525 + 1_013_904_223) >>> 0
  return seedState / 4_294_967_296
}

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)] as T
}

function randomInt(min: number, max: number): number {
  return Math.floor(seededRandom() * (max - min + 1)) + min
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000)
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000)
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000)
}

function makeDate(dayOffset: number, time: string): Date {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d
}

function slotKey(dentistId: string, dayOffset: number, time: string): string {
  return `${dentistId}-${dayOffset}-${time}`
}

// ── GET /api/seed ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
  const secret = request.nextUrl.searchParams.get('secret')
  const scenario = request.nextUrl.searchParams.get('scenario') ?? 'default'
  const isLargeScenario = scenario === 'large'
  const seedSecret = process.env.SEED_SECRET
  if (!seedSecret) {
    return NextResponse.json({ error: 'SEED_SECRET not configured' }, { status: 403 })
  }
  if (secret !== seedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  seedState = 1

  const results: Record<string, DomainResult> = {}
  const db = getDb()
  const e2eModules = ['atendimento', 'comercial', 'crm', 'operacional', 'followup', 'financeiro', 'analytics', 'ia']
  await db.insert(instanceModules).values(e2eModules.map((moduleId) => ({ moduleId, enabled: true, contractedAt: new Date() }))).onConflictDoUpdate({ target: instanceModules.moduleId, set: { enabled: true, updatedAt: new Date() } })

  // Get clinic
  const clinicRows = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.slug, CLINIC_SLUG)).limit(1)
  const clinic = clinicRows[0]
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
  const cid: string = clinic.id

  // Get admin user
  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.clinicId, cid)).limit(1)
  const admin = userRows[0]
  const userId: string | undefined = admin?.id

  // E2E admin must have the current comercial permissions, even when the database was seeded with an older role catalog.
  if (userId) {
    const adminRole = await db.select({ id: roles.id }).from(roles).where(and(eq(roles.clinicId, cid), eq(roles.name, 'Administrador'))).limit(1)
    if (adminRole[0]) {
      await db.insert(permissions).values(comercialAccessPermissions).onConflictDoNothing()
      const comercialPermissions = ['comercial:view', 'comercial:capture_leads', 'comercial:edit_leads', 'comercial:manage_pipeline', 'comercial:manage_tasks', 'comercial:manage_hot_leads']
      await db.insert(rolePermissions).values(comercialPermissions.map((permissionKey) => ({ roleId: adminRole[0].id, permissionKey }))).onConflictDoNothing()
    }
  }
  // Get existing data IDs
  const dentistRows = await dentistRepo.findByClinic(cid, { activeOnly: true })
  const dentistIds: string[] = dentistRows.map((d) => d.id)
  const procedureRows = await procedureRepo.findByClinic(cid, { activeOnly: true })
  const procedureIds: string[] = procedureRows.map((p) => p.id)
  let patientRows = await db.select({ id: patients.id }).from(patients).where(eq(patients.clinicId, cid))
  if (patientRows.length === 0) {
    await db.insert(patients).values(Array.from({ length: 8 }, (_, index) => ({
      clinicId: cid, name: `Paciente E2E ${index + 1}`, phone: `551199900${String(index + 1).padStart(4, '0')}`,
      email: `e2e-patient-${index + 1}@example.test`, status: 'active', optOutMarketing: false, optOutReminders: false,
    }))).onConflictDoNothing()
    patientRows = await db.select({ id: patients.id }).from(patients).where(eq(patients.clinicId, cid))
  }
  const patientIds: string[] = patientRows.map((p) => p.id)

  const existingConversations = await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.clinicId, cid)).limit(1)
  if (existingConversations.length === 0 && patientIds.length > 0) {
    for (const [index, patientId] of patientIds.slice(0, 3).entries()) {
      const [conversation] = await db.insert(conversations).values({
        clinicId: cid, patientId, channel: 'whatsapp', externalId: `e2e-conversation-${index + 1}`, status: 'active', messageCount: 1,
        metadata: { source: 'e2e-fixture' },
      }).returning({ id: conversations.id })
      if (conversation) await db.insert(messages).values({ conversationId: conversation.id, direction: 'inbound', content: `Mensagem E2E ${index + 1}`, messageType: 'text' })
    }
  }
  const procMap = new Map(procedureRows.map((p) => [p.id, p]))

  // Cleanup is required for both default and large fixtures: global setup reruns between E2E passes.
  await cleanupDemoSeedTables(db, cid)
  // Seed pipeline stages idempotently
  const existingStages = await db
    .select({ id: pipelineStages.id })
    .from(pipelineStages)
    .where(eq(pipelineStages.clinicId, cid))
    .limit(1)
  if (existingStages.length === 0) {
    try { await seedDefaultPipelineStages(cid) } catch { /* race condition OK */ }
  }
  // Fetch pipeline stages (always, so leads get stageId)
  const pipelineRows = await db
    .select({ id: pipelineStages.id, position: pipelineStages.position, name: pipelineStages.name })
    .from(pipelineStages)
    .where(eq(pipelineStages.clinicId, cid))
    .orderBy(asc(pipelineStages.position))
  const stageByIndex: Record<number, string> = {}
  for (const ps of pipelineRows) {
    stageByIndex[ps.position ?? 0] = ps.id
  }

  // ── LEADS ─────────────────────────────────────────────────
  const leadsData = buildLeadSeed(isLargeScenario ? 'large' : 'default')

  results.leads = { ok: 0, err: 0, errors: [] }
  const leadIds: string[] = []
  for (const l of leadsData) {
    try {
      const [inserted] = await db
        .insert(leads)
        .values({
          clinicId: cid,
          name: l.name,
          phone: l.phone,
          email: l.email,
          source: l.source,
          status: l.status,
          temperature: l.temperature,
          score: l.score,
          interest: l.interest,
          hasBudget: l.has_budget,
          hasTimeline: l.has_timeline,
          notes: l.notes,
          contactCount: l.contact_count,
          lastContactAt: l.contact_count > 0 ? hoursAgo(randomInt(1, 240)) : null,
          nextFollowupAt: ['converted', 'lost'].includes(l.status) ? null : daysFromNow(randomInt(1, 14)),
          convertedAt: l.status === 'converted' ? hoursAgo(randomInt(12, 96)) : null,
          lostReason: l.lost_reason ?? null,
          stageId: stageByIndex[leadStatusToStageIndex(l.status)] ?? null,
        })
        .returning({ id: leads.id })
      results.leads.ok++
      leadIds.push(inserted.id)
    } catch (err: unknown) {
      results.leads.err++
      results.leads.errors.push(`${l.name}: ${(err as Error).message}`)
    }
  }

  // ── LEAD ACTIVITIES ───────────────────────────────────────
  const actTypes = ['call', 'email', 'whatsapp', 'note', 'meeting', 'proposal_sent'] as const
  const actDescs = [
    'Tentativa de contato por telefone', 'Email enviado com proposta comercial',
    'Mensagem via WhatsApp enviada', 'Nota interna adicionada',
    'Reunião realizada na clínica', 'Proposta comercial enviada',
    'Retorno de ligação recebido', 'Follow-up por email',
    'Ligação atendida - cliente interessado', 'Orçamento detalhado enviado',
    'Cliente pediu mais tempo para decidir', 'Indicação recebida de outro paciente',
    'Agendamento de avaliação confirmado', 'Cliente pediu desconto',
  ] as const

  results.lead_activities = { ok: 0, err: 0, errors: [] }
  for (const lid of leadIds) {
    const count = 2 + randomInt(0, 3)
    for (let j = 0; j < count; j++) {
      try {
        await db.insert(leadActivities).values({
          leadId: lid,
          activityType: randomPick(actTypes),
          description: randomPick(actDescs),
          performedAt: hoursAgo(j * randomInt(1, 48)),
        })
        results.lead_activities.ok++
      } catch {
        results.lead_activities.err++
      }
    }
  }

  // ── CAMPAIGNS ─────────────────────────────────────────────
  const campaignsData: readonly CampaignSeed[] = [
    { name: 'Black Novembro - Implantes', description: 'Promoção black friday para implantes com 40% off', campaignType: 'promotional', channel: 'whatsapp', status: 'draft', messageTemplate: '🖤 BLACK FRIDAY 🖤 Implante com 40% de desconto! De R$ 4.500 por R$ 2.700. Responda IMPLANTE para agendar.', totalRecipients: 0, sentCount: 0, responseCount: 0, conversionCount: 0 },
    { name: 'Volta às Aulas - Jovens', description: 'Campanha para jovens com desconto em aparelho', campaignType: 'promotional', channel: 'instagram', status: 'scheduled', messageTemplate: '📚 VOLTA ÀS AULAS 📚 Aparelho ortodôntico com entrada facilitada! Parcelamos em até 18x.', totalRecipients: 0, sentCount: 0, responseCount: 0, conversionCount: 0 },
    { name: 'Aniversariantes do Mês', description: 'Desconto para pacientes aniversariantes', campaignType: 'promotional', channel: 'whatsapp', status: 'running', messageTemplate: '🎂 FELIZ ANIVERSÁRIO! 🎂 25% de desconto em procedimentos estéticos! Responda ANIVERSARIO.', totalRecipients: 30, sentCount: 18, responseCount: 6, conversionCount: 2 },
    { name: 'Pós-Tratamento Canal', description: 'Follow-up pós-canal', campaignType: 'follow_up', channel: 'whatsapp', status: 'running', messageTemplate: 'Olá {{patient_name}}! Como está após o tratamento de canal? Se tiver desconforto, entre em contato!', totalRecipients: 15, sentCount: 12, responseCount: 8, conversionCount: 0 },
    { name: 'Reativação Q1', description: 'Reativar pacientes inativos', campaignType: 'reactivation', channel: 'whatsapp', status: 'paused', messageTemplate: 'Olá {{patient_name}}! Sentimos sua falta! 💙 Responda VOLTAR para desconto exclusivo!', totalRecipients: 40, sentCount: 10, responseCount: 2, conversionCount: 1 },
    { name: 'Pesquisa de Satisfação Q1', description: 'Coletar feedback Q1', campaignType: 'follow_up', channel: 'whatsapp', status: 'completed', messageTemplate: 'Olá {{patient_name}}! Responda nossa pesquisa rápida (1 min) e concorra a uma limpeza gratuita!', totalRecipients: 90, sentCount: 85, responseCount: 52, conversionCount: 0 },
    { name: 'Dia das Mães - Estética', description: 'Promoção Dia das Mães', campaignType: 'promotional', channel: 'instagram', status: 'scheduled', messageTemplate: '💐 DIA DAS MÃES 💐 Clareamento + Limpeza com 30% off! Responda MAES.', totalRecipients: 0, sentCount: 0, responseCount: 0, conversionCount: 0 },
  ]

  results.campaigns = { ok: 0, err: 0, errors: [] }
  const campaignIds: string[] = []
  for (const c of campaignsData) {
    try {
      const [inserted] = await db
        .insert(campaigns)
        .values({
          clinicId: cid,
          name: c.name,
          description: c.description,
          campaignType: c.campaignType,
          channel: c.channel,
          status: c.status,
          messageTemplate: c.messageTemplate,
          totalRecipients: c.totalRecipients,
          sentCount: c.sentCount,
          responseCount: c.responseCount,
          conversionCount: c.conversionCount,
          createdBy: userId,
          startedAt: ['running', 'completed', 'paused'].includes(c.status) ? daysAgo(randomInt(5, 30)) : null,
          scheduledAt: c.status === 'scheduled' ? daysFromNow(randomInt(10, 30)) : null,
        })
        .returning({ id: campaigns.id })
      results.campaigns.ok++
      campaignIds.push(inserted.id)
    } catch (err: unknown) {
      results.campaigns.err++
      results.campaigns.errors.push(`${c.name}: ${(err as Error).message}`)
    }
  }

  // ── CAMPAIGN RECIPIENTS ───────────────────────────────────
  const recStatuses = ['sent', 'delivered', 'delivered', 'responded'] as const

  results.campaign_recipients = { ok: 0, err: 0, errors: [] }
  for (const campId of campaignIds) {
    const count = isLargeScenario ? (25 + randomInt(0, 40)) : (10 + randomInt(0, 30))
    for (let j = 0; j < count; j++) {
      try {
        await db.insert(campaignRecipients).values({
          campaignId: campId,
          patientId: randomPick(patientIds),
          status: randomPick(recStatuses),
          sentAt: hoursAgo(randomInt(1, 168)),
          deliveredAt: hoursAgo(randomInt(0, 160)),
        })
        results.campaign_recipients.ok++
      } catch {
        results.campaign_recipients.err++
      }
    }
  }

  // ── WAITLIST ──────────────────────────────────────────────
  const waitlistRows = buildWaitlistSeed({
    clinicId: cid,
    patientIds,
    dentistIds,
    procedureIds,
    scale: isLargeScenario ? 'large' : 'default',
  })

  results.waitlist = { ok: 0, err: 0, errors: [] }
  for (const w of waitlistRows) {
    try {
      await db.insert(waitlist).values(w)
      results.waitlist.ok++
    } catch {
      results.waitlist.err++
    }
  }

  // ── PATIENT FEEDBACK ──────────────────────────────────────
  const feedbackComments = [
    'Excelente atendimento! Equipe muito atenciosa.',
    'Gostei do resultado. Recomendo a clínica.',
    'Bom atendimento, mas a espera foi um pouco longa.',
    'Profissional muito competente e cuidadoso.',
    'Ambiente agradável e moderno. Me senti à vontade.',
    'Ótima experiência, voltarei com certeza.',
    'Tratamento indolor, muito profissional.',
    'Recepção muito simpática e acolhedora.',
  ] as const
  const feedbackChannels = ['whatsapp', 'email', 'in_person'] as const
  const feedbackTypes = ['post_appointment', 'general', 'nps'] as const

  results.patient_feedback = { ok: 0, err: 0, errors: [] }
  for (let i = 0; i < 30; i++) {
    try {
      await db.insert(patientFeedback).values({
        clinicId: cid,
        patientId: randomPick(patientIds),
        feedbackType: randomPick(feedbackTypes),
        rating: randomInt(3, 5),
        npsScore: randomInt(6, 10),
        wouldRecommend: seededRandom() > 0.2,
        comments: randomPick(feedbackComments),
        improvements: seededRandom() > 0.5 ? (['Tempo de espera', 'Estacionamento'] as const) : null,
        collectedAt: hoursAgo(randomInt(1, 720)),
        channel: randomPick(feedbackChannels),
      })
      results.patient_feedback.ok++
    } catch {
      results.patient_feedback.err++
    }
  }

  // ── PROCEDURE GUIDELINES ─────────────────────────────────
  const guidelines: readonly ProcedureGuidelineSeed[] = [
    { procedureName: 'Implante Dentário', title: 'Cuidados Pós-Implante', instructions: 'Mantenha a região limpa com bochechos leves. Evite tocar no local. Use medicação conforme prescrito.', emergencyContact: true, recoveryTimeDays: 7, restrictions: ['Não fazer força na região', 'Evitar alimentos duros por 7 dias', 'Não fumar por 72 horas'], warningSigns: ['Sangramento excessivo', 'Dor intensa após 48h', 'Inchaço progressivo'] },
    { procedureName: 'Aparelho Ortodôntico', title: 'Cuidados com Aparelho', instructions: 'Escove após cada refeição. Use floss ortodôntico diariamente. Evite alimentos pegajosos.', emergencyContact: false, recoveryTimeDays: 0, restrictions: ['Não mascar chiclete', 'Evitar balas duras', 'Cortar frutas em pedaços pequenos'], warningSigns: ['Fio ou brquete solto', 'Fio cortando a bochecha', 'Dor intensa ao morder'] },
    { procedureName: 'Faceta de Porcelana', title: 'Cuidados Pós-Faceta', instructions: 'Evite morder objetos duros. Mantenha higiene normal. Use protetor bucal se pratica esportes.', emergencyContact: false, recoveryTimeDays: 3, restrictions: ['Evitar abrir embalagens com os dentes', 'Não roer unhas', 'Evitar alimentos duros por 3 dias'], warningSigns: ['Faceta solta ou quebrada', 'Sensibilidade extrema ao frio', 'Dor ao morder'] },
    { procedureName: 'Prótese Total', title: 'Adaptação à Prótese', instructions: 'Nos primeiros dias, coma alimentos macios. Leia em voz alta para adaptar a fala. Remova à noite.', emergencyContact: false, recoveryTimeDays: 14, restrictions: ['Não dormir com a prótese', 'Não usar água quente para limpar', 'Evitar adesivo em excesso'], warningSigns: ['Dor intensa que não melhora', 'Feridas na gengiva', 'Prótese não encaixa mais'] },
  ]

  results.procedure_guidelines = { ok: 0, err: 0, errors: [] }
  for (const g of guidelines) {
    try {
      await db.insert(procedureGuidelines).values({ clinicId: cid, ...g, isActive: true })
      results.procedure_guidelines.ok++
    } catch {
      results.procedure_guidelines.err++
    }
  }

  // ── SCHEDULE BLOCKS ────────────────────────────────────────
  const scheduleDays: readonly ScheduleDaySeed[] = [
    { day: 0, start: '08:00:00', end: '12:00:00', avail: false },
    { day: 1, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 2, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 3, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 4, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 5, start: '08:00:00', end: '12:00:00', avail: true },
    { day: 6, start: '00:00:00', end: '00:00:00', avail: false },
  ]

  results.schedule_blocks = { ok: 0, err: 0, errors: [] }
  for (const did of dentistIds) {
    for (const s of scheduleDays) {
      try {
        await db.insert(scheduleBlocks).values({
          clinicId: cid,
          dentistId: did,
          dayOfWeek: s.day,
          startTime: s.start,
          endTime: s.end,
          isAvailable: s.avail,
        })
        results.schedule_blocks.ok++
      } catch {
        results.schedule_blocks.err++
      }
    }
  }

  // ── FOLLOW-UP CONFIGS ──────────────────────────────────────
  const fuConfigs = [
    { configType: 'post_consultation', delayHours: 24, messageTemplate: 'Olá {{patient_name}}! Como está após sua consulta de {{procedure}}? Estamos aqui se precisar!', isActive: true },
    { configType: 'post_consultation', delayHours: 168, messageTemplate: 'Olá {{patient_name}}! Já faz 7 dias desde sua consulta. Tudo bem? Agende um retorno se necessário.', isActive: true },
    { configType: 'return_reminder', delayDays: 2, messageTemplate: 'Olá {{patient_name}}! Notamos que você não compareceu à consulta. Deseja reagendar?', isActive: true },
    { configType: 'return_reminder', delayMonths: 6, procedureName: 'Limpeza', messageTemplate: 'Olá {{patient_name}}! Sentimos sua falta! Que tal agendar uma revisão?', isActive: true },
  ] as const

  results.follow_up_configs = { ok: 0, err: 0, errors: [] }
  for (const fc of fuConfigs) {
    try {
      await db.insert(followUpConfigs).values({ clinicId: cid, ...fc })
      results.follow_up_configs.ok++
    } catch {
      results.follow_up_configs.err++
    }
  }

  // ── APPOINTMENTS ───────────────────────────────────────────
  const appointmentNotes: readonly (string | null)[] = [
    'Primeira consulta do paciente', 'Retorno para acompanhamento',
    'Avaliação inicial', 'Procedimento agendado pelo WhatsApp',
    'Urgência — dor relatada', 'Check-up de rotina',
    'Retorno pós-cirúrgico', 'Paciente solicitou horário cedo',
    null, null, null,
  ]


  results.appointments = { ok: 0, err: 0, errors: [] }
  const dayOffsets = [-3, -2, -1, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7]
  const usedSlots = new Map<string, true>()

  for (const dayOffset of dayOffsets) {
    if (dentistIds.length === 0 || patientIds.length === 0) break

    for (const dentistId of dentistIds) {
      const countThisDay = 2 + randomInt(0, 2)
      // Keep deterministic seed appointments non-overlapping even for 120-minute procedures.
      const seedAppointmentTimes = ['08:00', '10:00', '13:00', '15:00']
      const dayTimeSlots = seedAppointmentTimes.slice(0, countThisDay)

      for (const time of dayTimeSlots) {
        const key = slotKey(dentistId, dayOffset, time)
        if (usedSlots.has(key)) continue
        usedSlots.set(key, true)

        const procedureId = randomPick(procedureIds)
        const procInfo = procMap.get(procedureId)
        const duration = procInfo?.durationMinutes || 30

        let status: string
        if (dayOffset < 0) {
          const pastStatuses = ['completed', 'completed', 'completed', 'completed', 'cancelled', 'no_show'] as const
          status = randomPick(pastStatuses)
        } else if (dayOffset === 0) {
          const todayStatuses = ['confirmed', 'confirmed', 'scheduled', 'in_progress'] as const
          status = randomPick(todayStatuses)
        } else {
          const futureStatuses = ['scheduled', 'scheduled', 'confirmed', 'confirmed'] as const
          status = randomPick(futureStatuses)
        }

        const patientId = randomPick(patientIds)
        const note = randomPick(appointmentNotes)

        try {
          await appointmentRepo.create({
            clinicId: cid,
            patientId,
            dentistId,
            procedureId,
            scheduledAt: makeDate(dayOffset, time),
            durationMinutes: duration,
            notes: note,
          })
          results.appointments.ok++
        } catch (err: unknown) {
          results.appointments.err++
          results.appointments.errors.push(`${dayOffset}d ${time}: ${(err as Error).message}`)
        }
      }
    }
  }

  // ── UPDATE PATIENT last_visit_at ──────────────────────────
  // Populate from completed appointments so inactive-patient pages show data
  try {
    await db.execute(`
      UPDATE patients SET last_visit_at = (
        SELECT MAX(a.scheduled_at) FROM appointments a
        WHERE a.patient_id = patients.id AND a.status = 'completed' AND a.clinic_id = patients.clinic_id
      ) WHERE patients.clinic_id = '${cid.replace(/'/g, "''")}' AND EXISTS (
        SELECT 1 FROM appointments a2 WHERE a2.patient_id = patients.id
        AND a2.status = 'completed' AND a2.clinic_id = patients.clinic_id
      )
    `)
  } catch { /* non-critical */ }

  // ── SUMMARY ───────────────────────────────────────────────
  const summary: Record<string, number> = {}
  for (const [k, v] of Object.entries(results)) {
    summary[k] = v.ok
  }

  const fixtures = {
    clinic: 1,
    admin: userId ? 1 : 0,
    dentists: dentistIds.length,
    procedures: procedureIds.length,
    patients: patientIds.length,
    pipeline_stages: pipelineRows.length,
    leads: summary.leads ?? 0,
    campaigns: summary.campaigns ?? 0,
    appointments: summary.appointments ?? 0,
  }
  const requiredFixtures = ['clinic', 'admin', 'dentists', 'procedures', 'patients', 'pipeline_stages', 'leads', 'campaigns', 'appointments'] as const
  const missingFixtures = requiredFixtures.filter((name) => fixtures[name] < 1)
  const failures = Object.entries(results)
    .filter(([, result]) => result.err > 0 || result.errors.length > 0)
    .map(([domain, result]) => ({ domain, count: result.err, errors: result.errors }))
  if (missingFixtures.length > 0 || failures.length > 0) {
    return NextResponse.json({
      success: false,
      error: 'E2E fixture seed incomplete',
      missingFixtures,
      failures,
      results,
      summary,
      fixtures,
    }, { status: 500 })
  }
  return NextResponse.json({ success: true, results, summary, fixtures })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    // Short one-line diagnostic (no stack/secrets); dev-only route guarded by SEED_SECRET.
    const reason = message.split('\n')[0].trim().slice(0, 160)
    return NextResponse.json({
      success: false,
      error: 'E2E fixture seed failed',
      reason,
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}