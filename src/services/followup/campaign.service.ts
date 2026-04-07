import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger, whatsappLogger } from '@/lib/logger'

/**
 * Campaign Service
 * Handles reactivation campaigns, budget follow-ups, and patient engagement
 */

type PatientBasic = { id: string; name: string; phone: string }

type CampaignRow = {
  id: string
  name: string
  status: string
  campaign_type: string
  target_segment: string | null
  message_template: string
  channel: string
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  clinic_id: string
}

export interface Campaign {
  id: string
  clinicId: string
  name: string
  description?: string
  campaignType: 'reactivation' | 'retention' | 'promotional' | 'follow_up'
  targetSegment?: string
  messageTemplate: string
  channel: string
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled'
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  totalRecipients: number
  sentCount: number
  responseCount: number
  conversionCount: number
  optOutCount: number
}

export interface CampaignRecipient {
  campaignId: string
  patientId: string
  patientName: string
  patientPhone: string
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'responded' | 'converted' | 'opted_out'
}

/**
 * Create a new campaign
 */
export async function createCampaign(params: {
  clinicId: string
  name: string
  description?: string
  campaignType: string
  targetSegment?: string
  messageTemplate: string
  channel?: string
  scheduledAt?: Date
}): Promise<{ success: boolean; campaign?: Campaign; error?: string }> {
  const supabase = await createTypedClient()

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      clinic_id: params.clinicId,
      name: params.name,
      description: params.description,
      campaign_type: params.campaignType,
      target_segment: params.targetSegment,
      message_template: params.messageTemplate,
      channel: params.channel || 'whatsapp',
      status: params.scheduledAt ? 'scheduled' : 'draft',
      scheduled_at: params.scheduledAt?.toISOString(),
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return {
    success: true,
    campaign: {
      id: data.id,
      clinicId: data.clinic_id,
      name: data.name,
      description: data.description,
      campaignType: data.campaign_type,
      targetSegment: data.target_segment,
      messageTemplate: data.message_template,
      channel: data.channel,
      status: data.status,
      scheduledAt: data.scheduled_at ? new Date(data.scheduled_at) : undefined,
      totalRecipients: data.total_recipients,
      sentCount: data.sent_count,
      responseCount: data.response_count,
      conversionCount: data.conversion_count,
      optOutCount: data.opt_out_count,
    },
  }
}

/**
 * Add recipients to a campaign
 */
export async function addCampaignRecipients(
  campaignId: string,
  patientIds: string[]
): Promise<{ success: boolean; added: number; error?: string }> {
  const supabase = await createTypedClient()

  // Get patient details
  const { data: patients, error: patientError } = await supabase
    .from('patients')
    .select('id, name, phone')
    .in('id', patientIds)

  if (patientError) {
    return { success: false, added: 0, error: patientError.message }
  }

  // Create recipient records
  const recipients = patients?.map((p) => ({
    campaign_id: campaignId,
    patient_id: p.id,
    status: 'pending',
  })) || []

  const { error } = await supabase
    .from('campaign_recipients')
    .insert(recipients)

  if (error) {
    return { success: false, added: 0, error: error.message }
  }

  // Update campaign total (increment existing count)
  const { data: currentCampaign } = await supabase
    .from('campaigns')
    .select('total_recipients')
    .eq('id', campaignId)
    .single()

  const newTotal = (currentCampaign?.total_recipients || 0) + recipients.length

  await supabase
    .from('campaigns')
    .update({ total_recipients: newTotal })
    .eq('id', campaignId)

  return { success: true, added: recipients.length }
}

/**
 * Start a campaign
 */
export async function startCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createTypedClient()

  // Get campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (campaignError || !campaign) {
    return { success: false, error: 'Campaign not found' }
  }

  // Update status to running
  await supabase
    .from('campaigns')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', campaignId)

  // Get pending recipients with patient details
  const { data: recipients } = await supabase
    .from('campaign_recipients')
    .select(`
      id,
      patient_id,
      status,
      patients (name, phone)
    `)
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')

  let sent = 0
  let failed = 0

  for (const recipient of recipients || []) {
    // Format message - patients is returned as array from join
    const patient = Array.isArray(recipient.patients) ? recipient.patients[0] : recipient.patients
    const message = campaign.message_template
      .replace(/{{patient_name}}/g, patient?.name || 'Paciente')

    // Send message
    const result = await sendCampaignMessage(patient?.phone, message)

    // Update recipient status
    await supabase
      .from('campaign_recipients')
      .update({
        status: result.success ? 'sent' : 'failed',
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error,
      })
      .eq('id', recipient.id)

    if (result.success) {
      sent++
    } else {
      failed++
    }

    // Rate limiting - wait between messages
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Update campaign stats
  await supabase
    .from('campaigns')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      sent_count: sent,
    })
    .eq('id', campaignId)

  return { success: true }
}

/**
 * Send campaign message
 */
async function sendCampaignMessage(
  phone: string | undefined,
  message: string
): Promise<{ success: boolean; error?: string }> {
  if (!phone) {
    return { success: false, error: 'No phone number' }
  }

  try {
    const whatsappApiUrl = process.env.WHATSAPP_API_URL
    const whatsappToken = process.env.WHATSAPP_TOKEN

    if (!whatsappApiUrl || !whatsappToken) {
      return { success: false, error: 'WhatsApp not configured' }
    }

    let formattedPhone = phone.replace(/\D/g, '')
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone
    }

    const response = await fetch(whatsappApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: formattedPhone,
        type: 'text',
        text: { body: message },
      }),
    })

    if (!response.ok) {
      const data = await response.json()
      return { success: false, error: data.error?.message }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: 'Internal error' }
  }
}

/**
 * Get campaigns for a clinic
 */
export async function getCampaigns(
  clinicId: string,
  status?: string
): Promise<Campaign[]> {
  const supabase = await createTypedClient()

  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) return []

  return (data || []).map((c: CampaignRow) => ({
    id: c.id,
    clinicId: c.clinic_id,
    name: c.name,
    description: c.description,
    campaignType: c.campaign_type,
    targetSegment: c.target_segment,
    messageTemplate: c.message_template,
    channel: c.channel,
    status: c.status,
    scheduledAt: c.scheduled_at ? new Date(c.scheduled_at) : undefined,
    startedAt: c.started_at ? new Date(c.started_at) : undefined,
    completedAt: c.completed_at ? new Date(c.completed_at) : undefined,
    totalRecipients: c.total_recipients,
    sentCount: c.sent_count,
    responseCount: c.response_count,
    conversionCount: c.conversion_count,
    optOutCount: c.opt_out_count,
  }))
}

/**
 * Process scheduled campaigns
 */
export async function processScheduledCampaigns(): Promise<void> {
  const supabase = await createTypedClient()

  const now = new Date()

  // Get scheduled campaigns that should run now
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())

  for (const campaign of campaigns || []) {
    dbLogger.info(`Starting scheduled campaign: ${campaign.name}`)
    await startCampaign(campaign.id)
  }
}

/**
 * Create automatic reactivation campaign
 */
export async function createReactivationCampaign(
  clinicId: string,
  targetSegment: string
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  // Get message template for segment
  const messages: Record<string, string> = {
    inactive_30: `Olá, {{patient_name}}! 👋

Sentimos sua falta! Já faz um tempo desde sua última visita.

Que tal agendar uma consulta de retorno? Sua saúde bucal agradece! 🦷

📅 Responda essa mensagem que eu te ajudo a agendar.`,
    inactive_60: `Olá, {{patient_name}}! 💙

Faz 2 meses que não apareceu na clínica. Estamos com horários disponíveis!

✨ Agende sua consulta de retorno e mantenha seu sorriso saudável.

📱 É só responder essa mensagem!`,
    inactive_90: `Olá, {{patient_name}}! 🦷

Faz 3 meses que não te vemos. Sua saúde bucal é importante!

🎁 Vamos oferecer um desconto especial de 10% para sua próxima consulta!

📅 Agende agora respondendo essa mensagem.`,
  }

  const messageTemplate = messages[targetSegment] || messages.inactive_60

  const result = await createCampaign({
    clinicId,
    name: `Reativação - ${targetSegment.replace('inactive_', '')} dias`,
    description: `Campanha automática para pacientes inativos (${targetSegment})`,
    campaignType: 'reactivation',
    targetSegment,
    messageTemplate,
  })

  if (!result.success || !result.campaign) {
    return { success: false, error: result.error }
  }

  // Get patients for this segment
  const { getPatientsForReactivation } = await import('./inactive-patient.service')
  const patients = await getPatientsForReactivation(clinicId, targetSegment)

  if (patients.length === 0) {
    return { success: true, campaignId: result.campaign.id }
  }

  // Add recipients
  await addCampaignRecipients(
    result.campaign.id,
    patients.map((p: { patientId: string }) => p.patientId)
  )

  return { success: true, campaignId: result.campaign.id }
}