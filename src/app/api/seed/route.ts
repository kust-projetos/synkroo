import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { clinics, users, leads, leadActivities, campaigns, campaignRecipients, waitlist, patientFeedback, procedureGuidelines, scheduleBlocks, followUpConfigs } from '@/lib/db/schema'
import * as dentistRepo from '@/repositories/dentists'
import * as procedureRepo from '@/repositories/procedures'
import * as patientRepo from '@/repositories/patients'
import * as appointmentRepo from '@/repositories/appointments'

const CLINIC_SLUG = 'clinica-demo'

// ── Seed result types ─────────────────────────────────────────

interface DomainResult {
  ok: number
  err: number
  errors: string[]
}

// ── Seed data types ──────────────────────────────────────────

interface LeadSeed {
  name: string
  phone: string
  email: string
  source: string
  status: string
  temperature: string
  score: number
  interest: string
  has_budget: boolean
  has_timeline: boolean
  notes: string
  contact_count: number
  lost_reason?: string
}

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

function randomPick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
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
  const secret = request.nextUrl.searchParams.get('secret')
  const seedSecret = process.env.SEED_SECRET
  if (!seedSecret) {
    return NextResponse.json({ error: 'SEED_SECRET not configured' }, { status: 403 })
  }
  if (secret !== seedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, DomainResult> = {}
  const db = getDb()

  // Get clinic
  const clinicRows = await db.select({ id: clinics.id }).from(clinics).where(eq(clinics.slug, CLINIC_SLUG)).limit(1)
  const clinic = clinicRows[0]
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
  const cid: string = clinic.id

  // Get admin user
  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.clinicId, cid)).limit(1)
  const admin = userRows[0]
  const userId: string | undefined = admin?.id

  // Get existing data IDs
  const dentistRows = await dentistRepo.findByClinic(cid, { activeOnly: true })
  const dentistIds: string[] = dentistRows.map((d) => d.id)
  const procedureRows = await procedureRepo.findByClinic(cid, { activeOnly: true })
  const procedureIds: string[] = procedureRows.map((p) => p.id)
  const patientRows = await patientRepo.findByClinic(cid)
  const patientIds: string[] = patientRows.map((p) => p.id)
  const procMap = new Map(procedureRows.map((p) => [p.id, p]))

  // ── LEADS ─────────────────────────────────────────────────
  const leadsData: readonly LeadSeed[] = [
    { name: 'Renata Albuquerque', phone: '11977770031', email: 'renata.albuquerque@email.com', source: 'referral', status: 'proposal', temperature: 'hot', score: 82, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Proposta enviada ontem', contact_count: 3 },
    { name: 'Marcos Vinícius', phone: '11977770032', email: 'marcos.vinicius@email.com', source: 'whatsapp', status: 'negotiation', temperature: 'hot', score: 88, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Negociando valor', contact_count: 4 },
    { name: 'Carla Augusta', phone: '11977770033', email: 'carla.augusta@email.com', source: 'instagram', status: 'qualified', temperature: 'hot', score: 79, interest: 'Clareamento', has_budget: true, has_timeline: false, notes: 'Quer fazer antes do casamento', contact_count: 2 },
    { name: 'Felipe Stern', phone: '11977770034', email: 'felipe.stern@email.com', source: 'web', status: 'proposal', temperature: 'hot', score: 85, interest: 'Faceta de Porcelana', has_budget: true, has_timeline: true, notes: 'Orçamento aprovado', contact_count: 3 },
    { name: 'Juliana Marselha', phone: '11977770035', email: 'juliana.marselha@email.com', source: 'referral', status: 'negotiation', temperature: 'hot', score: 90, interest: 'Prótese Total', has_budget: true, has_timeline: true, notes: 'Fechando nesta semana', contact_count: 5 },
    { name: 'Rodrigo Barreto', phone: '11977770036', email: 'rodrigo.barreto@email.com', source: 'web', status: 'contacted', temperature: 'warm', score: 55, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Primeiro contato', contact_count: 1 },
    { name: 'Simone Ferraz', phone: '11977770037', email: 'simone.ferraz@email.com', source: 'instagram', status: 'new', temperature: 'warm', score: 48, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Curtiu vários posts', contact_count: 0 },
    { name: 'Tomás Pacheco', phone: '11977770038', email: 'tomas.pacheco@email.com', source: 'whatsapp', status: 'qualified', temperature: 'warm', score: 62, interest: 'Tratamento de Canal', has_budget: true, has_timeline: false, notes: 'Com dor, comparando preços', contact_count: 2 },
    { name: 'Úrsula Diniz', phone: '11977770039', email: 'ursula.diniz@email.com', source: 'referral', status: 'contacted', temperature: 'warm', score: 58, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: true, notes: 'Filha precisa de aparelho', contact_count: 1 },
    { name: 'Vinicius Leal', phone: '11977770040', email: 'vinicius.leal@email.com', source: 'web', status: 'new', temperature: 'warm', score: 45, interest: 'Extração de Siso', has_budget: false, has_timeline: true, notes: 'Formulário preenchido ontem', contact_count: 0 },
    { name: 'Wanda Cruz', phone: '11977770041', email: 'wanda.cruz@email.com', source: 'instagram', status: 'contacted', temperature: 'warm', score: 52, interest: 'Coroa de Porcelana', has_budget: false, has_timeline: false, notes: 'Segunda tentativa de contato', contact_count: 2 },
    { name: 'Xavier Borges', phone: '11977770042', email: 'xavier.borges@email.com', source: 'whatsapp', status: 'qualified', temperature: 'warm', score: 60, interest: 'Implante Dentário', has_budget: true, has_timeline: false, notes: 'Tem orçamento, avaliando', contact_count: 2 },
    { name: 'Yasmin Fontes', phone: '11977770043', email: 'yasmin.fontes@email.com', source: 'web', status: 'contacted', temperature: 'warm', score: 50, interest: 'Restauração Estética', has_budget: false, has_timeline: true, notes: 'Precisa urgente', contact_count: 1 },
    { name: 'Zeca Nogueira', phone: '11977770044', email: 'zeca.nogueira@email.com', source: 'referral', status: 'new', temperature: 'warm', score: 47, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Indicado por paciente', contact_count: 0 },
    { name: 'Adriana Teles', phone: '11977770045', email: 'adriana.teles@email.com', source: 'instagram', status: 'contacted', temperature: 'warm', score: 54, interest: 'Lente de Contato Dental', has_budget: false, has_timeline: false, notes: 'Interesse em estética', contact_count: 1 },
    { name: 'Bernardo Rocha', phone: '11977770046', email: 'bernardo.rocha@email.com', source: 'web', status: 'new', temperature: 'cold', score: 22, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Só consultou preço', contact_count: 0 },
    { name: 'Cláudia Ribeiro', phone: '11977770047', email: 'claudia.ribeiro@email.com', source: 'instagram', status: 'new', temperature: 'cold', score: 18, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Sem urgência', contact_count: 0 },
    { name: 'Danilo Esteves', phone: '11977770048', email: 'danilo.esteves@email.com', source: 'whatsapp', status: 'contacted', temperature: 'cold', score: 28, interest: 'Restauração', has_budget: false, has_timeline: false, notes: 'Não respondeu', contact_count: 1 },
    { name: 'Elisa Marques', phone: '11977770049', email: 'elisa.marques@email.com', source: 'web', status: 'new', temperature: 'cold', score: 15, interest: 'Implante Dentário', has_budget: false, has_timeline: false, notes: 'Orçamento muito alto', contact_count: 0 },
    { name: 'Fernando Gil', phone: '11977770050', email: 'fernando.gil@email.com', source: 'instagram', status: 'contacted', temperature: 'cold', score: 25, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: false, notes: 'Disse que vai pensar', contact_count: 1 },
    { name: 'Gisela Porto', phone: '11977770051', email: 'gisela.porto@email.com', source: 'web', status: 'new', temperature: 'cold', score: 20, interest: 'Extração de Siso', has_budget: false, has_timeline: false, notes: 'Sem urgência', contact_count: 0 },
    { name: 'Humberto Tavares', phone: '11977770052', email: 'humberto.tavares@email.com', source: 'whatsapp', status: 'new', temperature: 'cold', score: 12, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Mensagem genérica', contact_count: 0 },
    { name: 'Irene Bastos', phone: '11977770053', email: 'irene.bastos@email.com', source: 'instagram', status: 'contacted', temperature: 'cold', score: 30, interest: 'Profilaxia', has_budget: false, has_timeline: false, notes: 'Sem interesse real', contact_count: 2 },
    { name: 'José Renato', phone: '11977770054', email: 'jose.renato@email.com', source: 'referral', status: 'converted', temperature: 'hot', score: 95, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Convertido! Agendado', contact_count: 4 },
    { name: 'Kelly Sampaio', phone: '11977770055', email: 'kelly.sampaio@email.com', source: 'instagram', status: 'converted', temperature: 'hot', score: 88, interest: 'Clareamento', has_budget: true, has_timeline: true, notes: 'Fechou clareamento', contact_count: 3 },
    { name: 'Leonardo Faria', phone: '11977770056', email: 'leonardo.faria@email.com', source: 'whatsapp', status: 'converted', temperature: 'hot', score: 91, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Fechou aparelho estético', contact_count: 3 },
    { name: 'Marina Luz', phone: '11977770057', email: 'marina.luz@email.com', source: 'web', status: 'converted', temperature: 'hot', score: 87, interest: 'Restauração Estética', has_budget: true, has_timeline: true, notes: 'Convertido pelo site', contact_count: 2 },
    { name: 'Nathalia Cunha', phone: '11977770058', email: 'nathalia.cunha@email.com', source: 'whatsapp', status: 'lost', temperature: 'warm', score: 38, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: false, notes: 'Escolheu outra clínica', contact_count: 3, lost_reason: 'Escolheu concorrente' },
    { name: 'Otávio Mendes', phone: '11977770059', email: 'otavio.mendes@email.com', source: 'web', status: 'lost', temperature: 'cold', score: 20, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Sem resposta após 3 tentativas', contact_count: 3, lost_reason: 'Sem resposta' },
    { name: 'Patrícia Gomes', phone: '11977770060', email: 'patricia.gomes@email.com', source: 'instagram', status: 'lost', temperature: 'warm', score: 35, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Desistiu por preço', contact_count: 2, lost_reason: 'Preço alto' },
  ]

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
    const count = 10 + randomInt(0, 30)
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
  const prefTimes = ['08:00:00', '09:00:00', '10:00:00', '11:00:00', '13:00:00', '14:00:00', '15:00:00', '16:00:00'] as const

  results.waitlist = { ok: 0, err: 0, errors: [] }
  for (let i = 0; i < 15; i++) {
    const prefStart = randomPick(prefTimes)
    const startH = parseInt(prefStart.split(':')[0])
    const endH = Math.min(startH + 4, 18)
    try {
      await db.insert(waitlist).values({
        clinicId: cid,
        patientId: randomPick(patientIds),
        dentistId: randomPick(dentistIds),
        preferredDate: daysFromNow(1 + randomInt(0, 14)),
        preferredTimeStart: prefStart,
        preferredTimeEnd: `${String(endH).padStart(2, '0')}:00:00`,
        priority: randomInt(1, 5),
        status: 'waiting',
        notes: 'Paciente aguardando vaga',
      })
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
        wouldRecommend: Math.random() > 0.2,
        comments: randomPick(feedbackComments),
        improvements: Math.random() > 0.5 ? (['Tempo de espera', 'Estacionamento'] as const) : null,
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

  const timeSlots: string[] = []
  for (let h = 8; h <= 17; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 18) timeSlots.push(`${String(h).padStart(2, '0')}:30`)
  }

  results.appointments = { ok: 0, err: 0, errors: [] }
  const dayOffsets = [-3, -2, -1, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3, 4, 5, 6, 7]
  const usedSlots = new Map<string, true>()

  for (const dayOffset of dayOffsets) {
    if (dentistIds.length === 0 || patientIds.length === 0) break

    for (const dentistId of dentistIds) {
      const countThisDay = 2 + randomInt(0, 2)
      const shuffled = [...timeSlots].sort(() => Math.random() - 0.5)
      const dayTimeSlots = shuffled.slice(0, Math.min(countThisDay, shuffled.length))

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

  // ── SUMMARY ───────────────────────────────────────────────
  const summary: Record<string, number> = {}
  for (const [k, v] of Object.entries(results)) {
    summary[k] = v.ok
  }

  return NextResponse.json({ success: true, results, summary })
}