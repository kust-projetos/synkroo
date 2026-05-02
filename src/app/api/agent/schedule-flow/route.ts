import { NextRequest, NextResponse } from 'next/server'
import { getLLMProvider } from '@/lib/llm'
import { createTypedClient, TypedSupabaseClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import { validateApiAuth } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/services/scheduler/scheduler.service'

/**
 * POST /api/agent/schedule-flow
 * Handle appointment scheduling conversation flow
 *
 * This endpoint orchestrates the full scheduling flow:
 * 1. Classify intent (via LLM provider factory)
 * 2. Extract entities (date, time, procedure, dentist)
 * 3. Check availability
 * 4. Create appointment if slot available
 * 5. Return appropriate response
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    }
    const clinicId = authResult.profile!.clinic_id

    const body = await request.json()
    const {
      message,
      patient_id,
      conversation_history = [],
    } = body

    if (!message || !patient_id) {
      return NextResponse.json(
        { error: 'message and patient_id are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    // Step 1: Classify intent via provider factory
    const llm = getLLMProvider()
    const classification = await llm.classifyIntent(message)
    const entities = await llm.extractEntities(message)
    const allEntities = { ...classification.entities, ...entities }

    dbLogger.debug('Schedule flow classification', {
      intent: classification.intent,
      confidence: classification.confidence,
      entities: allEntities,
    })

    // Step 2: Handle based on intent
    switch (classification.intent) {
      case 'agendamento':
        return await handleSchedulingIntent(
          supabase,
          clinicId,
          patient_id,
          message,
          allEntities
        )

      case 'confirmacao':
        return await handleConfirmationIntent(
          supabase,
          clinicId,
          patient_id,
          message,
          allEntities
        )

      case 'emergencia':
        return await handleEmergencyIntent(message, allEntities)

      case 'duvida':
        return await handleQuestionIntent(
          supabase,
          clinicId,
          message,
          allEntities,
          conversation_history
        )

      default:
        return await handleGeneralIntent(
          message,
          classification.intent,
          allEntities,
          conversation_history
        )
    }
  } catch (error) {
    dbLogger.error('Error in schedule-flow', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Check availability using the shared scheduler service
 */
async function checkAvailabilityDirect(
  _supabase: TypedSupabaseClient,
  clinicId: string,
  dateStr: string,
  dentistId?: string
): Promise<{
  available: boolean
  reason?: string
  slots: Array<{ time: string; available: boolean; reason?: string }>
}> {
  try {
    const slots = await getAvailableSlots(clinicId, dateStr, 30, dentistId)

    return {
      available: slots.some(s => s.available),
      slots: slots.map(s => ({
        time: s.time,
        available: s.available,
        reason: s.available ? undefined : 'Horário ocupado',
      })),
    }
  } catch (error) {
    dbLogger.error('Error checking availability', error)
    return {
      available: false,
      reason: 'Erro ao verificar disponibilidade',
      slots: [],
    }
  }
}

/**
 * Handle scheduling intent - the main appointment booking flow
 */
async function handleSchedulingIntent(
  supabase: TypedSupabaseClient,
  clinicId: string,
  patientId: string,
  message: string,
  entities: Record<string, string | null>
): Promise<NextResponse> {
  const hasDate = entities.data && entities.data !== 'null'
  const hasTime = entities.hora && entities.hora !== 'null'

  // Case 1: No date provided - ask for date
  if (!hasDate) {
    return NextResponse.json({
      action: 'ask_date',
      message: 'Claro! Vou te ajudar a agendar. Para qual data você gostaria? Pode me dizer algo como "amanhã", "quinta-feira" ou "dia 15".',
      intent: 'agendamento',
      confidence: 0.9,
      entities,
      next_step: 'provide_date',
    })
  }

  const date = entities.data as string

  // Case 2: Have date but no time - check availability and show slots
  if (!hasTime) {
    // Get availability for the date directly from DB
    const availability = await checkAvailabilityDirect(supabase, clinicId, date)

    if (!availability.available) {
      return NextResponse.json({
        action: 'date_unavailable',
        message: `Infelizmente não atendemos no dia selecionado (${formatDate(date)}). ${availability.reason}. Quer tentar outra data?`,
        intent: 'agendamento',
        entities,
        next_step: 'provide_different_date',
      })
    }

    // Get available slots
    const availableSlots = availability.slots.filter((s: { available: boolean }) => s.available)

    if (availableSlots.length === 0) {
      return NextResponse.json({
        action: 'no_slots',
        message: `Não temos horários disponíveis para ${formatDate(date)}. Quer tentar outra data?`,
        intent: 'agendamento',
        entities,
        next_step: 'provide_different_date',
      })
    }

    // Show morning and afternoon slots separately
    const morningSlots = availableSlots.filter((s: { time: string }) =>
      parseInt(s.time.split(':')[0]) < 12
    )
    const afternoonSlots = availableSlots.filter((s: { time: string }) =>
      parseInt(s.time.split(':')[0]) >= 12
    )

    let slotsMessage = `Temos horários disponíveis para ${formatDate(date)}!\n\n`

    if (morningSlots.length > 0) {
      slotsMessage += `☀️ **Manhã:** ${morningSlots.slice(0, 4).map((s: { time: string }) => s.time).join(', ')}\n`
    }
    if (afternoonSlots.length > 0) {
      slotsMessage += `🌙 **Tarde:** ${afternoonSlots.slice(0, 4).map((s: { time: string }) => s.time).join(', ')}\n`
    }

    slotsMessage += '\nQual horário você prefere?'

    return NextResponse.json({
      action: 'ask_time',
      message: slotsMessage,
      intent: 'agendamento',
      confidence: 0.9,
      entities,
      available_slots: availableSlots,
      next_step: 'provide_time',
    })
  }

  // Case 3: Have date and time - check and create appointment
  const time = entities.hora as string
  const datetimeStr = `${date}T${time}:00`

  // Check availability for this specific slot directly from DB
  const availability = await checkAvailabilityDirect(supabase, clinicId, date)

  const slot = availability.slots.find((s: { time: string; available: boolean }) =>
    s.time === time && s.available
  )

  if (!slot) {
    return NextResponse.json({
      action: 'slot_unavailable',
      message: `Desculpe, o horário ${time} não está mais disponível. Posso sugerir outro horário?`,
      intent: 'agendamento',
      entities,
      next_step: 'provide_different_time',
    })
  }

  // Get procedure if mentioned
  let procedureId: string | null = null
  let procedureName: string | null = null
  if (entities.procedimento) {
    const { data: procedure } = await supabase
      .from('procedures')
      .select('id, name')
      .eq('clinic_id', clinicId)
      .ilike('name', `%${entities.procedimento.replace(/[%_\\]/g, '\\$&')}%`)
      .single() as { data: { id: string; name: string } | null }

    if (procedure) {
      procedureId = procedure.id
      procedureName = procedure.name
    }
  }

  // Get patient info for confirmation
  const { data: patient } = await supabase
    .from('patients')
    .select('name')
    .eq('id', patientId)
    .single() as { data: { name: string } | null }

  // Create the appointment
  const insertResult = await (supabase
    .from('appointments') as any)
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      procedure_id: procedureId,
      scheduled_at: datetimeStr,
      duration_minutes: 30,
      status: 'scheduled',
    })
    .select(`
      id,
      scheduled_at,
      patients (name),
      procedures (name)
    `)
    .single()
  const appointment = insertResult.data
  const error = insertResult.error

  if (error) {
    dbLogger.error('Error creating appointment', error)
    return NextResponse.json({
      action: 'error',
      message: 'Desculpe, tive um problema ao criar o agendamento. Pode tentar novamente?',
      intent: 'agendamento',
      entities,
    })
  }

  // Success response
  const formattedDate = formatDate(date)
  const formattedTime = time

  return NextResponse.json({
    action: 'appointment_created',
    message: `✅ Agendamento confirmado!\n\n📅 **Data:** ${formattedDate}\n⏰ **Horário:** ${formattedTime}\n${procedureName ? `🦷 **Procedimento:** ${procedureName}` : ''}\n\nVamos te enviar um lembrete no dia anterior. Precisa de mais alguma coisa?`,
    intent: 'agendamento',
    confidence: 0.95,
    entities,
    appointment: {
      id: appointment.id,
      scheduled_at: appointment.scheduled_at,
      patient_name: patient?.name,
      procedure_name: procedureName,
    },
    next_step: 'complete',
  })
}

/**
 * Handle confirmation intent - patient confirming attendance
 */
async function handleConfirmationIntent(
  supabase: TypedSupabaseClient,
  clinicId: string,
  patientId: string,
  message: string,
  entities: Record<string, string | null>
): Promise<NextResponse> {
  // Find upcoming appointment
  const { data: appointment } = await supabase
    .from('appointments')
    .select('id, scheduled_at, status')
    .eq('clinic_id', clinicId)
    .eq('patient_id', patientId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single() as { data: { id: string; scheduled_at: string; status: string } | null }

  if (!appointment) {
    return NextResponse.json({
      action: 'no_appointment',
      message: 'Não encontrei nenhum agendamento pendente para confirmar. Quer agendar uma consulta?',
      intent: 'confirmacao',
      entities,
    })
  }

  // Update status to confirmed
  await (supabase.from('appointments') as any)
    .update({ status: 'confirmed' })
    .eq('id', appointment.id)

  const appointmentDate = new Date(appointment.scheduled_at)
  const formattedDate = appointmentDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const formattedTime = appointmentDate.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return NextResponse.json({
    action: 'confirmed',
    message: `Perfeito! Sua consulta está confirmada para ${formattedDate} às ${formattedTime}. Vamos te enviar um lembrete no dia anterior! 😊`,
    intent: 'confirmacao',
    confidence: 0.95,
    appointment_id: appointment.id,
  })
}

/**
 * Handle emergency intent - escalate to human
 */
async function handleEmergencyIntent(
  message: string,
  entities: Record<string, string | null>
): Promise<NextResponse> {
  return NextResponse.json({
    action: 'escalate',
    message: 'Entendi que você está passando por uma emergência. 😔 Vou transferir você imediatamente para um atendente que pode ajudar melhor. Por favor, aguarde um momento.',
    intent: 'emergencia',
    confidence: 0.95,
    entities,
    should_escalate: true,
  })
}

/**
 * Handle question intent - answer questions about services
 */
async function handleQuestionIntent(
  supabase: TypedSupabaseClient,
  clinicId: string,
  message: string,
  entities: Record<string, string | null>,
  _conversationHistory: Array<{ role: string; content: string }>
): Promise<NextResponse> {
  // Get clinic procedures for context
  const { data: procedures } = await supabase
    .from('procedures')
    .select('name, description, price, duration_minutes')
    .eq('clinic_id', clinicId)
    .eq('is_active', true) as { data: Array<{ name: string; description: string | null; price: number | null; duration_minutes: number | null }> | null }

  // Generate response using configured LLM provider
  const llm = getLLMProvider()
  const response = await llm.generateResponse(message, {
    intent: 'duvida',
    entities,
    conversationHistory: [],
    clinicInfo: {
      name: 'Nossa clínica',
      procedures: (procedures || []).map(p => p.name),
    },
  })

  return NextResponse.json({
    action: 'respond',
    message: response,
    intent: 'duvida',
    confidence: 0.85,
    entities,
  })
}

/**
 * Handle general intent - greetings, thanks, etc.
 */
async function handleGeneralIntent(
  message: string,
  intent: string,
  entities: Record<string, string | null>,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<NextResponse> {
  const llm = getLLMProvider()
  const response = await llm.generateResponse(message, {
    intent,
    entities,
    conversationHistory: conversationHistory.map(h => ({
      role: h.role as 'user' | 'assistant',
      content: h.content,
    })),
  })

  return NextResponse.json({
    action: 'respond',
    message: response,
    intent,
    confidence: 0.8,
    entities,
  })
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
}