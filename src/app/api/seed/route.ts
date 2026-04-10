import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service role client - bypasses RLS for seeding
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const CLINIC_SLUG = 'clinica-demo'

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600000).toISOString()
}
function daysAgo(d: number) {
  return new Date(Date.now() - d * 86400000).toISOString()
}
function daysFromNow(d: number) {
  return new Date(Date.now() + d * 86400000).toISOString()
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret !== 'synkroo-seed-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, { ok: number; err: number; errors: string[] }> = {}

  // Get clinic
  const { data: clinic } = await supabase.from('clinics').select('id').eq('slug', CLINIC_SLUG).single()
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })
  const cid = clinic.id

  // Get admin user
  const { data: admin } = await supabase.from('users').select('id').eq('clinic_id', cid).limit(1).single()
  const userId = admin?.id

  // Get existing data IDs
  const { data: dentists } = await supabase.from('dentists').select('id').eq('clinic_id', cid).eq('is_active', true)
  const dentistIds = dentists?.map(d => d.id) || []
  const { data: procedures } = await supabase.from('procedures').select('id').eq('clinic_id', cid).eq('is_active', true)
  const procedureIds = procedures?.map(p => p.id) || []
  const { data: patients } = await supabase.from('patients').select('id').eq('clinic_id', cid)
  const patientIds = patients?.map(p => p.id) || []

  // === LEADS (30) ===
  const leadsData = [
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
    const { data, error } = await supabase.from('leads').insert({
      clinic_id: cid,
      ...l,
      last_contact_at: l.contact_count > 0 ? hoursAgo(randomInt(1, 240)) : null,
      next_followup_at: ['converted', 'lost'].includes(l.status) ? null : daysFromNow(randomInt(1, 14)),
      converted_at: l.status === 'converted' ? hoursAgo(randomInt(12, 96)) : null,
    }).select('id').single()
    if (error) { results.leads.err++; results.leads.errors.push(`${l.name}: ${error.message}`) }
    else { results.leads.ok++; leadIds.push(data.id) }
  }

  // === LEAD ACTIVITIES (~100+) ===
  const actTypes = ['call', 'email', 'whatsapp', 'note', 'meeting', 'proposal_sent']
  const actDescs = [
    'Tentativa de contato por telefone', 'Email enviado com proposta comercial',
    'Mensagem via WhatsApp enviada', 'Nota interna adicionada',
    'Reunião realizada na clínica', 'Proposta comercial enviada',
    'Retorno de ligação recebido', 'Follow-up por email',
    'Ligação atendida - cliente interessado', 'Orçamento detalhado enviado',
    'Cliente pediu mais tempo para decidir', 'Indicação recebida de outro paciente',
    'Agendamento de avaliação confirmado', 'Cliente pediu desconto',
  ]
  results.lead_activities = { ok: 0, err: 0, errors: [] }
  for (const lid of leadIds) {
    const count = 2 + randomInt(0, 3)
    for (let j = 0; j < count; j++) {
      const { error } = await supabase.from('lead_activities').insert({
        lead_id: lid,
        activity_type: randomPick(actTypes),
        description: randomPick(actDescs),
        performed_at: hoursAgo(j * randomInt(1, 48)),
      })
      if (error) results.lead_activities.err++; else results.lead_activities.ok++
    }
  }

  // === CAMPAIGNS (7) ===
  const campaignsData = [
    { name: 'Black Novembro - Implantes', description: 'Promoção black friday para implantes com 40% off', campaign_type: 'promotional', channel: 'whatsapp', status: 'draft', message_template: '🖤 BLACK FRIDAY 🖤 Implante com 40% de desconto! De R$ 4.500 por R$ 2.700. Responda IMPLANTE para agendar.', total_recipients: 0, sent_count: 0, response_count: 0, conversion_count: 0 },
    { name: 'Volta às Aulas - Jovens', description: 'Campanha para jovens com desconto em aparelho', campaign_type: 'promotional', channel: 'instagram', status: 'scheduled', message_template: '📚 VOLTA ÀS AULAS 📚 Aparelho ortodôntico com entrada facilitada! Parcelamos em até 18x.', total_recipients: 0, sent_count: 0, response_count: 0, conversion_count: 0 },
    { name: 'Aniversariantes do Mês', description: 'Desconto para pacientes aniversariantes', campaign_type: 'promotional', channel: 'whatsapp', status: 'running', message_template: '🎂 FELIZ ANIVERSÁRIO! 🎂 25% de desconto em procedimentos estéticos! Responda ANIVERSARIO.', total_recipients: 30, sent_count: 18, response_count: 6, conversion_count: 2 },
    { name: 'Pós-Tratamento Canal', description: 'Follow-up pós-canal', campaign_type: 'follow_up', channel: 'whatsapp', status: 'running', message_template: 'Olá {{patient_name}}! Como está após o tratamento de canal? Se tiver desconforto, entre em contato!', total_recipients: 15, sent_count: 12, response_count: 8, conversion_count: 0 },
    { name: 'Reativação Q1', description: 'Reativar pacientes inativos', campaign_type: 'reactivation', channel: 'whatsapp', status: 'paused', message_template: 'Olá {{patient_name}}! Sentimos sua falta! 💙 Responda VOLTAR para desconto exclusivo!', total_recipients: 40, sent_count: 10, response_count: 2, conversion_count: 1 },
    { name: 'Pesquisa de Satisfação Q1', description: 'Coletar feedback Q1', campaign_type: 'follow_up', channel: 'whatsapp', status: 'completed', message_template: 'Olá {{patient_name}}! Responda nossa pesquisa rápida (1 min) e concorra a uma limpeza gratuita!', total_recipients: 90, sent_count: 85, response_count: 52, conversion_count: 0 },
    { name: 'Dia das Mães - Estética', description: 'Promoção Dia das Mães', campaign_type: 'promotional', channel: 'instagram', status: 'scheduled', message_template: '💐 DIA DAS MÃES 💐 Clareamento + Limpeza com 30% off! Responda MAES.', total_recipients: 0, sent_count: 0, response_count: 0, conversion_count: 0 },
  ]

  results.campaigns = { ok: 0, err: 0, errors: [] }
  const campaignIds: string[] = []
  for (const c of campaignsData) {
    const { data, error } = await supabase.from('campaigns').insert({
      clinic_id: cid,
      ...c,
      created_by: userId,
      started_at: ['running', 'completed', 'paused'].includes(c.status) ? daysAgo(randomInt(5, 30)) : null,
      scheduled_at: c.status === 'scheduled' ? daysFromNow(randomInt(10, 30)) : null,
    }).select('id').single()
    if (error) { results.campaigns.err++; results.campaigns.errors.push(`${c.name}: ${error.message}`) }
    else { results.campaigns.ok++; campaignIds.push(data.id) }
  }

  // === CAMPAIGN RECIPIENTS (~185+) ===
  results.campaign_recipients = { ok: 0, err: 0, errors: [] }
  const recStatuses = ['sent', 'delivered', 'delivered', 'responded']
  for (const campId of campaignIds) {
    const count = 10 + randomInt(0, 30)
    for (let j = 0; j < count; j++) {
      const { error } = await supabase.from('campaign_recipients').insert({
        campaign_id: campId,
        patient_id: randomPick(patientIds),
        status: randomPick(recStatuses),
        sent_at: hoursAgo(randomInt(1, 168)),
        delivered_at: hoursAgo(randomInt(0, 160)),
      })
      if (error) results.campaign_recipients.err++; else results.campaign_recipients.ok++
    }
  }

  // === WAITLIST (15) ===
  results.waitlist = { ok: 0, err: 0, errors: [] }
  const prefTimes = ['08:00:00', '09:00:00', '10:00:00', '11:00:00', '13:00:00', '14:00:00', '15:00:00', '16:00:00']
  for (let i = 0; i < 15; i++) {
    const prefStart = randomPick(prefTimes)
    const startH = parseInt(prefStart.split(':')[0])
    const endH = Math.min(startH + 4, 18)
    const { error } = await supabase.from('waitlist').insert({
      clinic_id: cid,
      patient_id: randomPick(patientIds),
      dentist_id: randomPick(dentistIds),
      procedure_id: randomPick(procedureIds),
      preferred_date: daysFromNow(1 + randomInt(0, 14)).split('T')[0],
      preferred_time_start: prefStart,
      preferred_time_end: `${String(endH).padStart(2, '0')}:00:00`,
      priority: randomInt(1, 5),
      status: 'waiting',
      notes: 'Paciente aguardando vaga',
    })
    if (error) results.waitlist.err++; else results.waitlist.ok++
  }

  // === PATIENT FEEDBACK (30) ===
  results.patient_feedback = { ok: 0, err: 0, errors: [] }
  const feedbackComments = [
    'Excelente atendimento! Equipe muito atenciosa.',
    'Gostei do resultado. Recomendo a clínica.',
    'Bom atendimento, mas a espera foi um pouco longa.',
    'Profissional muito competente e cuidadoso.',
    'Ambiente agradável e moderno. Me senti à vontade.',
    'Ótima experiência, voltarei com certeza.',
    'Tratamento indolor, muito profissional.',
    'Recepção muito simpática e acolhedora.',
  ]
  const feedbackChannels = ['whatsapp', 'email', 'in_person']
  const feedbackTypes = ['post_appointment', 'general', 'nps']

  for (let i = 0; i < 30; i++) {
    const { error } = await supabase.from('patient_feedback').insert({
      clinic_id: cid,
      patient_id: randomPick(patientIds),
      feedback_type: randomPick(feedbackTypes),
      rating: randomInt(3, 5),
      nps_score: randomInt(6, 10),
      would_recommend: Math.random() > 0.2,
      comments: randomPick(feedbackComments),
      improvements: Math.random() > 0.5 ? ['Tempo de espera', 'Estacionamento'] : null,
      collected_at: hoursAgo(randomInt(1, 720)),
      channel: randomPick(feedbackChannels),
    })
    if (error) results.patient_feedback.err++; else results.patient_feedback.ok++
  }

  // === PROCEDURE GUIDELINES (4) ===
  results.procedure_guidelines = { ok: 0, err: 0, errors: [] }
  const guidelines = [
    { procedure_name: 'Implante Dentário', title: 'Cuidados Pós-Implante', instructions: 'Mantenha a região limpa com bochechos leves. Evite tocar no local. Use medicação conforme prescrito.', emergency_contact: true, recovery_time_days: 7, restrictions: ['Não fazer força na região', 'Evitar alimentos duros por 7 dias', 'Não fumar por 72 horas'], warning_signs: ['Sangramento excessivo', 'Dor intensa após 48h', 'Inchaço progressivo'] },
    { procedure_name: 'Aparelho Ortodôntico', title: 'Cuidados com Aparelho', instructions: 'Escove após cada refeição. Use floss ortodôntico diariamente. Evite alimentos pegajosos.', emergency_contact: false, recovery_time_days: 0, restrictions: ['Não mascar chiclete', 'Evitar balas duras', 'Cortar frutas em pedaços pequenos'], warning_signs: ['Fio ou brquete solto', 'Fio cortando a bochecha', 'Dor intensa ao morder'] },
    { procedure_name: 'Faceta de Porcelana', title: 'Cuidados Pós-Faceta', instructions: 'Evite morder objetos duros. Mantenha higiene normal. Use protetor bucal se pratica esportes.', emergency_contact: false, recovery_time_days: 3, restrictions: ['Evitar abrir embalagens com os dentes', 'Não roer unhas', 'Evitar alimentos duros por 3 dias'], warning_signs: ['Faceta solta ou quebrada', 'Sensibilidade extrema ao frio', 'Dor ao morder'] },
    { procedure_name: 'Prótese Total', title: 'Adaptação à Prótese', instructions: 'Nos primeiros dias, coma alimentos macios. Leia em voz alta para adaptar a fala. Remova à noite.', emergency_contact: false, recovery_time_days: 14, restrictions: ['Não dormir com a prótese', 'Não usar água quente para limpar', 'Evitar adesivo em excesso'], warning_signs: ['Dor intensa que não melhora', 'Feridas na gengiva', 'Prótese não encaixa mais'] },
  ]
  for (const g of guidelines) {
    const { error } = await supabase.from('procedure_guidelines').insert({ clinic_id: cid, ...g, is_active: true })
    if (error) results.procedure_guidelines.err++; else results.procedure_guidelines.ok++
  }

  // === SCHEDULE BLOCKS (per dentist) ===
  results.schedule_blocks = { ok: 0, err: 0, errors: [] }
  const scheduleDays = [
    { day: 0, start: '08:00:00', end: '12:00:00', avail: false }, // Domingo
    { day: 1, start: '08:00:00', end: '18:00:00', avail: true },  // Segunda
    { day: 2, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 3, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 4, start: '08:00:00', end: '18:00:00', avail: true },
    { day: 5, start: '08:00:00', end: '12:00:00', avail: true },  // Sexta manhã
    { day: 6, start: '00:00:00', end: '00:00:00', avail: false }, // Sábado
  ]
  for (const did of dentistIds) {
    for (const s of scheduleDays) {
      const { error } = await supabase.from('schedule_blocks').insert({
        clinic_id: cid,
        dentist_id: did,
        day_of_week: s.day,
        start_time: s.start,
        end_time: s.end,
        is_available: s.avail,
      })
      if (error) results.schedule_blocks.err++; else results.schedule_blocks.ok++
    }
  }

  // === FOLLOW-UP CONFIGS ===
  results.follow_up_configs = { ok: 0, err: 0, errors: [] }
  const fuConfigs = [
    { config_type: 'post_consultation', delay_hours: 24, message_template: 'Olá {{patient_name}}! Como está após sua consulta de {{procedure}}? Estamos aqui se precisar!', is_active: true },
    { config_type: 'post_consultation', delay_hours: 168, message_template: 'Olá {{patient_name}}! Já faz 7 dias desde sua consulta. Tudo bem? Agende um retorno se necessário.', is_active: true },
    { config_type: 'return_reminder', delay_days: 2, message_template: 'Olá {{patient_name}}! Notamos que você não compareceu à consulta. Deseja reagendar?', is_active: true },
    { config_type: 'return_reminder', delay_months: 6, procedure_name: 'Limpeza', message_template: 'Olá {{patient_name}}! Sentimos sua falta! Que tal agendar uma revisão?', is_active: true },
  ]
  for (const fc of fuConfigs) {
    const { error } = await supabase.from('follow_up_configs').insert({ clinic_id: cid, ...fc })
    if (error) results.follow_up_configs.err++; else results.follow_up_configs.ok++
  }

  // === SUMMARY ===
  const summary: Record<string, number> = {}
  for (const [k, v] of Object.entries(results)) {
    summary[k] = v.ok
  }

  return NextResponse.json({ success: true, results, summary })
}
