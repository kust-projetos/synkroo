/**
 * Seed helpers — deterministic builders for demo seed data.
 * Separated from route to keep route exports clean for Next.js type checking.
 */

import { eq } from 'drizzle-orm'
import { appointments, campaigns, campaignRecipients, leads, leadActivities, waitlist, patientFeedback, procedureGuidelines, followUpConfigs } from '@/lib/db/schema'
// ── Types ───────────────────────────────────────

export interface LeadSeed {
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

// ── Helpers ─────────────────────────────────────

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000)
}

/** Build deterministic waitlist entries. */
export function buildWaitlistSeed(params: {
  clinicId: string
  patientIds: string[]
  dentistIds: string[]
  procedureIds: string[]
  scale: 'default' | 'large'
}) {
  const count = params.scale === 'large' ? 48 : 15
  const statuses = ['waiting', 'waiting', 'waiting', 'notified', 'scheduled', 'expired', 'cancelled'] as const
  const prefTimes = ['08:00:00', '09:00:00', '10:00:00', '11:00:00', '13:00:00', '14:00:00', '15:00:00', '16:00:00'] as const

  return Array.from({ length: count }, (_, i) => {
    const preferredTimeStart = prefTimes[i % prefTimes.length]
    const startHour = Number(preferredTimeStart.slice(0, 2))
    return {
      clinicId: params.clinicId,
      patientId: params.patientIds[i % params.patientIds.length],
      dentistId: params.dentistIds[i % params.dentistIds.length] ?? null,
      procedureId: params.procedureIds[i % params.procedureIds.length] ?? null,
      preferredDate: daysFromNow((i % 18) - 2),
      preferredTimeStart,
      preferredTimeEnd: `${String(Math.min(startHour + 3, 18)).padStart(2, '0')}:00:00`,
      priority: (i % 10) + 1,
      status: statuses[i % statuses.length],
      notes: `Seed waitlist ${i + 1}`,
    }
  })
}

/** Build deterministic leads. */
export function buildLeadSeed(scale: 'default' | 'large'): LeadSeed[] {
  const base: LeadSeed[] = [
    { name: 'Registro Demo 57', phone: '11977770031', email: 'renata.albuquerque@example.com', source: 'referral', status: 'proposal', temperature: 'hot', score: 82, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Proposta enviada ontem', contact_count: 3 },
    { name: 'Marcos Vinícius', phone: '11977770032', email: 'marcos.vinicius@example.com', source: 'whatsapp', status: 'negotiation', temperature: 'hot', score: 88, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Negociando valor', contact_count: 4 },
    { name: 'Registro Demo 11', phone: '11977770033', email: 'carla.augusta@example.com', source: 'instagram', status: 'qualified', temperature: 'hot', score: 79, interest: 'Clareamento', has_budget: true, has_timeline: false, notes: 'Quer fazer antes do casamento', contact_count: 2 },
    { name: 'Registro Demo 29', phone: '11977770034', email: 'felipe.stern@example.com', source: 'web', status: 'proposal', temperature: 'hot', score: 85, interest: 'Faceta de Porcelana', has_budget: true, has_timeline: true, notes: 'Orçamento aprovado', contact_count: 3 },
    { name: 'Registro Demo 38', phone: '11977770035', email: 'juliana.marselha@example.com', source: 'referral', status: 'negotiation', temperature: 'hot', score: 90, interest: 'Prótese Total', has_budget: true, has_timeline: true, notes: 'Fechando nesta semana', contact_count: 5 },
    { name: 'Registro Demo 59', phone: '11977770036', email: 'rodrigo.barreto@example.com', source: 'web', status: 'contacted', temperature: 'warm', score: 55, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Primeiro contato', contact_count: 1 },
    { name: 'Registro Demo 60', phone: '11977770037', email: 'simone.ferraz@example.com', source: 'instagram', status: 'new', temperature: 'warm', score: 48, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Curtiu vários posts', contact_count: 0 },
    { name: 'Tomás Pacheco', phone: '11977770038', email: 'tomas.pacheco@example.com', source: 'whatsapp', status: 'qualified', temperature: 'warm', score: 62, interest: 'Tratamento de Canal', has_budget: true, has_timeline: false, notes: 'Com dor, comparando preços', contact_count: 2 },
    { name: 'Úrsula Diniz', phone: '11977770039', email: 'ursula.diniz@example.com', source: 'referral', status: 'contacted', temperature: 'warm', score: 58, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: true, notes: 'Filha precisa de aparelho', contact_count: 1 },
    { name: 'Registro Demo 64', phone: '11977770040', email: 'vinicius.leal@example.com', source: 'web', status: 'new', temperature: 'warm', score: 45, interest: 'Extração de Siso', has_budget: false, has_timeline: true, notes: 'Formulário preenchido ontem', contact_count: 0 },
    { name: 'Registro Demo 65', phone: '11977770041', email: 'wanda.cruz@example.com', source: 'instagram', status: 'contacted', temperature: 'warm', score: 52, interest: 'Coroa de Porcelana', has_budget: false, has_timeline: false, notes: 'Segunda tentativa de contato', contact_count: 2 },
    { name: 'Registro Demo 66', phone: '11977770042', email: 'xavier.borges@example.com', source: 'whatsapp', status: 'qualified', temperature: 'warm', score: 60, interest: 'Implante Dentário', has_budget: true, has_timeline: false, notes: 'Tem orçamento, avaliando', contact_count: 2 },
    { name: 'Registro Demo 67', phone: '11977770043', email: 'yasmin.fontes@example.com', source: 'web', status: 'contacted', temperature: 'warm', score: 50, interest: 'Restauração Estética', has_budget: false, has_timeline: true, notes: 'Precisa urgente', contact_count: 1 },
    { name: 'Registro Demo 68', phone: '11977770044', email: 'zeca.nogueira@example.com', source: 'referral', status: 'new', temperature: 'warm', score: 47, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Indicado por paciente', contact_count: 0 },
    { name: 'Registro Demo 3', phone: '11977770045', email: 'adriana.teles@example.com', source: 'instagram', status: 'contacted', temperature: 'warm', score: 54, interest: 'Lente de Contato Dental', has_budget: false, has_timeline: false, notes: 'Interesse em estética', contact_count: 1 },
    { name: 'Registro Demo 8', phone: '11977770046', email: 'bernardo.rocha@example.com', source: 'web', status: 'new', temperature: 'cold', score: 22, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Só consultou preço', contact_count: 0 },
    { name: 'Cláudia Ribeiro', phone: '11977770047', email: 'claudia.ribeiro@example.com', source: 'instagram', status: 'new', temperature: 'cold', score: 18, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Sem urgência', contact_count: 0 },
    { name: 'Registro Demo 19', phone: '11977770048', email: 'danilo.esteves@example.com', source: 'whatsapp', status: 'contacted', temperature: 'cold', score: 28, interest: 'Restauração', has_budget: false, has_timeline: false, notes: 'Não respondeu', contact_count: 1 },
    { name: 'Registro Demo 25', phone: '11977770049', email: 'elisa.marques@example.com', source: 'web', status: 'new', temperature: 'cold', score: 15, interest: 'Implante Dentário', has_budget: false, has_timeline: false, notes: 'Orçamento muito alto', contact_count: 0 },
    { name: 'Registro Demo 31', phone: '11977770050', email: 'fernando.gil@example.com', source: 'instagram', status: 'contacted', temperature: 'cold', score: 25, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: false, notes: 'Disse que vai pensar', contact_count: 1 },
    { name: 'Registro Demo 33', phone: '11977770051', email: 'gisela.porto@example.com', source: 'web', status: 'new', temperature: 'cold', score: 20, interest: 'Extração de Siso', has_budget: false, has_timeline: false, notes: 'Sem urgência', contact_count: 0 },
    { name: 'Registro Demo 34', phone: '11977770052', email: 'humberto.tavares@example.com', source: 'whatsapp', status: 'new', temperature: 'cold', score: 12, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Mensagem genérica', contact_count: 0 },
    { name: 'Registro Demo 35', phone: '11977770053', email: 'irene.bastos@example.com', source: 'instagram', status: 'contacted', temperature: 'cold', score: 30, interest: 'Profilaxia', has_budget: false, has_timeline: false, notes: 'Sem interesse real', contact_count: 2 },
    { name: 'José Renato', phone: '11977770054', email: 'jose.renato@example.com', source: 'referral', status: 'converted', temperature: 'hot', score: 95, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Convertido! Agendado', contact_count: 4 },
    { name: 'Registro Demo 40', phone: '11977770055', email: 'kelly.sampaio@example.com', source: 'instagram', status: 'converted', temperature: 'hot', score: 88, interest: 'Clareamento', has_budget: true, has_timeline: true, notes: 'Fechou clareamento', contact_count: 3 },
    { name: 'Registro Demo 41', phone: '11977770056', email: 'leonardo.faria@example.com', source: 'whatsapp', status: 'converted', temperature: 'hot', score: 91, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Fechou aparelho estético', contact_count: 3 },
    { name: 'Registro Demo 49', phone: '11977770057', email: 'marina.luz@example.com', source: 'web', status: 'converted', temperature: 'hot', score: 87, interest: 'Restauração Estética', has_budget: true, has_timeline: true, notes: 'Convertido pelo site', contact_count: 2 },
    { name: 'Registro Demo 50', phone: '11977770058', email: 'nathalia.cunha@example.com', source: 'whatsapp', status: 'lost', temperature: 'warm', score: 38, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: false, notes: 'Escolheu outra clínica', contact_count: 3, lost_reason: 'Escolheu concorrente' },
    { name: 'Otávio Mendes', phone: '11977770059', email: 'otavio.mendes@example.com', source: 'web', status: 'lost', temperature: 'cold', score: 20, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Sem resposta após 3 tentativas', contact_count: 3, lost_reason: 'Sem resposta' },
    { name: 'Patrícia Gomes', phone: '11977770060', email: 'patricia.gomes@example.com', source: 'instagram', status: 'lost', temperature: 'warm', score: 35, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Desistiu por preço', contact_count: 2, lost_reason: 'Preço alto' },
  ]

  if (scale !== 'large') return base

  const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'] as const
  const temperatures = ['cold', 'warm', 'hot'] as const
  const sources = ['whatsapp', 'instagram', 'web', 'referral', 'campaign'] as const

  const extra = Array.from({ length: 96 }, (_, i) => ({
    name: `Lead Demo ${i + 1}`,
    phone: `11988${String(100000 + i).slice(-6)}`,
    email: `lead.demo.${i + 1}@example.com`,
    source: sources[i % sources.length],
    status: statuses[i % statuses.length],
    temperature: temperatures[i % temperatures.length],
    score: 20 + (i % 80),
    interest: ['Implante Dentário', 'Clareamento', 'Aparelho Ortodôntico', 'Limpeza Profissional'][i % 4],
    has_budget: i % 2 === 0,
    has_timeline: i % 3 !== 0,
    notes: `Lead large seed ${i + 1}`,
    contact_count: i % 5,
    lost_reason: statuses[i % statuses.length] === 'lost' ? 'Sem resposta' : undefined,
  }))

  return [...base, ...extra]
}

/** Idempotent cleanup of demo-owned seed tables for a clinic. */
export async function cleanupDemoSeedTables(db: any, clinicId: string) {
  // Seed appointments are owned by this deterministic fixture; clear them first so reruns are idempotent.
  await db.delete(appointments).where(eq(appointments.clinicId, clinicId))
  // Delete children before parents to respect FK constraints
  const campRows = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.clinicId, clinicId))
  const campIds: string[] = campRows.map((r: any) => r.id)
  for (const cid2 of campIds) {
    try { await db.delete(campaignRecipients).where(eq(campaignRecipients.campaignId, cid2)) } catch { /* OK */ }
  }
  await db.delete(campaigns).where(eq(campaigns.clinicId, clinicId))

  const leadRows = await db.select({ id: leads.id }).from(leads).where(eq(leads.clinicId, clinicId))
  const leadIdList: string[] = leadRows.map((r: any) => r.id)
  for (const lid of leadIdList) {
    try { await db.delete(leadActivities).where(eq(leadActivities.leadId, lid)) } catch { /* OK */ }
  }
  await db.delete(leads).where(eq(leads.clinicId, clinicId))

  await db.delete(waitlist).where(eq(waitlist.clinicId, clinicId))
  await db.delete(patientFeedback).where(eq(patientFeedback.clinicId, clinicId))
  await db.delete(procedureGuidelines).where(eq(procedureGuidelines.clinicId, clinicId))
  await db.delete(followUpConfigs).where(eq(followUpConfigs.clinicId, clinicId))
}

/** Map lead status to pipeline stage position for stageId assignment. */
export function leadStatusToStageIndex(status: string): number {
  const map: Record<string, number> = {
    new: 0, contacted: 1, qualified: 2, proposal: 3,
    negotiation: 4, converted: 5, lost: 6,
  }
  return map[status] ?? 0
}
